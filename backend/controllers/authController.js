const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} = require('../utils/generateToken');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/email');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    const user = await User.create(
      [
        {
          name,
          email,
          password,
          otpHash,
          otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes strictly
        },
      ],
      { session }
    );

    await sendVerificationEmail(email, name, rawOtp);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for the 6-digit verification code.',
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Registration error for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message || 'Registration failed.' });
  }
};

// @desc    Verify 6-digit OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts');

  if (!user) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  if (user.isVerified) {
    return res.status(400).json({ success: false, message: 'User is already verified' });
  }

  // Check brute force attempts on OTP
  if (user.otpAttempts >= 5) {
    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(403).json({ success: false, message: 'Too many invalid attempts. Please request a new OTP.' });
  }

  // Check expiry
  if (!user.otpExpires || Date.now() > user.otpExpires) {
    return res.status(400).json({ success: false, message: 'OTP has expired' });
  }

  const inputHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');

  if (inputHash !== user.otpHash) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  // Success
  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshToken');
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (user.isLocked()) {
    return res.status(403).json({ success: false, message: 'Account locked due to too many failed attempts. Try again in 15 minutes.' });
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 mins
    }
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ success: false, message: 'Please verify your email address to log in' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been deactivated' });
  }

  // Success: Reset brute force lock
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);

  res.json({
    success: true,
    message: 'Login successful',
    accessToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    await User.findOneAndUpdate({ refreshToken: token }, { refreshToken: '' });
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (uses httpOnly cookie)
const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });
    sendRefreshTokenCookie(res, newRefreshToken);

    res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).select('-refreshToken');
  res.json({ success: true, user });
};

module.exports = { register, verifyOTP, login, logout, refreshToken, getMe };
