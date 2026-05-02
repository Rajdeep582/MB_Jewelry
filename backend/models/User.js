const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String, default: '' },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
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
      required: [
        function () {
          return this.providers?.some(p => p.providerType === 'local');
        },
        'Password is required for local accounts',
      ],
      validate: {
        validator: function (v) {
          if (!this.providers?.some(p => p.providerType === 'local')) return true;
          if (!v) return false;
          return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(v);
        },
        message: 'Password must be at least 8 characters and contain at least one letter, one number, and one special character',
      },
      select: false,
    },
    providers: [{
      providerType: { type: String, enum: ['local', 'google', 'facebook'], required: true },
      providerId: { type: String }, // e.g. google sub, facebook id
      _id: false,
    }],
    role: {
      type: String,
      enum: ['user', 'admin', 'delivery'],
      default: 'user',
    },
    phone: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    username: { type: String, unique: true, sparse: true, trim: true },
    alternateEmail: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'] },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false }
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    avatar: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    dispatchZone: { type: String, default: '' },
    addresses: [addressSchema],
    sessions: [{
      sessionId: { type: String, required: true },
      tokenHash: { type: String, required: true },
      deviceId: { type: String },
      deviceInfo: { type: String },
      ipAddress: { type: String },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      _id: false,
    }],
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0 },
    // Password-reset OTP (kept separate from registration OTP)
    pwdResetOtpHash: { type: String, select: false },
    pwdResetOtpExpires: { type: Date, select: false },
    pwdResetOtpAttempts: { type: Number, default: 0 },
    // Strict replacement for signed short-lived JWT strategy
    pwdResetTokenHash: { type: String, select: false },
    pwdResetTokenExpires: { type: Date, select: false },
    loginAttempts: { type: Number, required: true, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    userId: { type: String, unique: true, sparse: true },
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

userSchema.pre('save', async function (next) {
  if (!this.userId) {
    this.userId = `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for faster lookups
userSchema.index({ role: 1 });
userSchema.index({ otpHash: 1 });


// Instance method to check if user is locked out
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model('User', userSchema);
