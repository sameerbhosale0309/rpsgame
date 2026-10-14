import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * 21 Hand Landmark Indices for Google MediaPipe Hands:
 * 0: WRIST
 * Thumb:  1 (CMC), 2 (MCP), 3 (IP), 4 (TIP)
 * Index:  5 (MCP), 6 (PIP), 7 (DIP), 8 (TIP)
 * Middle: 9 (MCP), 10 (PIP), 11 (DIP), 12 (TIP)
 * Ring:   13 (MCP), 14 (PIP), 15 (DIP), 16 (TIP)
 * Pinky:  17 (MCP), 18 (PIP), 19 (DIP), 20 (TIP)
 */

export const GESTURE = {
  ROCK: 'ROCK',
  PAPER: 'PAPER',
  SCISSORS: 'SCISSORS',
  UNKNOWN: 'UNKNOWN',
};

// Hand connection pairs for skeleton drawing
export const HAND_CONNECTIONS = [
  // Palm base
  [0, 1], [1, 2], [2, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Thumb
  [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

/**
 * Computes 3D Euclidean distance between two landmarks
 */
export function euclideanDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes angle at vertex B formed by vectors BA and BC in degrees (0 to 180)
 */
export function calculateJointAngle(pointA, pointB, pointC) {
  const v1 = {
    x: pointA.x - pointB.x,
    y: pointA.y - pointB.y,
    z: (pointA.z || 0) - (pointB.z || 0),
  };
  const v2 = {
    x: pointC.x - pointB.x,
    y: pointC.y - pointB.y,
    z: (pointC.z || 0) - (pointC.z || 0),
  };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Pure geometric check to determine if a non-thumb finger is extended
 * Invariant to rotation, orientation, and hand scale
 *
 * @param {Array} lm - 21 normalized landmarks
 * @param {number} mcp - Metacarpophalangeal index
 * @param {number} pip - Proximal interphalangeal index
 * @param {number} dip - Distal interphalangeal index
 * @param {number} tip - Fingertip index
 * @param {number} wrist - Wrist landmark index (default 0)
 * @returns {boolean}
 */
export function isFingerExtended(lm, mcp, pip, dip, tip, wrist = 0) {
  const distWristToTip = euclideanDistance(lm[wrist], lm[tip]);
  const distWristToPip = euclideanDistance(lm[wrist], lm[pip]);
  const distTipToMcp = euclideanDistance(lm[tip], lm[mcp]);
  const distPipToMcp = euclideanDistance(lm[pip], lm[mcp]);

  // Angle at the PIP joint (Straight finger is ~160-180 deg, curled is < 110 deg)
  const pipAngle = calculateJointAngle(lm[mcp], lm[pip], lm[tip]);

  // Conditions for an extended finger:
  // 1. Tip is further from wrist than PIP
  // 2. Tip is further from MCP than PIP is from MCP
  // 3. PIP joint angle is relatively straight (> 135 deg)
  const isDistanceExtended = distWristToTip > distWristToPip * 1.15;
  const isMcpExtended = distTipToMcp > distPipToMcp * 1.15;
  const isAngleStraight = pipAngle > 130;

  return (isDistanceExtended && isMcpExtended) || (isAngleStraight && isDistanceExtended);
}

/**
 * Geometric check for Thumb extension
 * When thumb is curled (Rock), thumb tip is tucked close to Index MCP (5) or Middle MCP (9)
 * When thumb is extended (Paper), tip is abducted far from palm center
 */
export function isThumbExtended(lm) {
  const distThumbTipToIndexMcp = euclideanDistance(lm[4], lm[5]);
  const distThumbTipToMiddleMcp = euclideanDistance(lm[4], lm[9]);
  const distThumbTipToPinkyMcp = euclideanDistance(lm[4], lm[17]);
  const distIndexMcpToPinkyMcp = euclideanDistance(lm[5], lm[17]); // Palm width reference

  // Angle of thumb IP joint
  const thumbIpAngle = calculateJointAngle(lm[2], lm[3], lm[4]);

  // If thumb tip is tucked across palm, distance to pinky MCP is small
  const isAbducted = distThumbTipToPinkyMcp > distIndexMcpToPinkyMcp * 1.05;
  const isAwayFromIndex = distThumbTipToIndexMcp > distIndexMcpToPinkyMcp * 0.55;

  return (isAbducted && isAwayFromIndex) || thumbIpAngle > 145;
}

/**
 * Classifies raw 21 hand landmarks into Rock, Paper, Scissors, or Unknown
 * Pure mathematical analysis with no arbitrary screen coordinates
 *
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {string} 'ROCK' | 'PAPER' | 'SCISSORS' | 'UNKNOWN'
 */
export function recognizeGestureFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return GESTURE.UNKNOWN;
  }

  // Evaluate extension of each finger
  const thumb = isThumbExtended(landmarks);
  const index = isFingerExtended(landmarks, 5, 6, 7, 8);
  const middle = isFingerExtended(landmarks, 9, 10, 11, 12);
  const ring = isFingerExtended(landmarks, 13, 14, 15, 16);
  const pinky = isFingerExtended(landmarks, 17, 18, 19, 20);

  // -------------------------------------------------------------
  // GESTURE 1: ROCK (Fist)
  // All 4 primary fingers curled tight into palm; thumb tucked across
  // -------------------------------------------------------------
  if (!index && !middle && !ring && !pinky) {
    return GESTURE.ROCK;
  }

  // -------------------------------------------------------------
  // GESTURE 2: PAPER (Open Palm)
  // All 4 primary fingers (and usually thumb) extended outward
  // -------------------------------------------------------------
  if (index && middle && ring && pinky) {
    return GESTURE.PAPER;
  }

  // -------------------------------------------------------------
  // GESTURE 3: SCISSORS (Peace / V-Sign)
  // Index and Middle are extended; Ring and Pinky are firmly curled
  // -------------------------------------------------------------
  if (index && middle && !ring && !pinky) {
    return GESTURE.SCISSORS;
  }

  // Ambiguous or unrecognized hand pose (e.g. thumbs up, pointing finger, shaka)
  return GESTURE.UNKNOWN;
}

/**
 * Rolling Frame Buffer for temporal smoothing and flicker prevention
 */
export class GestureStabilizer {
  constructor(bufferSize = 5, confidenceThreshold = 0.6) {
    this.bufferSize = bufferSize;
    this.confidenceThreshold = confidenceThreshold;
    this.buffer = [];
    this.lastStableGesture = GESTURE.UNKNOWN;
  }

  /**
   * Adds a new frame gesture and returns the stabilized mode
   * @param {string} rawGesture 
   * @returns {{ gesture: string, confidence: number }}
   */
  update(rawGesture) {
    this.buffer.push(rawGesture);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Count occurrences of each gesture in the rolling window
    const counts = {};
    for (const g of this.buffer) {
      counts[g] = (counts[g] || 0) + 1;
    }

    let maxCount = 0;
    let dominantGesture = GESTURE.UNKNOWN;

    for (const [gesture, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantGesture = gesture;
      }
    }

    const confidence = maxCount / this.buffer.length;

    // Apply majority threshold
    if (confidence >= this.confidenceThreshold) {
      this.lastStableGesture = dominantGesture;
      return { gesture: dominantGesture, confidence };
    }

    // Fall back to UNKNOWN or previous stable if confident
    return { gesture: this.lastStableGesture, confidence };
  }

  reset() {
    this.buffer = [];
    this.lastStableGesture = GESTURE.UNKNOWN;
  }
}

/**
 * Initializes Google MediaPipe HandLandmarker with CDN wasm assets
 * @returns {Promise<HandLandmarker>}
 */
export async function initializeHandLandmarker() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    return landmarker;
  } catch (error) {
    console.error('Failed to initialize MediaPipe HandLandmarker:', error);
    throw error;
  }
}

