const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} = require('../utils/generateToken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { logAlert } = require('../utils/alerting');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const addAuditLog = (user, action, details, ipAddress) => {
  if (!user.auditLogs) user.auditLogs = [];
  user.auditLogs.push({ action, details, ipAddress });
};

// @desc    Register new user
// @route   POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password } = req.body;
  const ipAddress = req.ip;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashToken(rawOtp);

    await User.create(
      [{
        name, email, password,
        providers: [{ providerType: 'local' }],
        otpHash, otpExpires: Date.now() + 10 * 60 * 1000,
        auditLogs: [{ action: 'ACCOUNT_CREATED', details: 'Local signup', ipAddress }],
      }],
      { session }
    );

    await sendVerificationEmail(email, name, rawOtp);
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, message: 'Account created! Please check your email for the verification code.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Registration error for ${email}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+otpHash +otpExpires +otpAttempts');

  if (!user || user.isVerified) {
    return res.status(400).json({ success: false, message: 'Invalid request or already verified.' });
  }

  if (user.otpAttempts >= 5) return res.status(403).json({ success: false, message: 'Too many attempts.' });
  if (!user.otpExpires || Date.now() > user.otpExpires) return res.status(400).json({ success: false, message: 'OTP expired.' });

  if (hashToken(otp.toString()) !== user.otpHash) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  addAuditLog(user, 'EMAIL_VERIFIED', 'Success', req.ip);
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;
  const user = await User.findOne({ email }).select('+password +sessions');

  if (!user || user.isLocked()) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or account locked.' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000;
      addAuditLog(user, 'ACCOUNT_LOCKED', 'Exceeded login attempts', ipAddress);
      logAlert('ACCOUNT_LOCKED', `User ${email} locked out`, ipAddress);
    }
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  if (!user.isVerified || !user.isActive) {
    return res.status(403).json({ success: false, message: 'Account disabled or unverified.' });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.sessions.push({
    tokenHash: hashToken(refreshToken),
    deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  
  user.lastLogin = new Date();
  addAuditLog(user, 'LOGGED_IN', 'Local login', ipAddress);
  await user.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);
  res.json({ success: true, accessToken, user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
};

// @desc    Refresh Token & Handle Replay Attacks
// @route   POST /api/auth/refresh
const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); } 
  catch (e) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

  const user = await User.findById(decoded.id).select('+sessions');
  const hashedRToken = hashToken(token);
  const sessionIndex = user.sessions.findIndex(s => s.tokenHash === hashedRToken);

  // TOKEN REPLAY ATTACK DETECTION
  if (sessionIndex === -1) {
    user.sessions = []; // Nuke entirely
    addAuditLog(user, 'TOKEN_REPLAY_ATTACK', 'Invalid refresh token used, wiped all specific sessions', req.ip);
    logAlert('TOKEN_REPLAY_ATTACK', `Invalid duplicate use of token on ${user.email}`, req.ip);
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Security breach detected. All sessions terminated.' });
  }

  // Issue new pair (Rotation)
  const newAccessToken = generateAccessToken(user._id, user.role);
  const newRefreshToken = generateRefreshToken(user._id);

  user.sessions[sessionIndex] = {
    tokenHash: hashToken(newRefreshToken),
    deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
  
  user.markModified('sessions');
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, newRefreshToken);

  res.json({ success: true, accessToken: newAccessToken });
};

// @desc    Logout
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const hashed = hashToken(token);
    await User.findByIdAndUpdate(req.user._id, { $pull: { sessions: { tokenHash: hashed } } });
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out.' });
};

// @desc    Get Me
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
};

// ─── OAuth Flows ───────────────────────────────────────────────────────────────

