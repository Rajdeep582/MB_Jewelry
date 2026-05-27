const DeliveryPartner = require('../models/DeliveryPartner');
const User = require('../models/User');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/generateToken');
const logger = require('../utils/logger');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/**
 * registerDP
 * @route  POST /api/dp-auth/register
 * @access Public
 *
 * Creates a new DeliveryPartner account in pending state (isApproved = false).
 * Account is not usable until admin calls assignDeliveryRole.
 *
 * CROSS-PORTAL CHECK:
 *   If the email is already in User or Admin collection → 403 WRONG_PORTAL.
 *   Each portal (user/admin/dp) is a separate collection — no shared accounts.
 *
 * DOES NOT send verification email — DP registration is approved manually by admin.
 */
const registerDP = async (req, res) => {
  const { name, email, password, phone, vehicleNumber, dispatchZone, gender, aadhaarNumber } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password required.' });
  }

  const existing = await DeliveryPartner.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  // Block if email belongs to another portal
  const emailLower = email.toLowerCase();
  if (await User.findOne({ email: emailLower }).lean()) {
    return res.status(403).json({ success: false, message: 'You are registered as Customer. Please login through the Customer portal.', code: 'WRONG_PORTAL' });
  }
  if (await Admin.findOne({ email: emailLower }).lean()) {
    return res.status(403).json({ success: false, message: 'You are registered as Admin. Please login through the Admin portal.', code: 'WRONG_PORTAL' });
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

/**
 * loginDP
 * @route  POST /api/dp-auth/login
 * @access Public
 *
 * Authenticates a delivery partner and issues access + refresh tokens.
 *
 * FLOW:
 *   1. Find DP by email; check isLocked() (5 failed attempts → 15 min lockout)
 *   2. Cross-portal check if not found → helpful WRONG_PORTAL message
 *   3. comparePassword → on fail, increment loginAttempts; lock at >= 5
 *   4. Guard: isActive=false → 403; isApproved=false → 403 (pending approval)
 *   5. Generate accessToken (15 min) + refreshToken (7 days)
 *   6. Prune expired sessions, push new session entry, save
 *   7. Set refreshToken in httpOnly cookie; return accessToken + user payload
 *
 * SESSION MANAGEMENT:
 *   Refresh tokens are stored hashed (SHA-256) in dp.sessions array.
 *   refreshDP rotates the token on each silent refresh (single-use pattern).
 */
const loginDP = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }

  const dp = await DeliveryPartner.findOne({ email: email.toLowerCase() }).select('+password +sessions');
  if (!dp || dp.isLocked()) {
    if (!dp) {
      const emailLower = email.toLowerCase();
      if (await User.findOne({ email: emailLower }).lean()) {
        return res.status(403).json({ success: false, message: 'You are registered as Customer. Please login through the Customer portal.', code: 'WRONG_PORTAL' });
      }
      if (await Admin.findOne({ email: emailLower }).lean()) {
        return res.status(403).json({ success: false, message: 'You are registered as Admin. Please login through the Admin portal.', code: 'WRONG_PORTAL' });
      }
    }
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

/**
 * getMeDP
 * @route  GET /api/dp-auth/me
 * @access Delivery partner (authenticated)
 *
 * Returns the full DP document for the authenticated user.
 * Role field is injected as 'delivery' for frontend compatibility.
 */
const getMeDP = async (req, res) => {
  const dp = await DeliveryPartner.findById(req.user._id);
  if (!dp) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, user: { ...dp.toObject(), role: 'delivery' } });
};

/**
 * logoutDP
 * @route  POST /api/dp-auth/logout
 * @access Delivery partner (authenticated)
 *
 * Removes the current session's tokenHash from dp.sessions (server-side invalidation).
 * Clears the refreshToken httpOnly cookie.
 * After this, the refresh token is unusable even if an attacker has it.
 */
const logoutDP = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const hashed = hashToken(token);
    await DeliveryPartner.findByIdAndUpdate(req.user._id, {
      $pull: { sessions: { tokenHash: hashed } },
    });
  }
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'Logged out.' });
};

/**
 * refreshDP
 * @route  POST /api/dp-auth/refresh
 * @access Public (called silently by frontend when access token expires)
 *
 * Rotates the refresh token (single-use pattern):
 *   1. Verify JWT signature on the refresh token
 *   2. Confirm userType = 'delivery' (prevents user/admin tokens being used here)
 *   3. Hash the incoming token → find matching session in dp.sessions
 *   4. If not found → REPLAY ATTACK DETECTED → wipe all sessions → 401
 *   5. Replace session entry with new tokenHash (old token invalidated)
 *   6. Issue new accessToken + refreshToken, set cookie
 *
 * REPLAY ATTACK PROTECTION:
 *   If an old (already-rotated) refresh token is used, it won't exist in sessions.
 *   All sessions are wiped to force re-login. This covers token theft scenarios.
 */
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

/**
 * getProfileDP
 * @route  GET /api/dp-auth/profile
 * @access Delivery partner (authenticated)
 *
 * Returns the DP's profile with Aadhaar number masked (all digits except last 4 → 'X').
 * Aadhaar is stored in the DB but selected with +aadhaarNumber only here — not in getMeDP.
 * The masking ensures the raw number is never exposed via API response.
 */
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

/**
 * updateProfileDP
 * @route  PATCH /api/dp-auth/profile
 * @access Delivery partner (authenticated)
 *
 * Updates mutable DP profile fields. Only applies fields present in req.body.
 * Aadhaar number: spaces stripped before saving.
 * Name: trimmed + capped at 50 chars.
 * Email and isApproved cannot be changed through this endpoint.
 */
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

module.exports = { registerDP, loginDP, getMeDP, logoutDP, refreshDP, getProfileDP, updateProfileDP };
