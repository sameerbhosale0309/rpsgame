import mongoose from 'mongoose';

/**
 * Single round result sub-document schema
 */
const RoundSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true,
  },
  player1Move: {
    type: String,
    enum: ['ROCK', 'PAPER', 'SCISSORS', 'UNKNOWN', 'TIMEOUT'],
    required: true,
    default: 'UNKNOWN',
  },
  player2Move: {
    type: String,
    enum: ['ROCK', 'PAPER', 'SCISSORS', 'UNKNOWN', 'TIMEOUT'],
    required: true,
    default: 'UNKNOWN',
  },
  winner: {
    type: String,
    enum: ['PLAYER_1', 'PLAYER_2', 'DRAW'],
    required: true,
  },
  outcomeReason: {
    type: String,
    default: 'STANDARD_EVALUATION', // e.g., 'ROCK_BEATS_SCISSORS', 'DEFAULT_NO_HAND', 'TIE'
  },
  durationMs: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Complete Match document schema
 */
const MatchSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    player1: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      username: {
        type: String,
        required: true,
        trim: true,
      },
      score: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    player2: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      username: {
        type: String,
        required: true,
        trim: true,
      },
      score: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    targetScore: {
      type: Number,
      default: 3, // Best of 5 (first to 3)
      min: 1,
    },
    rounds: [RoundSchema],
    totalRounds: {
      type: Number,
      default: 0,
    },
    finalWinner: {
      type: String,
      enum: ['PLAYER_1', 'PLAYER_2', 'DRAW', 'FORFEIT_PLAYER_1', 'FORFEIT_PLAYER_2', 'IN_PROGRESS'],
      default: 'IN_PROGRESS',
    },
    winnerUsername: {
      type: String,
      default: null,
    },
    matchDurationSeconds: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FORFEITED'],
      default: 'IN_PROGRESS',
      index: true,
    },
  },
  {
    timestamps: true, // auto generates createdAt and updatedAt
  }
);

// Indexes for high performance querying
MatchSchema.index({ createdAt: -1 });
MatchSchema.index({ 'player1.username': 1 });
MatchSchema.index({ 'player2.username': 1 });

/**
 * Static method: Fetch recent matches for a specific user ID or username
 * @param {string} usernameOrId 
 * @param {number} limit 
 */
MatchSchema.statics.getUserHistory = async function (usernameOrId, limit = 10) {
  const isObjectId = mongoose.Types.ObjectId.isValid(usernameOrId);
  const query = isObjectId
    ? {
        $or: [
          { 'player1.userId': usernameOrId },
          { 'player2.userId': usernameOrId },
          { 'player1.username': usernameOrId },
          { 'player2.username': usernameOrId },
        ],
      }
    : {
        $or: [
          { 'player1.username': usernameOrId },
          { 'player2.username': usernameOrId },
        ],
      };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Static method: Aggregate global leaderboard stats
 */
MatchSchema.statics.getGlobalStats = async function () {
  const totalCompleted = await this.countDocuments({ status: 'COMPLETED' });
  const mostCommonMoves = await this.aggregate([
    { $unwind: '$rounds' },
    {
      $project: {
        moves: ['$rounds.player1Move', '$rounds.player2Move'],
      },
    },
    { $unwind: '$moves' },
    { $match: { moves: { $in: ['ROCK', 'PAPER', 'SCISSORS'] } } },
    { $group: { _id: '$moves', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    totalMatches: totalCompleted,
    moveDistribution: mostCommonMoves,
  };
};

const Match = mongoose.model('Match', MatchSchema);
export default Match;
