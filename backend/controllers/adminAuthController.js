const Admin = require('../models/Admin');
const User = require('../models/User');
const DeliveryPartner = require('../models/DeliveryPartner');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} = require('../utils/generateToken');
const { sendVerificationEmail } = require('../utils/email');
const logger = require('../utils/logger');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const pruneExpiredSessions = (sessions) =>
  (sessions || []).filter((s) => s.expiresAt > new Date());

const MAX_SESSIONS = 10;
const capSessions = (sessions) =>
  sessions.length >= MAX_SESSIONS ? sessions.slice(-(MAX_SESSIONS - 1)) : sessions;

const buildSession = (req, refreshToken) => ({
  sessionId: crypto.randomUUID(),
  tokenHash: hashToken(refreshToken),
  deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
  ipAddress: req.ip,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

const adminPayload = (admin) => ({
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  role: 'admin',
  avatar: admin.avatar || '',
});

// Generate 6-digit OTP, store hashed, return plaintext for email
const generateOtp = () => {
  const otp = crypto.randomInt(100000, 1000000).toString(); // cryptographically secure PRNG
  return { otp, hash: hashToken(otp) };
};

// POST /api/admin-auth/register
// Requires ADMIN_REGISTER_SECRET. Sends email OTP for verification.
const register = async (req, res) => {
  const { name, email, password, secret } = req.body;

  if (!name || !email || !password || !secret) {
    return res.status(400).json({ success: false, message: 'Name, email, password, and secret required.' });
  }

  // Timing-safe comparison — prevents side-channel attacks leaking secret bytes
  const expectedSecret = process.env.ADMIN_REGISTER_SECRET || '';
  const secretsMatch = expectedSecret.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSecret), Buffer.from(secret));
  if (!secretsMatch) {
    logger.warn(`Admin register attempt with invalid secret from IP ${req.ip}`);
    return res.status(403).json({ success: false, message: 'Invalid registration secret.' });
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  // Block if email belongs to another portal
  const emailLower = email.toLowerCase();
  if (await User.findOne({ email: emailLower }).lean()) {
    return res.status(403).json({ success: false, message: 'You are registered as Customer. Please login through the Customer portal.', code: 'WRONG_PORTAL' });
  }
  if (await DeliveryPartner.findOne({ email: emailLower }).lean()) {
    return res.status(403).json({ success: false, message: 'You are registered as Delivery Partner. Please login through the Delivery Partner portal.', code: 'WRONG_PORTAL' });
  }

  const { otp, hash } = generateOtp();

  const admin = await Admin.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password,
    isEmailVerified: false,
    emailOtpHash:   hash,
    emailOtpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    auditLogs: [{ action: 'ACCOUNT_CREATED', details: 'Admin self-registration', ipAddress: req.ip }],
  });

  try {
    await sendVerificationEmail(admin.email, admin.name, otp);
  } catch (err) {
    logger.error(`Failed to send admin OTP to ${admin.email}: ${err.message}`);
    // Delete account so they can retry
    await Admin.deleteOne({ _id: admin._id });
    return res.status(500).json({ success: false, message: 'Failed to send verification email. Try again.' });
  }

  logger.info(`New admin registered (pending verification): ${admin.email}`);
  res.status(201).json({
    success: true,
    message: `Verification OTP sent to ${admin.email}. Enter the 6-digit code to activate your account.`,
    email: admin.email,
  });
};

// POST /api/admin-auth/verify-email
const verifyEmail = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP required.' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() })
    .select('+emailOtpHash +emailOtpExpiry');

  if (!admin) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }
  if (admin.isEmailVerified) {
    return res.status(400).json({ success: false, message: 'Email already verified.' });
  }
  if (!admin.emailOtpHash || !admin.emailOtpExpiry) {
    return res.status(400).json({ success: false, message: 'No pending OTP. Request a new one.' });
  }
  if (admin.emailOtpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }
  if (hashToken(otp.trim()) !== admin.emailOtpHash) {
    return res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }

  admin.isEmailVerified = true;
  admin.emailOtpHash    = undefined;
  admin.emailOtpExpiry  = undefined;
  await admin.save({ validateBeforeSave: false });

  logger.info(`Admin email verified: ${admin.email}`);
  res.json({ success: true, message: 'Email verified. You can now log in.' });
};

// POST /api/admin-auth/resend-otp
const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

  const admin = await Admin.findOne({ email: email.toLowerCase() })
    .select('+emailOtpHash +emailOtpExpiry');

  if (!admin) return res.status(404).json({ success: false, message: 'Account not found.' });
  if (admin.isEmailVerified) return res.status(400).json({ success: false, message: 'Already verified.' });

  // Throttle: don't resend if existing OTP still has > 8 min remaining
  if (admin.emailOtpExpiry && admin.emailOtpExpiry > new Date(Date.now() + 2 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'OTP recently sent. Wait before requesting again.' });
  }

  const { otp, hash } = generateOtp();
  admin.emailOtpHash   = hash;
  admin.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await admin.save({ validateBeforeSave: false });

  await sendVerificationEmail(admin.email, admin.name, otp);
  res.json({ success: true, message: 'New OTP sent.' });
};

