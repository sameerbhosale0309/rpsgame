import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import registerSocketHandlers from './socketHandler.js';
import Match from './models/Match.js';
import User from './models/User.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rpsgame';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_rps_jwt_key_2026';

// Middleware - Dynamic origin reflection to support credentials with any Vercel domain or localhost
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

// Register Socket.IO game and signaling handlers
registerSocketHandlers(io);

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Root status endpoint (useful for Render awake check and pinging)
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'rps-game-backend',
    message: 'Rock Paper Scissors Game Backend is running smoothly!',
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'rps-game-backend', timestamp: new Date() });
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, avatar } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const user = await User.create({ username: username.trim(), password, avatar });
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        stats: user.stats,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username?.trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        stats: user.stats,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch user match history
app.get('/api/matches/user/:usernameOrId', async (req, res) => {
  try {
    const { usernameOrId } = req.params;
    const history = await Match.getUserHistory(usernameOrId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch leaderboard and global statistics
app.get('/api/matches/stats', async (req, res) => {
  try {
    const topUsers = await User.find()
      .sort({ 'stats.wins': -1 })
      .limit(10)
      .select('username avatar stats');
    const globalStats = await Match.getGlobalStats();

    res.json({ topUsers, globalStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connect to MongoDB & Start Server
async function startServer() {
  try {
    if (MONGODB_URI) {
      await mongoose.connect(MONGODB_URI);
      console.log(' connected to MongoDB successfully.');
    }
  } catch (err) {
    console.warn('⚠️ MongoDB connection failed (running in in-memory room mode):', err.message);
  }

  server.listen(PORT, () => {
    console.log(`🚀 RPS Game Server running on port ${PORT}`);
  });
}

startServer();
