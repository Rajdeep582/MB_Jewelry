const User = require('../models/User');
const Admin = require('../models/Admin');
const PendingMobileOtp = require('../models/PendingMobileOtp');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} = require('../utils/generateToken');
const crypto = require('node:crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { sendSmsOtp } = require('../utils/sms');
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isMobile = (val) => /^(\+91[-\s]?)?[6-9]\d{9}$/.test(val?.replace(/[-\s]/g, '') || '');
const isEmail  = (val) => /^\S+@\S+\.\S+$/.test(val || '');
const normaliseMobile = (m) => m.replace(/[-\s]/g, '').replace(/^\+91/, '').replace(/^91([6-9])/, '$1');

// @desc    Send OTP to mobile (pre-registration)
// @route   POST /api/auth/send-mobile-otp
const sendMobileOtp = async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !isMobile(mobile)) {
    return res.status(400).json({ success: false, message: 'Valid Indian mobile number required.' });
  }
  const norm = normaliseMobile(mobile);

  const existing = await User.findOne({ mobile: norm });
  if (existing) return res.status(400).json({ success: false, message: 'Mobile number already registered.' });

  const rawOtp = crypto.randomInt(100000, 999999).toString();
  // Upsert pending OTP (replace old if resend)
  await PendingMobileOtp.findOneAndUpdate(
    { mobile: norm },
    { mobile: norm, otpHash: hashToken(rawOtp), attempts: 0, createdAt: new Date() },
    { upsert: true, new: true }
  );

  await sendSmsOtp(norm, rawOtp);
  res.json({ success: true, message: 'OTP sent to your mobile number.' });
};