// POST /api/admin-auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password +sessions');
  if (!admin || admin.isLocked()) {
    if (!admin) {
      const emailLower = email.toLowerCase();
      if (await User.findOne({ email: emailLower }).lean()) {
        return res.status(403).json({ success: false, message: 'You are registered as Customer. Please login through the Customer portal.', code: 'WRONG_PORTAL' });
      }
      if (await DeliveryPartner.findOne({ email: emailLower }).lean()) {
        return res.status(403).json({ success: false, message: 'You are registered as Delivery Partner. Please login through the Delivery Partner portal.', code: 'WRONG_PORTAL' });
      }
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials or account locked.' });
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    admin.loginAttempts = (admin.loginAttempts || 0) + 1;
    if (admin.loginAttempts >= 5) admin.lockUntil = Date.now() + 15 * 60 * 1000;
    await admin.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, message: 'Account deactivated.' });
  }

  // Block login if email not verified
  if (!admin.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email not verified. Check your inbox for the OTP.',
      code: 'EMAIL_NOT_VERIFIED',
      email: admin.email,
    });
  }

  admin.loginAttempts = 0;
  admin.lockUntil = undefined;

  const accessToken  = generateAccessToken(admin._id, 'admin', 'admin');
  const refreshToken = generateRefreshToken(admin._id, 'admin');

  admin.sessions = capSessions(pruneExpiredSessions(admin.sessions));
  admin.sessions.push(buildSession(req, refreshToken));
  admin.lastLogin = new Date();
  admin.markModified('sessions');
  await admin.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);
  res.json({ success: true, accessToken, user: adminPayload(admin) });
};

// POST /api/admin-auth/logout
const logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const hashed = hashToken(token);
    await Admin.findByIdAndUpdate(req.user._id, { $pull: { sessions: { tokenHash: hashed } } });
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out.' });
};

// GET /api/admin-auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: adminPayload(req.user) });
};

// POST /api/admin-auth/refresh
const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
  }

  if (decoded.userType !== 'admin') {
    return res.status(401).json({ success: false, message: 'Invalid token type.' });
  }

  const admin = await Admin.findById(decoded.id).select('+sessions');
  if (!admin || !admin.isActive) {
    return res.status(401).json({ success: false, message: 'Admin not found or inactive.' });
  }

  admin.sessions = pruneExpiredSessions(admin.sessions);
  const hashed = hashToken(token);
  const idx = admin.sessions.findIndex((s) => s.tokenHash === hashed);

  if (idx === -1) {
    admin.sessions = [];
    await admin.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }

  const newAccess  = generateAccessToken(admin._id, 'admin', 'admin');
  const newRefresh = generateRefreshToken(admin._id, 'admin');

  admin.sessions[idx] = {
    sessionId: crypto.randomUUID(),
    tokenHash: hashToken(newRefresh),
    deviceId:  req.headers['user-agent']?.substring(0, 50) || 'Unknown',
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  admin.markModified('sessions');
  await admin.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, newRefresh);
  res.json({ success: true, accessToken: newAccess });
};

// PATCH /api/admin-auth/profile/name
const updateName = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name required.' });
  try {
    const admin = await Admin.findByIdAndUpdate(
      req.user._id,
      { $set: { name: name.trim() } },
      { new: true, runValidators: false }
    );
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
    res.json({ success: true, user: adminPayload(admin) });
  } catch (err) {
    logger.error('updateName error: ' + err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin-auth/profile/request-email-change
const requestEmailChange = async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail?.trim()) return res.status(400).json({ success: false, message: 'New email required.' });
  const email = newEmail.toLowerCase().trim();
  const existing = await Admin.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: 'Email already in use.' });
  const admin = await Admin.findById(req.user._id).select('+emailOtpHash +emailOtpExpiry');
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
  const { otp, hash } = generateOtp();
  admin.emailOtpHash   = hash;
  admin.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  admin.set('pendingEmail', email, { strict: false });
  await admin.save({ validateBeforeSave: false });
  try {
    await sendVerificationEmail(email, admin.name, otp);
  } catch (err) {
    logger.error('Failed to send email-change OTP: ' + err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Try again.' });
  }
  res.json({ success: true, message: 'OTP sent to ' + email + '. Valid for 10 minutes.' });
};

// POST /api/admin-auth/profile/confirm-email-change
const confirmEmailChange = async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ success: false, message: 'OTP required.' });
  const admin = await Admin.findById(req.user._id).select('+emailOtpHash +emailOtpExpiry +pendingEmail');
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
  if (!admin.emailOtpHash || !admin.emailOtpExpiry || !admin.get('pendingEmail')) {
    return res.status(400).json({ success: false, message: 'No pending email change. Request again.' });
  }
  if (admin.emailOtpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP expired. Request again.' });
  }
  if (hashToken(otp) !== admin.emailOtpHash) {
    return res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }
  admin.email          = admin.get('pendingEmail');
  admin.emailOtpHash   = undefined;
  admin.emailOtpExpiry = undefined;
  admin.set('pendingEmail', undefined);
  await admin.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Email updated successfully.', user: adminPayload(admin) });
};

module.exports = { register, verifyEmail, resendOtp, login, logout, getMe, refreshToken, updateName, requestEmailChange, confirmEmailChange };
