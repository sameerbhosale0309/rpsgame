import Match from './models/Match.js';
import User from './models/User.js';

/**
 * In-memory room state storage
 * Map<roomCode, RoomState>
 */
const rooms = new Map();

/**
 * Game constants
 */
const DEFAULT_TARGET_SCORE = 3; // First to 3 points
const PREPARE_DURATION_MS = 3000;
const TICK_INTERVAL_MS = 1000;
const CAPTURE_WINDOW_MS = 600; // 500ms + 100ms network jitter buffer
const RECONNECT_GRACE_PERIOD_MS = 15000; // 15s to reconnect

/**
 * Generates an uppercase 6-character alphanumeric room code
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Evaluates round moves according to standard Rock-Paper-Scissors rules
 * @param {string} move1 
 * @param {string} move2 
 * @returns {{ winner: 'PLAYER_1'|'PLAYER_2'|'DRAW', reason: string }}
 */
function evaluateMoves(move1, move2) {
  const validMoves = ['ROCK', 'PAPER', 'SCISSORS'];
  const isP1Valid = validMoves.includes(move1);
  const isP2Valid = validMoves.includes(move2);

  // Case 1: Both failed to show valid gestures
  if (!isP1Valid && !isP2Valid) {
    return { winner: 'DRAW', reason: 'BOTH_NO_GESTURE' };
  }

  // Case 2: One player showed valid gesture, other failed
  if (isP1Valid && !isP2Valid) {
    return { winner: 'PLAYER_1', reason: 'PLAYER_2_NO_GESTURE' };
  }
  if (!isP1Valid && isP2Valid) {
    return { winner: 'PLAYER_2', reason: 'PLAYER_1_NO_GESTURE' };
  }

  // Case 3: Both showed same move
  if (move1 === move2) {
    return { winner: 'DRAW', reason: 'IDENTICAL_MOVES' };
  }

  // Case 4: Standard Rock-Paper-Scissors matrix
  const winConditions = {
    ROCK: 'SCISSORS',
    SCISSORS: 'PAPER',
    PAPER: 'ROCK',
  };

  if (winConditions[move1] === move2) {
    return { winner: 'PLAYER_1', reason: `${move1}_BEATS_${move2}` };
  } else {
    return { winner: 'PLAYER_2', reason: `${move2}_BEATS_${move1}` };
  }
}

/**
 * Main Socket.IO registration handler
 * @param {import('socket.io').Server} io 
 */
