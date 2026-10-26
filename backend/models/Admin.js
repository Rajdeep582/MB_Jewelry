const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    // Forgot-password flow (utils/staffPasswordReset.js) — hashes only, single use
    pwdResetOtpHash:      { type: String, select: false },
    pwdResetOtpExpires:   { type: Date,   select: false },
    pwdResetOtpAttempts:  { type: Number, default: 0, select: false },
    pwdResetTokenHash:    { type: String, select: false },
    pwdResetTokenExpires: { type: Date,   select: false },
    pwdResetFails:        { type: Number, default: 0, select: false }, // wrong reset codes in the current 24 h window (utils/resetGuard.js)
    pwdResetFailsSince:   { type: Date,   select: false },
    lastLogin: { type: Date },
    sessions: [{
      sessionId: { type: String, required: true },
      tokenHash: { type: String, required: true },
      prevTokenHash: { type: String }, // previous refresh-token hash, honoured briefly after rotation
      rotatedAt: { type: Date },
      deviceId: { type: String },
      ipAddress: { type: String },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      _id: false,
    }],
    isEmailVerified:   { type: Boolean, default: false },
    emailOtpHash:      { type: String, select: false },
    emailOtpExpiry:    { type: Date,   select: false },
    // Brute-force guard: incremented on each wrong OTP attempt.
    // Locked at >= 5. Reset to 0 when correct OTP accepted or new OTP issued.
    emailOtpAttempts:  { type: Number, default: 0, select: false },
    // ── Login 2-step verification (email code after the password) ──
    loginOtpHash:       { type: String, select: false },
    loginOtpExpiry:     { type: Date,   select: false },
    loginOtpAttempts:   { type: Number, default: 0, select: false },
    loginChallengeHash: { type: String, select: false }, // proves the password step was passed
    adminId: { type: String, unique: true, sparse: true },
    auditLogs: [{
      action: String,
      ipAddress: String,
      timestamp: { type: Date, default: Date.now },
      details: String,
      _id: false,
    }],
  },
  { timestamps: true }
);

/**
 * pre('save') hook:
 *   1. Auto-generates adminId (ADM-XXXXXXXX) on first save
 *   2. Hashes password with bcrypt (cost 12) only if modified
 */
adminSchema.pre('save', async function (next) {
  if (!this.adminId) {
    this.adminId = `ADM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * comparePassword — bcrypt comparison of candidate against stored hash.
 */
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * isLocked — true if admin account is in 15-minute lockout (after 5 failed login attempts).
 */
adminSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model('Admin', adminSchema);