// @desc    Register new user (email or mobile)
// @route   POST /api/auth/register
const register = async (req, res) => {
  const { name, email, mobile, password, otp } = req.body;
  const ipAddress = req.ip;

  // ── Mobile registration ──────────────────────────────────────────────────
  if (mobile) {
    const norm = normaliseMobile(mobile);

    const pending = await PendingMobileOtp.findOne({ mobile: norm });
    if (!pending) return res.status(400).json({ success: false, message: 'OTP not sent or expired. Request a new one.' });
    if (pending.attempts >= 5) return res.status(403).json({ success: false, message: 'Too many attempts. Request a new OTP.' });

    if (hashToken(otp?.toString()) !== pending.otpHash) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    const existing = await User.findOne({ mobile: norm });
    if (existing) return res.status(400).json({ success: false, message: 'Mobile already registered.' });

    try {
      await User.create({
        name, mobile: norm, password,
        providers: [{ providerType: 'mobile' }],
        isVerified: true, mobileVerified: true,
        auditLogs: [{ action: 'ACCOUNT_CREATED', details: 'Mobile OTP signup', ipAddress }],
      });
      await PendingMobileOtp.deleteOne({ mobile: norm });
      return res.status(201).json({ success: true, message: 'Account created! You can now log in.' });
    } catch (err) {
      logger.error(`Mobile registration error for ${norm}: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Registration failed.' });
    }
  }

  // ── Email registration ───────────────────────────────────────────────────
  if (!email) return res.status(400).json({ success: false, message: 'Email or mobile required.' });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });

  const session = await mongoose.startSession();
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
    res.status(201).json({ success: true, message: 'Account created! Please check your email for the verification code.' });
  } catch (error) {
    logger.error(`Registration error for ${email}: ${error.message} | stack: ${error.stack}`);
    // Clean up orphaned user if email send failed
    await User.deleteOne({ email }, { session }).catch(() => {});
    return res.status(500).json({ success: false, message: process.env.NODE_ENV === 'development' ? `Registration failed: ${error.message}` : 'Registration failed. Please try again.' });
  } finally {
    session.endSession();
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

// @desc    Login user (email or mobile)
// @route   POST /api/auth/login
const login = async (req, res) => {
  const { identifier, password } = req.body; // identifier = email or mobile
  const ipAddress = req.ip;

  const query = isMobile(identifier)
    ? { mobile: normaliseMobile(identifier) }
    : { email: identifier?.toLowerCase()?.trim() };

  const user = await User.findOne(query).select('+password +sessions');

  if (!user || user.isLocked()) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or account locked.' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000;
      addAuditLog(user, 'ACCOUNT_LOCKED', 'Exceeded login attempts', ipAddress);
      logAlert('ACCOUNT_LOCKED', `User ${identifier} locked out`, ipAddress);
    }
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  if (!user.isVerified || !user.isActive) {
    return res.status(403).json({ success: false, message: 'Account disabled or unverified.' });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  
  // Delivery partners must use /dp-auth/login
  if (user.role === 'delivery') {
    return res.status(403).json({ success: false, message: 'Please use the delivery partner login page.' });
  }

  // Admin: look up in Admin collection to get correct _id for token
  if (user.role === 'admin') {
    const adminRecord = await Admin.findOne({ email: user.email }).select('+sessions');
    if (!adminRecord || !adminRecord.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account not found. Contact support.' });
    }
    const accessToken = generateAccessToken(adminRecord._id, 'admin', 'admin');
    const refreshToken = generateRefreshToken(adminRecord._id, 'admin');

    adminRecord.sessions = (adminRecord.sessions || []).filter(s => s.expiresAt > new Date());
    adminRecord.sessions.push({
      sessionId: crypto.randomUUID(),
      tokenHash: hashToken(refreshToken),
      deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
      ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    adminRecord.lastLogin = new Date();
    await adminRecord.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, refreshToken);
    return res.json({
      success: true,
      accessToken,
      user: { _id: adminRecord._id, name: adminRecord.name, email: adminRecord.email, role: 'admin', avatar: adminRecord.avatar },
    });
  }

  const accessToken = generateAccessToken(user._id, user.role, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.sessions = user.sessions.filter(s => s.expiresAt > new Date());

  user.sessions.push({
    sessionId: crypto.randomUUID(),
    tokenHash: hashToken(refreshToken),
    deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  user.lastLogin = new Date();
  addAuditLog(user, 'LOGGED_IN', 'Local login', ipAddress);
  await user.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);
  res.json({ success: true, accessToken, user: { _id: user._id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, avatar: user.avatar } });
};

// @desc    Refresh Token & Handle Replay Attacks
// @route   POST /api/auth/refresh
const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
  catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

  // Delivery tokens must use /dp-auth/refresh
  if (decoded.userType === 'delivery') {
    return res.status(401).json({ success: false, message: 'Invalid token for this endpoint' });
  }

  // Admin token — query Admin collection
  if (decoded.userType === 'admin') {
    const admin = await Admin.findById(decoded.id).select('+sessions');
    if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });
    admin.sessions = (admin.sessions || []).filter(s => s.expiresAt > new Date());
    const hashedR = hashToken(token);
    const idx = admin.sessions.findIndex(s => s.tokenHash === hashedR);
    if (idx === -1) {
      admin.sessions = [];
      await admin.save({ validateBeforeSave: false });
      return res.status(401).json({ success: false, message: 'Security breach detected. All sessions terminated.' });
    }
    const newAccess  = generateAccessToken(admin._id, 'admin', 'admin');
    const newRefresh = generateRefreshToken(admin._id, 'admin');
    admin.sessions[idx] = {
      sessionId: admin.sessions[idx].sessionId,
      tokenHash: hashToken(newRefresh),
      deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    admin.markModified('sessions');
    await admin.save({ validateBeforeSave: false });
    sendRefreshTokenCookie(res, newRefresh);
    return res.json({ success: true, accessToken: newAccess });
  }

  // Normal user token
  const user = await User.findById(decoded.id).select('+sessions');
  if (!user) return res.status(401).json({ success: false, message: 'User not found' });
  user.sessions = user.sessions.filter(s => s.expiresAt > new Date());

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
  const newAccessToken = generateAccessToken(user._id, user.role, 'user');
  const newRefreshToken = generateRefreshToken(user._id, 'user');

  user.sessions[sessionIndex] = {
    sessionId: user.sessions[sessionIndex].sessionId,
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
    const Model = req.userType === 'admin' ? Admin : User;
    await Model.findByIdAndUpdate(req.user._id, { $pull: { sessions: { tokenHash: hashed } } });
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out.' });
};

// @desc    Get Me
const getMe = async (req, res) => {
  // req.user is already populated by protect middleware from the correct model
  res.json({ success: true, user: req.user });
};

// ─── OAuth Flows ───────────────────────────────────────────────────────────────

const handleOAuthLogin = async (req, res, providerName, extractionLogic) => {
  try {
    const { email, name, avatar, providerId, emailVerified } = await extractionLogic();

    if (!email) return res.status(400).json({ success: false, message: 'Provider did not return an email, which is required.' });
    if (!emailVerified) return res.status(400).json({ success: false, message: 'Email not verified by provider.' });

    let user = await User.findOne({ email: String(email) }).select('+sessions');

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

    // Admin: route to Admin collection for correct _id + userType
    if (user.role === 'admin') {
      const adminRecord = await Admin.findOne({ email: user.email }).select('+sessions');
      if (!adminRecord || !adminRecord.isActive) {
        return res.status(403).json({ success: false, message: 'Admin record not found. Contact support.' });
      }
      const accessToken = generateAccessToken(adminRecord._id, 'admin', 'admin');
      const splitRToken = generateRefreshToken(adminRecord._id, 'admin');
      adminRecord.sessions = (adminRecord.sessions || []).filter(s => s.expiresAt > new Date());
      adminRecord.sessions.push({
        sessionId: crypto.randomUUID(),
        tokenHash: hashToken(splitRToken),
        deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      adminRecord.lastLogin = new Date();
      await adminRecord.save({ validateBeforeSave: false });
      sendRefreshTokenCookie(res, splitRToken);
      return res.json({ success: true, accessToken, user: { _id: adminRecord._id, name: adminRecord.name, email: adminRecord.email, role: 'admin', avatar: adminRecord.avatar } });
    }

    const accessToken = generateAccessToken(user._id, user.role, 'user');
    const splitRToken = generateRefreshToken(user._id, 'user');

    user.sessions.push({
      sessionId: crypto.randomUUID(),
      tokenHash: hashToken(splitRToken),
      deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, splitRToken);
    res.json({ success: true, accessToken, user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
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

// ─── Forgot Password / OTP Flows ───────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const GENERIC_OK = { success: true, message: 'If email is known, a reset code was sent.' };
  
  const user = await User.findOne({ email }).select('+password +pwdResetOtpHash +pwdResetOtpExpires +pwdResetOtpAttempts');
  if (!user?.isVerified || !user?.isActive) return res.json(GENERIC_OK);
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
  const now = new Date();
  const before = user.sessions.length;
  user.sessions = user.sessions.filter(s => s.expiresAt > now);
  if (user.sessions.length !== before) {
    await user.save({ validateBeforeSave: false });
  }
  const sessionsSafe = user.sessions.map(s => ({
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.tokenHash === hashToken(req.cookies.refreshToken || '')
  }));
  res.json({ success: true, sessions: sessionsSafe });
};

const revokeSession = async (req, res) => {
  const targetSessionId = req.params.id;
  const user = await User.findById(req.user._id).select('+sessions');
  const before = user.sessions.length;
  user.sessions = user.sessions.filter(s => s.sessionId !== targetSessionId);
  if (user.sessions.length === before) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }
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

// @desc    Add/update email for mobile-registered user (sends verification email)
// @route   POST /api/auth/add-email  (protected)
const addEmail = async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Valid email required.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing && String(existing._id) !== String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'Email already in use.' });
  }

  const user = await User.findById(req.user._id).select('+otpHash +otpExpires');
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  user.email = email.toLowerCase();
  user.isVerified = false; // require email verify
  user.otpHash = hashToken(rawOtp);
  user.otpExpires = Date.now() + 10 * 60 * 1000;
  user.otpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(email, user.name, rawOtp);
  res.json({ success: true, message: 'Verification email sent. Enter the code to confirm.' });
};

// @desc    Verify email OTP (for add-email flow on profile)
// @route   POST /api/auth/verify-email-otp (protected)
const verifyEmailOtp = async (req, res) => {
  const { otp } = req.body;
  const user = await User.findById(req.user._id).select('+otpHash +otpExpires +otpAttempts');

  if (!user.email || user.isVerified) {
    return res.status(400).json({ success: false, message: 'No pending email verification.' });
  }
  if (user.otpAttempts >= 5) return res.status(403).json({ success: false, message: 'Too many attempts.' });
  if (!user.otpExpires || Date.now() > user.otpExpires) {
    return res.status(400).json({ success: false, message: 'OTP expired. Request again.' });
  }
  if (hashToken(otp?.toString()) !== user.otpHash) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  addAuditLog(user, 'EMAIL_ADDED', `Email ${user.email} verified`, req.ip);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Email verified and linked to your account.' });
};

module.exports = {
  register, sendMobileOtp, verifyOTP, login, logout, refreshToken, getMe,
  forgotPassword, verifyResetOtp, resetPassword,
  googleLogin,
  getActiveSessions, revokeSession, revokeAllSessions,
  addEmail, verifyEmailOtp,
};