const handleOAuthLogin = async (req, res, providerName, extractionLogic) => {
  try {
    const { email, name, avatar, providerId, emailVerified } = await extractionLogic();

    if (!email) return res.status(400).json({ success: false, message: 'Provider did not return an email, which is required.' });
    if (!emailVerified) return res.status(400).json({ success: false, message: 'Email not verified by provider.' });

    let user = await User.findOne({ email }).select('+sessions');

    if (user) {
      if (!user.providers.some(p => p.providerType === providerName)) {
        user.providers.push({ providerType: providerName, providerId });
        addAuditLog(user, 'OAUTH_LINKED', `Linked ${providerName}`, req.ip);
      }
    } else {
      user = await User.create({
        name, email, avatar, isVerified: true,
        providers: [{ providerType: providerName, providerId }],
        auditLogs: [{ action: 'ACCOUNT_CREATED', details: `Created via ${providerName}`, ipAddress: req.ip }]
      });
    }

    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account deactivated' });

    const accessToken = generateAccessToken(user._id, user.role);
    const splitRToken = generateRefreshToken(user._id);
    
    user.sessions.push({
      tokenHash: hashToken(splitRToken),
      deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, splitRToken);
    res.json({ success: true, accessToken, user });
  } catch (err) {
    logger.error(`${providerName} login error: ` + err.message);
    res.status(401).json({ success: false, message: `${providerName} integration failed.` });
  }
};

const googleLogin = (req, res) => handleOAuthLogin(req, res, 'google', async () => {
  const ticket = await googleClient.verifyIdToken({ idToken: req.body.idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  return { email: p.email, name: p.name, avatar: p.picture, providerId: p.sub, emailVerified: p.email_verified };
});

const facebookLogin = (req, res) => handleOAuthLogin(req, res, 'facebook', async () => {
  const r = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${req.body.accessToken}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return { email: data.email, name: data.name, avatar: data?.picture?.data?.url, providerId: data.id, emailVerified: true }; // FB emails act as verified if returned
});

// ─── Forgot Password / OTP Flows ───────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const GENERIC_OK = { success: true, message: 'If email is known, a reset code was sent.' };
  
  const user = await User.findOne({ email }).select('+password +pwdResetOtpHash +pwdResetOtpExpires +pwdResetOtpAttempts');
  if (!user || !user.isVerified || !user.isActive) return res.json(GENERIC_OK);
  if (!user.password) {
    return res.status(400).json({ success: false, message: 'Your account is linked exclusively via an OAuth provider. Password reset is not available.' });
  }

  const rawOtp = crypto.randomInt(100000, 999999).toString();
  user.pwdResetOtpHash = hashToken(rawOtp);
  user.pwdResetOtpExpires = Date.now() + 10 * 60 * 1000;
  user.pwdResetOtpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(email, user.name, rawOtp);
  res.json(GENERIC_OK);
};

// Strict return of a true single-use database Token instead of JWT
const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+pwdResetOtpHash +pwdResetOtpExpires +pwdResetOtpAttempts +pwdResetTokenHash +pwdResetTokenExpires');
  if (!user) return res.status(400).json({ success: false, message: 'Invalid.' });

  if (user.pwdResetOtpAttempts >= 5 || Date.now() > user.pwdResetOtpExpires) {
    user.pwdResetOtpHash = undefined;
    return res.status(403).json({ success: false, message: 'OTP expired or locked. Request again.' });
  }

  if (hashToken(otp.toString()) !== user.pwdResetOtpHash) {
    user.pwdResetOtpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: 'Invalid code.' });
  }

  // Generate strong explicit temporary reset token
  const explicitToken = crypto.randomBytes(32).toString('hex');
  user.pwdResetTokenHash = hashToken(explicitToken);
  user.pwdResetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 mins to reset
  
  // Nuke OTP directly
  user.pwdResetOtpHash = undefined;
  user.pwdResetOtpExpires = undefined;
  user.pwdResetOtpAttempts = 0;
  addAuditLog(user, 'OTP_VERIFIED', 'Password reset code verified', req.ip);
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Verified. Promptly set a new password.', resetToken: explicitToken });
};

const resetPassword = async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  const user = await User.findOne({ email }).select('+password +sessions +pwdResetTokenHash +pwdResetTokenExpires');
  
  if (!user || Date.now() > user.pwdResetTokenExpires) {
    return res.status(400).json({ success: false, message: 'Reset token invalid or expired.' });
  }

  if (hashToken(resetToken) !== user.pwdResetTokenHash) {
    return res.status(400).json({ success: false, message: 'Rest token mismatch.' });
  }

  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) return res.status(400).json({ success: false, message: 'Cannot use current password.' });

  user.password = newPassword;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.sessions = []; // Global logout everywhere
  user.pwdResetTokenHash = undefined; // BURN TOKEN SINGLE USE
  user.pwdResetTokenExpires = undefined;

  addAuditLog(user, 'PASSWORD_CHANGED', 'Password reset globally', req.ip);
  await user.save();

  res.json({ success: true, message: 'Password reset successful!' });
};

// ─── Device Management Endpoints ───────────────────────────────────────────────

const getActiveSessions = async (req, res) => {
  const user = await User.findById(req.user._id).select('+sessions');
  const sessionsSafe = user.sessions.map(s => ({
    deviceId: s.deviceId,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.tokenHash === hashToken(req.cookies.refreshToken || '')
  }));
  res.json({ success: true, sessions: sessionsSafe });
};

const revokeSession = async (req, res) => {
  const sessionIdOrHash = req.params.id; // Just passing exact tokenHash to strip if we want
  // Depending on architecture, maybe map index, but since we just need an ID, tokenHash is a good unique id.
  const user = await User.findById(req.user._id).select('+sessions');
  user.sessions = user.sessions.filter(s => s.tokenHash !== sessionIdOrHash);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Device revoked.' });
};

const revokeAllSessions = async (req, res) => {
  const user = await User.findById(req.user._id).select('+sessions');
  user.sessions = [];
  addAuditLog(user, 'GLOBAL_SIGNOUT', 'Revoked all active sessions manually', req.ip);
  await user.save({ validateBeforeSave: false });
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'All active sessions globally revoked.' });
};

module.exports = {
  register, verifyOTP, login, logout, refreshToken, getMe,
  forgotPassword, verifyResetOtp, resetPassword,
  googleLogin, facebookLogin,
  getActiveSessions, revokeSession, revokeAllSessions
};
