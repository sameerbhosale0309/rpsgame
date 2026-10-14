import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: 'robot', // robot, ninja, wizard, astronaut, etc.
    },
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      rockCount: { type: Number, default: 0 },
      paperCount: { type: Number, default: 0 },
      scissorsCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Increment player stats helper
UserSchema.methods.recordMatchResult = async function (outcome, moves = []) {
  if (outcome === 'WIN') this.stats.wins += 1;
  else if (outcome === 'LOSS') this.stats.losses += 1;
  else if (outcome === 'DRAW') this.stats.draws += 1;

  moves.forEach((m) => {
    if (m === 'ROCK') this.stats.rockCount += 1;
    if (m === 'PAPER') this.stats.paperCount += 1;
    if (m === 'SCISSORS') this.stats.scissorsCount += 1;
  });

  return this.save();
};

const User = mongoose.model('User', UserSchema);
export default User;
