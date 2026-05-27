const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const deliveryPartnerSchema = new mongoose.Schema(
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
    phone: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    dispatchZone: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    aadhaarNumber: { type: String, default: '', select: false }, // stored, not returned by default
    avatar: { type: String, default: '' },
    // Admin approval — DP can register but cannot log in until approved
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // OTP fields (for future email verification if needed)
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0 },
    // Login security
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    sessions: [{
      sessionId: { type: String, required: true },
      tokenHash: { type: String, required: true },
      deviceId: { type: String },
      ipAddress: { type: String },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      _id: false,
    }],
    // Unique identifier
    partnerId: { type: String, unique: true, sparse: true },
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
 *   1. Auto-generates partnerId (DP-XXXXXXXX) on first save if not set
 *   2. Hashes password with bcrypt (cost 12) only if modified
 *      → skips re-hash if only other fields changed (e.g. profile update)
 */
deliveryPartnerSchema.pre('save', async function (next) {
  if (!this.partnerId) {
    this.partnerId = `DP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * comparePassword — bcrypt comparison of candidate against stored hash.
 * `password` field is `select: false` → caller must explicitly select it
 * before calling this method (e.g. `.select('+password')`).
 */
deliveryPartnerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * isLocked — true if DP account is in 15-minute lockout (after 5 failed login attempts).
 * Automatically resolves when lockUntil passes — no manual reset needed.
 */
deliveryPartnerSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

deliveryPartnerSchema.index({ isApproved: 1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
