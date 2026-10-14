# AI Motion Rock-Paper-Scissors (Real-Time 1v1 P2P Video Battle)

A real-time, peer-to-peer 1v1 multiplayer web game where players battle in Rock-Paper-Scissors using their webcams and computer vision hand tracking.

---

## Architecture Overview

```
                                      +--------------------------+
                                      |   Socket.IO & Express    |
                                      |      Backend Server      |
                                      |  (Port 5000 / Authoritative)
                                      +-------------+------------+
                                                    |
                         +--------------------------+--------------------------+
                         | Signaling & Room Sync                               | Signaling & Room Sync
                         v                                                     v
            +-------------------------+                           +-------------------------+
            |      Player 1 (Host)    | <======= WebRTC ========> |    Player 2 (Challenger)|
            |  React + MediaPipe P2P  |        Direct Video       |  React + MediaPipe P2P  |
            +-------------------------+          Stream           +-------------------------+
                         |                                                     |
                         |                                                     |
            +-------------------------+                           +-------------------------+
            |  Client-Side MediaPipe  |                           |  Client-Side MediaPipe  |
            |   21-Landmark Vector    |                           |   21-Landmark Vector    |
            |   Geometric Classifier  |                           |   Geometric Classifier  |
            +-------------------------+                           +-------------------------+
```

---

## Key Features & Production Modules

1. **Pure Geometric Computer Vision (`gestureRecognizer.js`)**:
   - Analyzes all 21 Google MediaPipe 3D landmarks invariant to rotation, tilt, or camera distance.
   - Computes Euclidean joint distances ($d(\text{wrist}, \text{tip}) / d(\text{wrist}, \text{pip})$) and joint angles at PIP joints.
   - Detects **Rock** (all 4 curled inwards, thumb folded), **Paper** (all 5 extended outward), and **Scissors** (index + middle extended, ring + pinky curled).
   - Incorporates a **5-frame rolling FIFO buffer** with majority voting for stabilization and zero flicker.

2. **Split-Screen Cyberpunk Arena (`GameRoom.jsx`)**:
   - Mirrored local video stream with a live `<canvas>` drawing glowing cyberpunk neon skeletons and reticle bounding boxes.
   - Peer-to-peer remote video stream over WebRTC.
   - Centered HUD displaying synchronized countdown (`3... 2... 1... SHOOT!`), move reveal badges, and round outcomes.
   - Synthesized Web Audio API sound effects (countdown beeps, shoot gong, victory fanfare, defeat buzz) with zero external audio assets needed.

3. **Authoritative Socket.IO Game Engine (`socketHandler.js`)**:
   - 6-character room codes (`ABC123`).
   - WebRTC signaling relays (`webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`).
   - Authoritative game loop: `PREPARING` (3s) -> `COUNTDOWN` (3-2-1) -> `SHOOT` (500ms lock window) -> `RESOLVING` -> `ROUND_OVER`.
   - Handles edge cases: grace periods on disconnect (15s reconnect timer before forfeit), camera permission errors, forfeit wins, and room memory cleanup.

4. **MongoDB Match History & Stats (`models/Match.js` & `models/User.js`)**:
   - Complete match logs: room code, players, round-by-round moves, outcome reasons, and durations.
   - User statistics: wins, losses, draws, and move distribution.

---

## Directory Structure

```
rpsgame/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── server.js                # Express REST API & Socket.IO server
│   ├── socketHandler.js         # Room manager, WebRTC signaling & authoritative game loop
│   └── models/
│       ├── Match.js             # Mongoose match history & stats schema
│       └── User.js              # User auth & profile stats schema
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── GameRoom.jsx     # Split video feeds, canvas skeleton, synchronized HUD
│       │   ├── Lobby.jsx        # Room creation / join with 6-char code
│       │   └── MatchSummaryModal.jsx # Victory/defeat trophy with confetti & recap
│       ├── hooks/
│       │   ├── useWebRTC.js     # Native RTCPeerConnection manager
│       │   └── useSoundEffects.js # Web Audio API sound synthesizer
│       └── utils/
│           ├── gestureRecognizer.js # Pure geometric MediaPipe classifier + stabilizer
│           └── socket.js        # Socket.IO client instance
└── README.md
```

---

## Quickstart & Setup Guide

### 1. Prerequisites
- Node.js v18+ and npm installed.
- (Optional) MongoDB running locally on `mongodb://localhost:27017` or MongoDB Atlas URI. *Note: If MongoDB is not running, the backend runs gracefully in in-memory room mode.*

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm start
```
*Backend runs on `http://localhost:5000`.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### 4. How to Play
1. Open `http://localhost:5173` in Browser 1. Enter your name and click **Create Game Room**.
2. Note the 6-character room code (e.g. `ABC123`).
3. Open `http://localhost:5173` in Browser 2 (or an incognito window / second device). Enter a name, paste the room code, and click **Join**.
4. Both players allow camera permissions. Both players click **"Click When Ready"**.
5. When the countdown reaches **"SHOOT!"**, throw Rock, Paper, or Scissors!