export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    let currentRoomCode = null;

    // -------------------------------------------------------------
    // ROOM MANAGEMENT
    // -------------------------------------------------------------

    /**
     * Create Room
     */
    socket.on('create-room', ({ username, userId = null, targetScore = DEFAULT_TARGET_SCORE }, callback) => {
      let roomCode = generateRoomCode();
      while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
      }

      const player = {
        socketId: socket.id,
        userId,
        username: username || `Player 1`,
        score: 0,
        ready: false,
        currentMove: null,
        isHost: true,
        connected: true,
      };

      const newRoom = {
        code: roomCode,
        players: [player],
        targetScore: Math.max(1, targetScore),
        currentRound: 0,
        gameState: 'WAITING_FOR_PEER', // WAITING_FOR_PEER | LOBBY | PREPARING | COUNTDOWN | CAPTURE | RESOLVING | MATCH_OVER
        roundHistory: [],
        timers: {},
        disconnectTimer: null,
        startTime: Date.now(),
      };

      rooms.set(roomCode, newRoom);
      currentRoomCode = roomCode;
      socket.join(roomCode);

      callback({ success: true, roomCode, playerIndex: 0 });
    });

    /**
     * Join Room
     */
    socket.on('join-room', ({ roomCode, username, userId = null }, callback) => {
      const code = (roomCode || '').toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        return callback({ success: false, message: 'Room not found. Check the 6-character code.' });
      }

      // Check if this is a reconnecting player
      const existingPlayer = room.players.find(
        (p) => (userId && p.userId === userId) || p.socketId === socket.id
      );

      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        currentRoomCode = code;
        socket.join(code);

        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
          io.to(code).emit('peer-reconnected', { username: existingPlayer.username });
        }

        return callback({
          success: true,
          roomCode: code,
          playerIndex: room.players.indexOf(existingPlayer),
          roomState: sanitizeRoomState(room),
        });
      }

      // Check if room is full
      if (room.players.length >= 2) {
        return callback({ success: false, message: 'Room is already full (2/2 players).' });
      }

      // Add Player 2
      const player = {
        socketId: socket.id,
        userId,
        username: username || `Player 2`,
        score: 0,
        ready: false,
        currentMove: null,
        isHost: false,
        connected: true,
      };

      room.players.push(player);
      room.gameState = 'LOBBY';
      currentRoomCode = code;
      socket.join(code);

      callback({
        success: true,
        roomCode: code,
        playerIndex: 1,
        roomState: sanitizeRoomState(room),
      });

      // Notify host that player 2 has joined to initiate WebRTC handshake
      socket.to(code).emit('peer-joined', {
        peer: {
          socketId: socket.id,
          username: player.username,
        },
        roomState: sanitizeRoomState(room),
      });

      io.to(code).emit('room-updated', sanitizeRoomState(room));
    });

    // -------------------------------------------------------------
    // WEBRTC SIGNALING RELAYS (P2P Handshake)
    // -------------------------------------------------------------

    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      socket.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer,
      });
    });

    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      socket.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      socket.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // -------------------------------------------------------------
    // GAMEPLAY & SYNCHRONIZED ROUND LIFECYCLE
    // -------------------------------------------------------------

    /**
     * Player clicks "Ready"
     */
    socket.on('player-ready', ({ ready }) => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.ready = Boolean(ready);
        io.to(currentRoomCode).emit('room-updated', sanitizeRoomState(room));

        // If both players are present and both ready, trigger round countdown
        const allReady = room.players.length === 2 && room.players.every((p) => p.ready);
        if (allReady && (room.gameState === 'LOBBY' || room.gameState === 'ROUND_OVER')) {
          startSynchronizedRound(room);
        }
      }
    });

    /**
     * Player submits detected gesture move during SHOOT lock window
     */
    socket.on('submit-move', ({ move }) => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room || room.gameState !== 'CAPTURE') return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (player && !player.currentMove) {
        // Enforce valid sanitized moves
        const validMoves = ['ROCK', 'PAPER', 'SCISSORS'];
        player.currentMove = validMoves.includes(move) ? move : 'UNKNOWN';
      }
    });

    /**
     * Restart match / Play Again
     */
    socket.on('play-again', () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      // Reset room stats for new match
      room.players.forEach((p) => {
        p.score = 0;
        p.ready = false;
        p.currentMove = null;
      });
      room.currentRound = 0;
      room.gameState = 'LOBBY';
      room.roundHistory = [];
      room.startTime = Date.now();

      io.to(currentRoomCode).emit('match-reset', sanitizeRoomState(room));
    });

    // -------------------------------------------------------------
    // DISCONNECTION & CLEANUP
    // -------------------------------------------------------------

    socket.on('disconnect', () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (!room) return;

      const leavingPlayer = room.players.find((p) => p.socketId === socket.id);
      if (leavingPlayer) {
        leavingPlayer.connected = false;

        // If match in progress, start grace period countdown for forfeit
        if (room.gameState !== 'MATCH_OVER' && room.players.length === 2) {
          io.to(currentRoomCode).emit('peer-disconnected', {
            username: leavingPlayer.username,
            gracePeriodMs: RECONNECT_GRACE_PERIOD_MS,
          });

          // Clear any active round timers
          clearRoomTimers(room);

          room.disconnectTimer = setTimeout(async () => {
            const activePlayer = room.players.find((p) => p.connected);
            if (activePlayer && room.gameState !== 'MATCH_OVER') {
              room.gameState = 'MATCH_OVER';
              const forfeitWinner = activePlayer.isHost ? 'PLAYER_1' : 'PLAYER_2';

              io.to(currentRoomCode).emit('match-ended', {
                finalWinner: forfeitWinner,
                winnerUsername: activePlayer.username,
                reason: 'OPPONENT_FORFEIT_DISCONNECT',
                roomState: sanitizeRoomState(room),
              });

              // Persist forfeit match
              await saveMatchRecord(room, forfeitWinner, activePlayer.username, 'FORFEITED');
            }
          }, RECONNECT_GRACE_PERIOD_MS);
        } else {
          // If lobby or waiting, just notify and cleanup if empty
          io.to(currentRoomCode).emit('peer-left', { username: leavingPlayer.username });
        }

        // If all players disconnected, clean up room from memory
        const anyConnected = room.players.some((p) => p.connected);
        if (!anyConnected) {
          clearRoomTimers(room);
          rooms.delete(currentRoomCode);
        }
      }
    });
  });

  // -------------------------------------------------------------
  // AUTHORITATIVE ROUND EXECUTION HELPERS
  // -------------------------------------------------------------

  /**
   * Orchestrates Prepare -> 3-2-1 -> SHOOT -> Capture -> Resolve -> Next
   */
  function startSynchronizedRound(room) {
    clearRoomTimers(room);
    room.currentRound += 1;
    room.gameState = 'PREPARING';

    // Reset player moves and ready flags
    room.players.forEach((p) => {
      p.currentMove = null;
      p.ready = false;
    });

    // 1. Prepare phase
    io.to(room.code).emit('round-preparing', {
      roundNumber: room.currentRound,
      durationMs: PREPARE_DURATION_MS,
      message: 'Get ready! Show your hand to the camera...',
    });

    // 2. Countdown phase starts after prepare timer
    room.timers.prepare = setTimeout(() => {
      room.gameState = 'COUNTDOWN';
      let count = 3;

      const countdownInterval = setInterval(() => {
        if (count > 0) {
          io.to(room.code).emit('round-tick', { count });
          count -= 1;
        } else {
          clearInterval(countdownInterval);
          triggerShootAndCapture(room);
        }
      }, TICK_INTERVAL_MS);

      room.timers.countdown = countdownInterval;
    }, PREPARE_DURATION_MS);
  }

  /**
   * Triggers SHOOT! event and opens authoritative capture window
   */
  function triggerShootAndCapture(room) {
    room.gameState = 'CAPTURE';

    // Broadcast synchronized SHOOT trigger with timestamp
    io.to(room.code).emit('round-shoot', {
      serverTimestamp: Date.now(),
      captureWindowMs: CAPTURE_WINDOW_MS,
    });

    // Close capture window after CAPTURE_WINDOW_MS and resolve
    room.timers.capture = setTimeout(() => {
      resolveRoundMoves(room);
    }, CAPTURE_WINDOW_MS);
  }

  /**
   * Authoritatively evaluates moves, updates scores, checks win condition
   */
  async function resolveRoundMoves(room) {
    room.gameState = 'RESOLVING';

    const p1 = room.players[0];
    const p2 = room.players[1];

    const p1Move = p1.currentMove || 'TIMEOUT';
    const p2Move = p2.currentMove || 'TIMEOUT';

    const result = evaluateMoves(p1Move, p2Move);

    if (result.winner === 'PLAYER_1') {
      p1.score += 1;
    } else if (result.winner === 'PLAYER_2') {
      p2.score += 1;
    }

    const roundData = {
      roundNumber: room.currentRound,
      player1Move: p1Move,
      player2Move: p2Move,
      winner: result.winner,
      outcomeReason: result.reason,
      timestamp: new Date(),
    };

    room.roundHistory.push(roundData);

    // Broadcast outcome to both clients
    io.to(room.code).emit('round-result', {
      roundData,
      scores: {
        player1: p1.score,
        player2: p2.score,
      },
      winner: result.winner,
      outcomeReason: result.reason,
    });

    // Check if match won
    const target = room.targetScore;
    const isP1Won = p1.score >= target;
    const isP2Won = p2.score >= target;

    if (isP1Won || isP2Won) {
      room.gameState = 'MATCH_OVER';
      const finalWinner = isP1Won ? 'PLAYER_1' : 'PLAYER_2';
      const winnerUsername = isP1Won ? p1.username : p2.username;

      io.to(room.code).emit('match-ended', {
        finalWinner,
        winnerUsername,
        finalScores: { player1: p1.score, player2: p2.score },
        roundHistory: room.roundHistory,
        roomState: sanitizeRoomState(room),
      });

      // Save complete match record to MongoDB
      await saveMatchRecord(room, finalWinner, winnerUsername, 'COMPLETED');
    } else {
      // Inter-round interval (4 seconds to view move badges before next round)
      room.gameState = 'ROUND_OVER';
      room.timers.nextRound = setTimeout(() => {
        // Automatically start next round if both players still connected
        if (room.players.every((p) => p.connected)) {
          startSynchronizedRound(room);
        }
      }, 4000);
    }
  }

  /**
   * Persists match document to MongoDB and updates User stats
   */
  async function saveMatchRecord(room, finalWinner, winnerUsername, status) {
    try {
      const p1 = room.players[0];
      const p2 = room.players[1];

      const durationSeconds = Math.round((Date.now() - (room.startTime || Date.now())) / 1000);

      const matchDoc = await Match.create({
        roomCode: room.code,
        player1: {
          userId: p1.userId || null,
          username: p1.username,
          score: p1.score,
        },
        player2: {
          userId: p2.userId || null,
          username: p2.username,
          score: p2.score,
        },
        targetScore: room.targetScore,
        rounds: room.roundHistory,
        totalRounds: room.roundHistory.length,
        finalWinner,
        winnerUsername,
        matchDurationSeconds: durationSeconds,
        status,
      });

      // Update User stats if registered users
      const p1Moves = room.roundHistory.map((r) => r.player1Move);
      const p2Moves = room.roundHistory.map((r) => r.player2Move);

      if (p1.userId) {
        const user1 = await User.findById(p1.userId);
        if (user1) {
          const outcome = finalWinner === 'PLAYER_1' ? 'WIN' : finalWinner === 'PLAYER_2' ? 'LOSS' : 'DRAW';
          await user1.recordMatchResult(outcome, p1Moves);
        }
      }

      if (p2.userId) {
        const user2 = await User.findById(p2.userId);
        if (user2) {
          const outcome = finalWinner === 'PLAYER_2' ? 'WIN' : finalWinner === 'PLAYER_1' ? 'LOSS' : 'DRAW';
          await user2.recordMatchResult(outcome, p2Moves);
        }
      }

      return matchDoc;
    } catch (err) {
      console.error('Failed to save match record to MongoDB:', err.message);
    }
  }

  /**
   * Clears all room countdown & capture timers
   */
  function clearRoomTimers(room) {
    if (room.timers.prepare) clearTimeout(room.timers.prepare);
    if (room.timers.countdown) clearInterval(room.timers.countdown);
    if (room.timers.capture) clearTimeout(room.timers.capture);
    if (room.timers.nextRound) clearTimeout(room.timers.nextRound);
    room.timers = {};
  }

  /**
   * Returns clean sanitized state for client consumption
   */
  function sanitizeRoomState(room) {
    return {
      code: room.code,
      gameState: room.gameState,
      targetScore: room.targetScore,
      currentRound: room.currentRound,
      players: room.players.map((p) => ({
        socketId: p.socketId,
        username: p.username,
        score: p.score,
        ready: p.ready,
        isHost: p.isHost,
        connected: p.connected,
      })),
      roundHistory: room.roundHistory,
    };
  }
}
