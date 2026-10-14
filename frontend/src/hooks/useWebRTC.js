import { useState, useRef, useCallback, useEffect } from 'react';
import { socket } from '../utils/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Custom hook managing native peer-to-peer WebRTC video/audio streaming
 *
 * @param {MediaStream|null} localStream 
 * @returns {{
 *   remoteStream: MediaStream|null,
 *   connectionStatus: 'disconnected'|'connecting'|'connected'|'failed',
 *   initiateCall: (targetSocketId: string) => Promise<void>,
 *   cleanupPeer: () => void
 * }}
 */
export function useWebRTC(localStream) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // Create or return active RTCPeerConnection
  const getOrCreatePeerConnection = useCallback((targetSocketId) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Attach local media tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Relay local ICE candidates to remote peer via Socket.IO
    pc.onicecandidate = (event) => {
      if (event.candidate && targetSocketId) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') setConnectionStatus('connected');
      else if (state === 'connecting') setConnectionStatus('connecting');
      else if (state === 'failed' || state === 'closed') setConnectionStatus('disconnected');
    };

    return pc;
  }, [localStream]);

  // Clean up WebRTC peer
  const cleanupPeer = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setConnectionStatus('disconnected');
    pendingCandidatesRef.current = [];
  }, []);

  // Initiate call by creating and sending an Offer (Caller)
  const initiateCall = useCallback(async (targetSocketId) => {
    try {
      setConnectionStatus('connecting');
      const pc = getOrCreatePeerConnection(targetSocketId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      socket.emit('webrtc-offer', { targetSocketId, offer });
    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
      setConnectionStatus('failed');
    }
  }, [getOrCreatePeerConnection]);

  // Socket signaling listeners
  useEffect(() => {
    // 1. Receive Offer (Callee)
    const onReceiveOffer = async ({ senderSocketId, offer }) => {
      try {
        setConnectionStatus('connecting');
        const pc = getOrCreatePeerConnection(senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Process any queued ICE candidates
        while (pendingCandidatesRef.current.length > 0) {
          const candidate = pendingCandidatesRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (err) {
        console.error('Failed to handle incoming offer:', err);
      }
    };

    // 2. Receive Answer (Caller)
    const onReceiveAnswer = async ({ senderSocketId, answer }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          // Process any queued ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.error('Failed to handle incoming answer:', err);
      }
    };

    // 3. Receive ICE Candidate
    const onReceiveCandidate = async ({ senderSocketId, candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    };

    socket.on('webrtc-offer', onReceiveOffer);
    socket.on('webrtc-answer', onReceiveAnswer);
    socket.on('webrtc-ice-candidate', onReceiveCandidate);

    return () => {
      socket.off('webrtc-offer', onReceiveOffer);
      socket.off('webrtc-answer', onReceiveAnswer);
      socket.off('webrtc-ice-candidate', onReceiveCandidate);
    };
  }, [getOrCreatePeerConnection]);

  // Update peer tracks if localStream changes
  useEffect(() => {
    if (peerConnectionRef.current && localStream) {
      const senders = peerConnectionRef.current.getSenders();
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peerConnectionRef.current.addTrack(track, localStream);
        }
      });
    }
  }, [localStream]);

  return {
    remoteStream,
    connectionStatus,
    initiateCall,
    cleanupPeer,
  };
}
