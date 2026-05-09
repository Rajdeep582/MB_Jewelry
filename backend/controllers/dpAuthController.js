const DeliveryPartner = require('../models/DeliveryPartner');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} = require('../utils/generateToken');
const logger = require('../utils/logger');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// @desc  Register delivery partner
// @route POST /api/dp-auth/register
const registerDP = async (req, res) => {
  const { name, email, password, phone, vehicleNumber, dispatchZone, gender, aadhaarNumber } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password required.' });
  }

  const existing = await DeliveryPartner.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  try {
    await DeliveryPartner.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '',
      vehicleNumber: vehicleNumber || '',
      dispatchZone: dispatchZone || '',
      gender: gender || '',
      aadhaarNumber: aadhaarNumber ? aadhaarNumber.replace(/\s/g, '') : '',
      auditLogs: [{ action: 'ACCOUNT_CREATED', details: 'DP self-registration', ipAddress: req.ip }],
    });
    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval.',
    });
  } catch (err) {
    logger.error(`DP registration error for ${email}: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? `Registration failed: ${err.message}` : 'Registration failed.',
    });
  }
};

// @desc  Login delivery partner
// @route POST /api/dp-auth/login
const loginDP = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }

  const dp = await DeliveryPartner.findOne({ email: email.toLowerCase() }).select('+password +sessions');
  if (!dp || dp.isLocked()) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or account locked.' });
  }

  const isMatch = await dp.comparePassword(password);
  if (!isMatch) {
    dp.loginAttempts += 1;
    if (dp.loginAttempts >= 5) {
      dp.lockUntil = Date.now() + 15 * 60 * 1000;
    }
    await dp.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  if (!dp.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated.' });
  }

  if (!dp.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending admin approval. Please wait.',
    });
  }

  dp.loginAttempts = 0;
  dp.lockUntil = undefined;

  const accessToken  = generateAccessToken(dp._id, 'delivery', 'delivery');
  const refreshToken = generateRefreshToken(dp._id, 'delivery');

  dp.sessions = (dp.sessions || []).filter(s => s.expiresAt > new Date());
  dp.sessions.push({
    sessionId: crypto.randomUUID(),
    tokenHash: hashToken(refreshToken),
    deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  dp.lastLogin = new Date();
  await dp.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);
  res.json({
    success: true,
    accessToken,
    user: {
      _id: dp._id,
      name: dp.name,
      email: dp.email,
      role: 'delivery',
      avatar: dp.avatar,
      phone: dp.phone,
      vehicleNumber: dp.vehicleNumber,
      dispatchZone: dp.dispatchZone,
    },
  });
};

// @desc  Get current DP profile
// @route GET /api/dp-auth/me
const getMeDP = async (req, res) => {
  const dp = await DeliveryPartner.findById(req.user._id);
  if (!dp) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, user: { ...dp.toObject(), role: 'delivery' } });
};

// @desc  Logout delivery partner
// @route POST /api/dp-auth/logout
const logoutDP = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const hashed = hashToken(token);
    await DeliveryPartner.findByIdAndUpdate(req.user._id, {
      $pull: { sessions: { tokenHash: hashed } },
    });
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out.' });
};

// @desc  Refresh access token for DP
// @route POST /api/dp-auth/refresh
const refreshDP = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  // Only handle delivery userType here
  if (decoded.userType !== 'delivery') {
    return res.status(401).json({ success: false, message: 'Invalid token type' });
  }

  const dp = await DeliveryPartner.findById(decoded.id).select('+sessions');
  if (!dp) return res.status(401).json({ success: false, message: 'Not found' });

  dp.sessions = dp.sessions.filter(s => s.expiresAt > new Date());
  const hashedRToken = hashToken(token);
  const idx = dp.sessions.findIndex(s => s.tokenHash === hashedRToken);

  if (idx === -1) {
    dp.sessions = [];
    await dp.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Security breach detected.' });
  }

  const newAccessToken  = generateAccessToken(dp._id, 'delivery', 'delivery');
  const newRefreshToken = generateRefreshToken(dp._id, 'delivery');

  dp.sessions[idx] = {
    sessionId: dp.sessions[idx].sessionId,
    tokenHash: hashToken(newRefreshToken),
    deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  dp.markModified('sessions');
  await dp.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, newRefreshToken);
  res.json({ success: true, accessToken: newAccessToken });
};

module.exports = { registerDP, loginDP, getMeDP, logoutDP, refreshDP };

// @desc  Get DP profile (includes aadhaar masked)
// @route GET /api/dp-auth/profile
const getProfileDP = async (req, res) => {
  const dp = await require('../models/DeliveryPartner').findById(req.user._id).select('+aadhaarNumber');
  if (!dp) return res.status(404).json({ success: false, message: 'Not found' });
  const masked = dp.aadhaarNumber
    ? dp.aadhaarNumber.replace(/\d(?=\d{4})/g, 'X')
    : '';
  res.json({
    success: true,
    profile: {
      name: dp.name,
      email: dp.email,
      phone: dp.phone,
      gender: dp.gender,
      vehicleNumber: dp.vehicleNumber,
      dispatchZone: dp.dispatchZone,
      aadhaarMasked: masked,
      isApproved: dp.isApproved,
      partnerId: dp.partnerId,
      avatar: dp.avatar,
      createdAt: dp.createdAt,
    },
  });
};

// @desc  Update DP profile fields
// @route PATCH /api/dp-auth/profile
const updateProfileDP = async (req, res) => {
  const { name, phone, gender, vehicleNumber, dispatchZone, aadhaarNumber } = req.body;
  const dp = await require('../models/DeliveryPartner').findById(req.user._id).select('+aadhaarNumber');
  if (!dp) return res.status(404).json({ success: false, message: 'Not found' });
  if (name !== undefined && name.trim())    dp.name = name.trim().slice(0, 50);
  if (phone !== undefined)                  dp.phone = phone;
  if (gender !== undefined)                 dp.gender = gender;
  if (vehicleNumber !== undefined)          dp.vehicleNumber = vehicleNumber;
  if (dispatchZone !== undefined)           dp.dispatchZone = dispatchZone;
  if (aadhaarNumber !== undefined)          dp.aadhaarNumber = aadhaarNumber.replace(/\s/g, '');
  await dp.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Profile updated.' });
};

module.exports = { ...module.exports, getProfileDP, updateProfileDP };
