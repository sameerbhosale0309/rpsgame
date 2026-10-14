import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../utils/socket';
import {
  initializeHandLandmarker,
  recognizeGestureFromLandmarks,
  GestureStabilizer,
  drawHandSkeleton,
  GESTURE,
} from '../utils/gestureRecognizer';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSoundEffects } from '../hooks/useSoundEffects';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Copy,
  Check,
  Trophy,
  AlertTriangle,
  Radio,
  Disc,
  CircleDot,
  Hand,
  Scissors,
  RefreshCw,
  LogOut,
  Sliders,
  Cpu,
} from 'lucide-react';
import MatchSummaryModal from './MatchSummaryModal';

/**
 * Move Icon renderer in retro 1980s monochrome phosphor format
 */
const MoveIcon = ({ move, size = 32, className = '' }) => {
  switch (move) {
    case 'ROCK':
      return <CircleDot size={size} className={`text-[#ff6b35] ${className}`} />;
    case 'PAPER':
      return <Hand size={size} className={`text-[#33ff55] ${className}`} />;
    case 'SCISSORS':
      return <Scissors size={size} className={`text-[#ffb000] ${className}`} />;
    default:
      return <span className={`font-['VT323'] text-3xl font-bold text-[#8c928b] ${className}`}>?</span>;
  }
};

const getMoveLabel = (move) => {
  if (move === 'ROCK') return 'FIST [ROCK]';
  if (move === 'PAPER') return 'PALM [PAPER]';
  if (move === 'SCISSORS') return 'V-SIGN [SCISSORS]';
  return 'NO LOCK [AMBIGUOUS]';
};

/**
 * Hardware LED VU Meter Component (5-bar confidence visualizer)
 */
const VUMeter = ({ level = 0 }) => {
  // level: 0 to 100
  const activeCount = Math.min(5, Math.floor((level / 100) * 5) + (level > 0 ? 1 : 0));
  const bars = [
    { color: '#33ff55', glow: '#33ff55' },
    { color: '#33ff55', glow: '#33ff55' },
    { color: '#33ff55', glow: '#33ff55' },
    { color: '#ffb000', glow: '#ffb000' },
    { color: '#ff5500', glow: '#ff5500' },
  ];

  return (
    <div className="flex items-center gap-1 bg-[#0a0c0e] px-2 py-1 rounded border border-[#2b323c]">
      <span className="text-[9px] font-['VT323'] text-[#9aa0a6] mr-1">VU:</span>
      {bars.map((bar, idx) => {
        const isActive = idx < activeCount;
        return (
          <div
            key={idx}
            className={`w-2 h-3.5 rounded-xs transition-all ${
              isActive
                ? 'shadow-[0_0_6px_currentColor]'
                : 'opacity-20'
            }`}
            style={{
              backgroundColor: bar.color,
              color: bar.glow,
            }}
          />
        );
      })}
    </div>
  );
};

