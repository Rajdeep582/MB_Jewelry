const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      validate: {
        validator: function (v) {
          // Requires at least one letter, one number, and one special char
          return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(v);
        },
        message: 'Password must contain at least one letter, one number, and one special character'
      },
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'delivery'],
      default: 'user',
    },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    dispatchZone: { type: String, default: '' },
    addresses: [addressSchema],
    refreshToken: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0 },
    loginAttempts: { type: Number, required: true, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    userId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.userId) {
    this.userId = `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  if (!this.isModified('password')) return next();
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
userSchema.index({ userId: 1 }, { sparse: true, unique: true });

// Instance method to check if user is locked out
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model('User', userSchema);