/**
 * Draws vintage 1980s Phosphor CRT Vector Wireframe & Telemetry onto the canvas
 */
export function drawHandSkeleton(ctx, landmarks, gesture, width, height) {
  if (!landmarks || landmarks.length === 0) return;

  ctx.save();

  // CRT Phosphor Color Palette (Phosphor Green #33ff55, Amber #ffb000, Crimson #ff3344)
  let vectorColor = '#33ff55'; // Standard 1980s Green Phosphor
  let glowColor = 'rgba(51, 255, 85, 0.7)';

  if (gesture === GESTURE.ROCK) {
    vectorColor = '#ff6b35'; // Cassette Orange
    glowColor = 'rgba(255, 107, 53, 0.75)';
  } else if (gesture === GESTURE.PAPER) {
    vectorColor = '#33ff55'; // Phosphor Green
    glowColor = 'rgba(51, 255, 85, 0.8)';
  } else if (gesture === GESTURE.SCISSORS) {
    vectorColor = '#ffb000'; // Amber CRT
    glowColor = 'rgba(255, 176, 0, 0.8)';
  }

  // 1. Draw Vector Connecting Lines (Oscilloscope style)
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = vectorColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;

  HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];

    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
  });

  // 2. Draw Digital CRT Joint Nodes (Crosshair dots & squares)
  landmarks.forEach((lm, index) => {
    const x = lm.x * width;
    const y = lm.y * height;
    const isFingertip = [4, 8, 12, 16, 20].includes(index);

    if (isFingertip) {
      // Draw crosshair ring at fingertips
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = vectorColor;
      ctx.fill();

      // Small crosshair lines
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  });

  // 3. Compute Bounding Box
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  landmarks.forEach((lm) => {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  });

  const pad = 20;
  const bx = Math.max(0, minX * width - pad);
  const by = Math.max(0, minY * height - pad);
  const bw = Math.min(width - bx, (maxX - minX) * width + pad * 2);
  const bh = Math.min(height - by, (maxY - minY) * height + pad * 2);

  // 4. Draw Industrial CRT Target Brackets
  const cornerSize = 16;
  ctx.lineWidth = 2;
  ctx.strokeStyle = vectorColor;
  ctx.shadowBlur = 8;

  // Bracket Corners
  ctx.beginPath();
  // Top-left
  ctx.moveTo(bx, by + cornerSize); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerSize, by);
  // Top-right
  ctx.moveTo(bx + bw - cornerSize, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerSize);
  // Bottom-left
  ctx.moveTo(bx, by + bh - cornerSize); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cornerSize, by + bh);
  // Bottom-right
  ctx.moveTo(bx + bw - cornerSize, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerSize);
  ctx.stroke();

  // 5. Telemetry Text Overlay (e.g. "OPT-TRK: 98.4% // CH-01")
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.fillStyle = vectorColor;
  ctx.fillText(`TRK-CH01 // X:${Math.round(bx)} Y:${Math.round(by)}`, bx, Math.max(16, by - 6));
  ctx.fillText(`SIG: [${gesture}]`, bx, by + bh + 14);

  ctx.restore();
}