export default function GameRoom({ roomCode, username, onLeaveRoom }) {
  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // WebRTC
  const { remoteStream, connectionStatus, initiateCall, cleanupPeer } = useWebRTC(localStream);

  // Retro sound effects hook
  const { playMechanicalClick, playTick, playShoot, playWin, playLose, playDraw } = useSoundEffects();

  // References
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const stabilizerRef = useRef(new GestureStabilizer(5, 0.6));

  // Game state
  const [roomState, setRoomState] = useState(null);
  const [localGesture, setLocalGesture] = useState(GESTURE.UNKNOWN);
  const [gestureConfidence, setGestureConfidence] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // HUD & Round progression states
  const [hudPhase, setHudPhase] = useState('WAITING');
  const [countdownTick, setCountdownTick] = useState(null);
  const [prepareMessage, setPrepareMessage] = useState('');
  const [latestRoundResult, setLatestRoundResult] = useState(null);
  const [matchOverData, setMatchOverData] = useState(null);
  const [disconnectAlert, setDisconnectAlert] = useState(null);

  const currentLiveGestureRef = useRef(GESTURE.UNKNOWN);

  // -------------------------------------------------------------
  // 1. INITIALIZE CAMERA & MEDIAPIPE
  // -------------------------------------------------------------
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('OPTICAL SENSOR FAULT: Camera access denied or hardware offline.');
    }
  }, []);

  useEffect(() => {
    startCamera();

    let isMounted = true;
    initializeHandLandmarker()
      .then((landmarker) => {
        if (isMounted) landmarkerRef.current = landmarker;
      })
      .catch((err) => {
        console.warn('MediaPipe fallback:', err);
      });

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      cleanupPeer();
    };
  }, []);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // -------------------------------------------------------------
  // 2. MEDIAPIPE DETECTION LOOP (CRT Oscilloscope Canvas Overlay)
  // -------------------------------------------------------------
  useEffect(() => {
    let lastVideoTime = -1;

    const renderLoop = () => {
      const video = localVideoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (landmarkerRef.current && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const detections = landmarkerRef.current.detectForVideo(video, performance.now());

          if (detections && detections.landmarks && detections.landmarks.length > 0) {
            const landmarks = detections.landmarks[0];
            const rawGesture = recognizeGestureFromLandmarks(landmarks);
            const { gesture, confidence } = stabilizerRef.current.update(rawGesture);

            setLocalGesture(gesture);
            setGestureConfidence(Math.round(confidence * 100));
            currentLiveGestureRef.current = gesture;

            // Draw vintage 1980s Phosphor CRT Vector Wireframe
            drawHandSkeleton(ctx, landmarks, gesture, canvas.width, canvas.height);
          } else {
            stabilizerRef.current.update(GESTURE.UNKNOWN);
            setLocalGesture(GESTURE.UNKNOWN);
            setGestureConfidence(0);
            currentLiveGestureRef.current = GESTURE.UNKNOWN;
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameIdRef.current);
  }, []);

  // -------------------------------------------------------------
  // 3. SOCKET.IO GAME EVENTS & LIFECYCLE
  // -------------------------------------------------------------
  useEffect(() => {
    socket.on('peer-joined', ({ peer, roomState }) => {
      setRoomState(roomState);
      initiateCall(peer.socketId);
    });

    socket.on('room-updated', (state) => {
      setRoomState(state);
    });

    socket.on('round-preparing', ({ roundNumber, message }) => {
      setHudPhase('PREPARING');
      setCountdownTick(null);
      setLatestRoundResult(null);
      setPrepareMessage(message || `ROUND ${roundNumber} // SYNCHRONIZING OPTICAL FEED`);
    });

    socket.on('round-tick', ({ count }) => {
      setHudPhase('COUNTDOWN');
      setCountdownTick(count);
      playTick(count === 1 ? 650 : 520);
    });

    socket.on('round-shoot', () => {
      setHudPhase('SHOOT');
      setCountdownTick('SHOOT!');
      playShoot();

      const capturedMove = currentLiveGestureRef.current;
      socket.emit('submit-move', { move: capturedMove });
    });

    socket.on('round-result', ({ roundData, scores, winner, outcomeReason }) => {
      setHudPhase('REVEAL');
      setLatestRoundResult({ ...roundData, scores, winner, outcomeReason });

      const isPlayer1 = roomState?.players?.[0]?.socketId === socket.id;
      const isLocalWinner =
        (isPlayer1 && winner === 'PLAYER_1') || (!isPlayer1 && winner === 'PLAYER_2');

      if (winner === 'DRAW') playDraw();
      else if (isLocalWinner) playWin();
      else playLose();
    });

    socket.on('match-ended', (data) => {
      setHudPhase('MATCH_OVER');
      setMatchOverData(data);
    });

    socket.on('match-reset', (state) => {
      setRoomState(state);
      setMatchOverData(null);
      setLatestRoundResult(null);
      setHudPhase('WAITING');
      setIsReady(false);
    });

    socket.on('peer-disconnected', ({ username: disconnectedUser, gracePeriodMs }) => {
      setDisconnectAlert({
        username: disconnectedUser,
        secondsLeft: Math.round(gracePeriodMs / 1000),
      });

      const interval = setInterval(() => {
        setDisconnectAlert((prev) => {
          if (!prev || prev.secondsLeft <= 1) {
            clearInterval(interval);
            return null;
          }
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        });
      }, 1000);
    });

    socket.on('peer-reconnected', () => {
      setDisconnectAlert(null);
    });

    return () => {
      socket.off('peer-joined');
      socket.off('room-updated');
      socket.off('round-preparing');
      socket.off('round-tick');
      socket.off('round-shoot');
      socket.off('round-result');
      socket.off('match-ended');
      socket.off('match-reset');
      socket.off('peer-disconnected');
      socket.off('peer-reconnected');
    };
  }, [initiateCall, playTick, playShoot, playWin, playLose, playDraw, roomState]);

  // Controls
  const handleToggleReady = () => {
    playMechanicalClick();
    const nextReady = !isReady;
    setIsReady(nextReady);
    socket.emit('player-ready', { ready: nextReady });
  };

  const handleToggleVideo = () => {
    playMechanicalClick();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const handleToggleAudio = () => {
    playMechanicalClick();
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleCopyCode = () => {
    playMechanicalClick();
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePlayAgain = () => {
    playMechanicalClick();
    socket.emit('play-again');
  };

  const isPlayer1 = roomState?.players?.[0]?.socketId === socket.id;
  const localPlayer = isPlayer1 ? roomState?.players?.[0] : roomState?.players?.[1];
  const remotePlayer = isPlayer1 ? roomState?.players?.[1] : roomState?.players?.[0];

  const localScore = localPlayer?.score || 0;
  const remoteScore = remotePlayer?.score || 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#111316] text-[#e5dfd3] selection:bg-[#ffb000] selection:text-black">
      {/* ----------------- TOP CONSOLE BEZEL / SYSTEM BAR ----------------- */}
      <header className="px-6 py-3.5 bg-[#1a1e24] border-b-4 border-[#2b323c] flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_15px_rgba(0,0,0,0.8)] relative z-20">
        <div className="flex items-center gap-3">
          <div className="screw hidden sm:block" />
          <div className="w-3 h-3 rounded-full bg-[#ff5500] shadow-[0_0_10px_#ff5500] animate-pulse" />
          <div>
            <h1 className="font-['Chakra_Petch'] text-lg font-black tracking-wider text-[#e5dfd3] uppercase flex items-center gap-2">
              CF-1984 TERMINAL <span className="text-[#33ff55] font-['VT323'] text-sm px-1.5 py-0.5 bg-[#0a1f0f] border border-[#33ff55]/50 rounded">REC-ONLINE</span>
            </h1>
          </div>
        </div>

        {/* Frequency Code Dial */}
        <div className="flex items-center gap-3 bg-[#0d0f12] border-2 border-[#2b323c] rounded-xl px-4 py-1.5 shadow-bezel-inner">
          <span className="text-[10px] uppercase tracking-wider text-[#9aa0a6] font-['Chakra_Petch']">FREQ:</span>
          <span className="font-['VT323'] font-bold text-[#ffb000] tracking-widest text-2xl leading-none">
            {roomCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="p-1 rounded text-[#cfc6b4] hover:text-[#ffb000] hover:bg-[#1a1e24] transition-colors cursor-pointer"
            title="Copy frequency code"
          >
            {copiedCode ? <Check size={16} className="text-[#33ff55]" /> : <Copy size={16} />}
          </button>
        </div>

        {/* Eject / Abort Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playMechanicalClick();
              onLeaveRoom();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Chakra_Petch'] font-bold uppercase bg-[#301416] text-[#ff808a] border border-[#6b1e24] hover:bg-[#481c20] transition-colors cursor-pointer"
          >
            <LogOut size={14} /> EJECT TAPE
          </button>
          <div className="screw hidden sm:block" />
        </div>
      </header>

      {/* ----------------- CARRIER SIGNAL LOST ALERT BANNER ----------------- */}
      {disconnectAlert && (
        <div className="bg-[#2d1808] border-b-2 border-[#ff6b35] px-6 py-2.5 flex items-center justify-center gap-3 text-[#ffb000] text-xs font-['Share_Tech_Mono'] animate-pulse">
          <AlertTriangle size={16} className="text-[#ff6b35]" />
          <span>
            CARRIER SIGNAL LOST: <strong>[{disconnectAlert.username}]</strong> UNRESPONSIVE. AWAITING RECONNECT: {disconnectAlert.secondsLeft}s
          </span>
        </div>
      )}

      {/* ----------------- OPTICAL SENSOR FAULT BANNER ----------------- */}
      {cameraError && (
        <div className="m-4 p-4 rounded-xl bg-[#2b1014] border-2 border-[#e63946] text-[#ff808a] flex items-center justify-between shadow-[0_0_20px_rgba(230,57,70,0.3)]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-[#e63946]" />
            <p className="text-xs font-['Share_Tech_Mono']">{cameraError}</p>
          </div>
          <button
            onClick={() => {
              playMechanicalClick();
              startCamera();
            }}
            className="btn-tactile px-3 py-1.5 text-xs font-['Chakra_Petch'] font-bold text-white flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> RETRY SENSOR
          </button>
        </div>
      )}

      {/* ----------------- MAIN OPERATIONAL BAY ----------------- */}
      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full gap-4">
        {/* RETRO SCOREBOARD & STATUS BAR */}
        <section className="bg-[#1b2027] border-4 border-[#2c333e] rounded-2xl p-4 flex items-center justify-between shadow-bezel-outer relative">
          <div className="screw absolute top-2 left-2" />
          <div className="screw absolute top-2 right-2" />

          {/* Operator 1 (Local) Telemetry */}
          <div className="flex items-center gap-3 pl-3">
            <div className="w-10 h-10 rounded-lg bg-[#0d0f12] border-2 border-[#ff5500] flex items-center justify-center font-['VT323'] text-2xl text-[#ff5500]">
              OP1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Chakra_Petch'] font-bold text-sm text-[#e5dfd3] uppercase">{username} (YOU)</span>
                {isReady && (
                  <span className="text-[10px] bg-[#0c2413] text-[#33ff55] border border-[#33ff55]/60 px-2 py-0.5 rounded font-['VT323'] text-sm tracking-wider">
                    ARMED
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#9aa0a6] uppercase font-['Share_Tech_Mono']">
                GOAL: FIRST TO {roomState?.targetScore || 3} PTS
              </p>
            </div>
          </div>

          {/* Mechanical / Digital 7-Segment Roll Counters */}
          <div className="flex items-center gap-4 bg-[#0d0f12] border-2 border-[#2a303a] rounded-xl px-5 py-2 shadow-inner">
            <div className="text-center">
              <span className="block text-[9px] font-['VT323'] text-[#9aa0a6] tracking-widest">CH.01</span>
              <div className="font-['VT323'] text-5xl font-bold text-[#33ff55] leading-none glow-green">
                {localScore}
              </div>
            </div>
            <div className="text-[#ffb000] font-['VT323'] text-2xl font-bold tracking-widest px-1">
              :
            </div>
            <div className="text-center">
              <span className="block text-[9px] font-['VT323'] text-[#9aa0a6] tracking-widest">CH.02</span>
              <div className="font-['VT323'] text-5xl font-bold text-[#ff5500] leading-none glow-orange">
                {remoteScore}
              </div>
            </div>
          </div>

          {/* Operator 2 (Remote) Telemetry */}
          <div className="flex items-center gap-3 pr-3 text-right">
            <div>
              <div className="flex items-center justify-end gap-2">
                {remotePlayer?.ready && (
                  <span className="text-[10px] bg-[#0c2413] text-[#33ff55] border border-[#33ff55]/60 px-2 py-0.5 rounded font-['VT323'] text-sm tracking-wider">
                    ARMED
                  </span>
                )}
                <span className="font-['Chakra_Petch'] font-bold text-sm text-[#e5dfd3] uppercase">
                  {remotePlayer?.username || 'WAITING_PEER'}
                </span>
              </div>
              <p className="text-[10px] text-[#9aa0a6] font-['Share_Tech_Mono']">
                {remotePlayer ? (connectionStatus === 'connected' ? 'P2P CARRIER LOCKED' : 'SEARCHING CARRIER...') : 'AWAITING LINK'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#0d0f12] border-2 border-[#ffb000] flex items-center justify-center font-['VT323'] text-2xl text-[#ffb000]">
              OP2
            </div>
          </div>
        </section>

        {/* ----------------- DUAL CRT TERMINAL MONITORS ----------------- */}
        <section className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 relative min-h-[460px]">
          {/* CRT MONITOR 1: LOCAL FEED */}
          <div className="relative rounded-3xl overflow-hidden bg-[#08110b] border-4 border-[#252a32] shadow-bezel-inner crt-screen flex items-center justify-center">
            {/* Local Video Mirrored */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1] opacity-90 contrast-125"
            />

            {/* MediaPipe Phosphor CRT Vector Wireframe Overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1] z-20"
            />

            {/* CRT On-Screen Display (OSD) Header */}
            <div className="absolute top-3 left-4 z-20 flex items-center gap-3 text-[10px] font-['VT323'] text-base tracking-widest text-[#33ff55] glow-green pointer-events-none">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff3333] shadow-[0_0_8px_#ff3333] animate-pulse" />
              <span>REC ● TAPE-A</span>
              <span className="text-[#9aa0a6]">|</span>
              <span>INPUT: OPT-CAM-01</span>
            </div>

            {/* Target Reticle Crosshair in Center */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 z-10">
              <div className="w-24 h-24 border border-dashed border-[#33ff55] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-[#33ff55]" />
              </div>
            </div>

            {/* Floating Live Gesture & VU Meter Telemetry */}
            <div className="absolute bottom-3 left-4 z-20 flex items-center gap-3 bg-[#0d0f12]/90 border border-[#2b323c] px-3 py-2 rounded-xl backdrop-blur-sm shadow-inner">
              <MoveIcon move={localGesture} size={24} />
              <div>
                <p className="text-xs font-['Chakra_Petch'] font-bold text-[#33ff55] uppercase">
                  {getMoveLabel(localGesture)}
                </p>
                <div className="mt-0.5">
                  <VUMeter level={gestureConfidence} />
                </div>
              </div>
            </div>

            {/* Ambiguous Hand Tracking Notice */}
            {localGesture === GESTURE.UNKNOWN && (
              <div className="absolute top-3 right-4 z-20 bg-[#14171b]/90 border border-[#ffb000]/60 text-[#ffb000] text-[10px] font-['Share_Tech_Mono'] px-2.5 py-1 rounded backdrop-blur-sm">
                POSITION HAND IN OPTICAL FRAME
              </div>
            )}
          </div>

          {/* CRT MONITOR 2: REMOTE FEED */}
          <div className="relative rounded-3xl overflow-hidden bg-[#090b0e] border-4 border-[#252a32] shadow-bezel-inner crt-screen flex items-center justify-center">
            {remotePlayer ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover opacity-90 contrast-125"
                />
                {/* Remote OSD */}
                <div className="absolute top-3 left-4 z-20 flex items-center gap-3 text-[10px] font-['VT323'] text-base tracking-widest text-[#ffb000] glow-amber pointer-events-none">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#33ff55] shadow-[0_0_8px_#33ff55]" />
                  <span>CARRIER LOCK // CH-02</span>
                  <span className="text-[#9aa0a6]">|</span>
                  <span>OP: {remotePlayer.username}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 gap-4 z-20">
                <div className="w-16 h-16 rounded-2xl bg-[#14171b] border-2 border-[#2b323c] flex items-center justify-center text-[#ffb000] animate-pulse">
                  <Radio size={32} />
                </div>
                <div>
                  <h3 className="font-['Chakra_Petch'] font-bold text-[#e5dfd3] text-lg uppercase">
                    AWAITING OPERATOR 2 LINK
                  </h3>
                  <p className="text-xs font-['Share_Tech_Mono'] text-[#9aa0a6] mt-1 max-w-xs">
                    TRANSMIT FREQUENCY CODE <strong className="text-[#ffb000] font-['VT323'] text-xl">{roomCode}</strong> TO CHALLENGER.
                  </p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="btn-tactile px-4 py-2 text-xs font-['Chakra_Petch'] font-bold text-[#e5dfd3] uppercase flex items-center gap-2 cursor-pointer"
                >
                  <Copy size={14} /> COPY FREQUENCY
                </button>
              </div>
            )}
          </div>

          {/* ----------------- CENTRAL RETRO CRT OVERLAY HUD ----------------- */}
          {hudPhase !== 'WAITING' && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              {/* Prepare Phase */}
              {hudPhase === 'PREPARING' && (
                <div className="bg-[#0f1410]/95 border-4 border-[#33ff55] rounded-3xl p-6 text-center shadow-[0_0_50px_rgba(51,255,85,0.4)] max-w-md animate-fade-in">
                  <p className="text-xs font-['VT323'] text-xl text-[#33ff55] tracking-widest glow-green uppercase">
                    CALIBRATING SENSORS...
                  </p>
                  <h2 className="text-xl font-['Chakra_Petch'] font-black text-white mt-1 uppercase">
                    {prepareMessage}
                  </h2>
                </div>
              )}

              {/* Countdown Ticks: 3, 2, 1 */}
              {hudPhase === 'COUNTDOWN' && countdownTick && (
                <div className="text-center animate-bounce">
                  <div className="font-['VT323'] text-[140px] font-bold text-[#ffb000] leading-none glow-amber drop-shadow-[0_0_30px_rgba(255,176,0,0.8)]">
                    [ {countdownTick} ]
                  </div>
                </div>
              )}

              {/* SHOOT! Flash */}
              {hudPhase === 'SHOOT' && (
                <div className="text-center animate-pulse">
                  <div className="font-['Chakra_Petch'] text-7xl md:text-9xl font-black text-[#ff5500] tracking-widest glow-orange drop-shadow-[0_0_40px_rgba(255,85,0,0.9)]">
                    &gt;&gt;&gt; SHOOT! &lt;&lt;&lt;
                  </div>
                  <div className="mt-2 inline-block bg-[#260e11] border-2 border-[#ff5500] px-4 py-1 rounded text-xs font-['VT323'] text-xl tracking-widest text-[#ffb000]">
                    CAPTURING OPTICAL GESTURE [500MS]
                  </div>
                </div>
              )}

              {/* Post-Round Reveal Banner */}
              {hudPhase === 'REVEAL' && latestRoundResult && (
                <div className="bg-[#12161b]/98 border-4 border-[#ffb000] rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(255,176,0,0.4)] text-center max-w-lg w-full mx-4">
                  <p className="text-xs font-['VT323'] text-lg uppercase tracking-widest text-[#ffb000]">
                    ROUND {latestRoundResult.roundNumber} RESOLUTION TELEMETRY
                  </p>

                  <div className="grid grid-cols-2 gap-4 my-5 items-center">
                    {/* You */}
                    <div className="flex flex-col items-center p-3 rounded-2xl bg-[#090b0e] border-2 border-[#2b323c]">
                      <span className="text-[10px] font-['Share_Tech_Mono'] text-[#9aa0a6] mb-1">YOUR MOVE</span>
                      <MoveIcon
                        move={isPlayer1 ? latestRoundResult.player1Move : latestRoundResult.player2Move}
                        size={44}
                      />
                      <span className="font-['Chakra_Petch'] font-bold text-xs mt-2 text-[#33ff55]">
                        {isPlayer1 ? latestRoundResult.player1Move : latestRoundResult.player2Move}
                      </span>
                    </div>

                    {/* Opponent */}
                    <div className="flex flex-col items-center p-3 rounded-2xl bg-[#090b0e] border-2 border-[#2b323c]">
                      <span className="text-[10px] font-['Share_Tech_Mono'] text-[#9aa0a6] mb-1">OPPONENT MOVE</span>
                      <MoveIcon
                        move={isPlayer1 ? latestRoundResult.player2Move : latestRoundResult.player1Move}
                        size={44}
                      />
                      <span className="font-['Chakra_Petch'] font-bold text-xs mt-2 text-[#ffb000]">
                        {isPlayer1 ? latestRoundResult.player2Move : latestRoundResult.player1Move}
                      </span>
                    </div>
                  </div>

                  {/* Outcome Highlight */}
                  <h3 className="font-['Chakra_Petch'] text-2xl font-black uppercase">
                    {latestRoundResult.winner === 'DRAW' ? (
                      <span className="text-[#ffb000]">ROUND TIE // STALEMATE</span>
                    ) : (isPlayer1 && latestRoundResult.winner === 'PLAYER_1') ||
                      (!isPlayer1 && latestRoundResult.winner === 'PLAYER_2') ? (
                      <span className="text-[#33ff55] glow-green">YOU WON THIS ROUND!</span>
                    ) : (
                      <span className="text-[#ff5500] glow-orange">OPPONENT WON ROUND</span>
                    )}
                  </h3>
                  <p className="text-[11px] font-['Share_Tech_Mono'] text-[#9aa0a6] mt-1">
                    {latestRoundResult.outcomeReason?.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ----------------- RETRO CONTROL DECK / READY TOGGLE ----------------- */}
        <footer className="bg-[#1b2027] border-4 border-[#2c333e] rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-bezel-outer">
          <div className="flex items-center gap-3">
            {/* Video Mute Toggle */}
            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-xl btn-tactile cursor-pointer ${
                !isVideoEnabled ? 'text-[#ff5500] border-2 border-[#ff5500]' : 'text-[#cfc6b4]'
              }`}
              title={isVideoEnabled ? 'Mute Optical Video' : 'Unmute Optical Video'}
            >
              {isVideoEnabled ? <Camera size={18} /> : <CameraOff size={18} />}
            </button>

            {/* Audio Mute Toggle */}
            <button
              onClick={handleToggleAudio}
              className={`p-3 rounded-xl btn-tactile cursor-pointer ${
                !isAudioEnabled ? 'text-[#ff5500] border-2 border-[#ff5500]' : 'text-[#cfc6b4]'
              }`}
              title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
            >
              {isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          </div>

          {/* Central Arming / Ready Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleReady}
              disabled={!remotePlayer || hudPhase === 'COUNTDOWN' || hudPhase === 'SHOOT'}
              className={`px-10 py-3.5 rounded-xl font-['Chakra_Petch'] font-black text-sm tracking-widest uppercase transition-all cursor-pointer ${
                isReady
                  ? 'btn-tactile-green text-white shadow-[0_0_20px_rgba(51,255,85,0.6)]'
                  : !remotePlayer
                  ? 'bg-[#14171b] text-[#555d66] border border-[#2b323c] cursor-not-allowed opacity-60'
                  : 'btn-tactile-orange text-white shadow-[0_0_20px_rgba(255,107,53,0.5)]'
              }`}
            >
              {isReady ? 'ARMED // READY TO SHOOT' : 'CLICK TO ARM SYSTEM'}
            </button>
          </div>

          {/* Telemetry Status Readout */}
          <div className="text-right">
            <p className="text-[10px] text-[#9aa0a6] uppercase font-['Chakra_Petch'] font-bold">
              SYS STATUS
            </p>
            <p className="text-xs font-['VT323'] text-base tracking-wider text-[#33ff55]">
              {!remotePlayer
                ? 'WAITING PEER'
                : isReady && remotePlayer.ready
                ? 'SYNCHRONIZING TICK'
                : isReady
                ? 'ARMED // AWAITING OP2'
                : 'STANDBY // CLICK ARM'}
            </p>
          </div>
        </footer>
      </main>

      {/* ----------------- MATCH SUMMARY MODAL ----------------- */}
      {matchOverData && (
        <MatchSummaryModal
          data={matchOverData}
          isPlayer1={isPlayer1}
          onPlayAgain={handlePlayAgain}
          onLeave={onLeaveRoom}
        />
      )}
    </div>
  );
}
