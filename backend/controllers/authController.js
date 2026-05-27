const User = require('../models/User');
const Admin = require('../models/Admin');
const DeliveryPartner = require('../models/DeliveryPartner');
const PendingMobileOtp = require('../models/PendingMobileOtp');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/generateToken');
const crypto = require('node:crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { sendSmsOtp } = require('../utils/sms');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { logAlert } = require('../utils/alerting');
const { OAuth2Client } = require('google-auth-library');


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * hashToken — SHA-256 digest of a token string.
 * Refresh tokens are stored as SHA-256 hashes (never plaintext) in sessions[].tokenHash.
 * Plaintext token sent in cookie → compared by hashing and comparing, never decrypting.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * crossPortalCheck — checks if an email is registered in Admin or DeliveryPartner collections.
 * Returns a user-facing error string if found, or null if safe to proceed.
 * Called before: register (email), login (on failed user lookup), Google OAuth (on account creation).
 * Prevents confusion where a user tries to log into the wrong portal with the same email.
 */
const crossPortalCheck = async (email) => {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  if (await Admin.findOne({ email: e }).lean()) {
    return 'You are registered as Admin. Please login through the Admin portal.';
  }
  if (await DeliveryPartner.findOne({ email: e }).lean()) {
    return 'You are registered as Delivery Partner. Please login through the Delivery Partner portal.';
  }
  return null;
};

/**
 * addAuditLog — appends an audit entry to user.auditLogs (in-memory mutation, caller saves).
 * Capped at MAX_AUDIT_LOGS=50 — oldest entries dropped to prevent unbounded document growth.
 */
const MAX_AUDIT_LOGS = 50;
const addAuditLog = (user, action, details, ipAddress) => {
  user.auditLogs ??= [];
  user.auditLogs.push({ action, details, ipAddress });
  if (user.auditLogs.length > MAX_AUDIT_LOGS) {
    user.auditLogs = user.auditLogs.slice(-MAX_AUDIT_LOGS);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** isMobile — returns true if val matches Indian mobile format (with or without +91 prefix). */
const isMobile = (val) => /^(\+91[-\s]?)?[6-9]\d{9}$/.test(val?.replace(/[-\s]/g, '') || '');

/** isEmail — lightweight email format check (full validation done via Joi schema in validation.js). */
const isEmail  = (val) => /^\S+@\S+\.\S+$/.test(val || '');

/** normaliseMobile — strips spaces/hyphens and +91/91 prefix → returns 10-digit mobile string. */
const normaliseMobile = (m) => m.replace(/[-\s]/g, '').replace(/^\+91/, '').replace(/^91([6-9])/, '$1');

/**
 * buildSessionEntry — creates a new session object for sessions[] array.
 * sessionId = crypto.randomUUID() (unique, non-sequential).
 * tokenHash = SHA-256 of refresh token (plaintext never stored).
 * expiresAt = now + 7 days (matches refresh token TTL).
 */
const buildSessionEntry = (req, refreshToken) => ({
  sessionId: crypto.randomUUID(),
  tokenHash: hashToken(refreshToken),
  deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
  ipAddress: req.ip,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

/**
 * pruneExpiredSessions — filters out sessions whose expiresAt has passed.
 * Called before adding a new session to keep sessions[] clean.
 */
const pruneExpiredSessions = (sessions) =>
  (sessions || []).filter((s) => s.expiresAt > new Date());

/**
 * capSessions — limits concurrent sessions to MAX_SESSIONS (10).
 * If at cap, the oldest session (index 0 after pruning) is dropped to make room.
 */
const MAX_SESSIONS = 10;
const capSessions = (sessions) =>
  sessions.length >= MAX_SESSIONS ? sessions.slice(-(MAX_SESSIONS - 1)) : sessions;

/**
 * sendMobileOtp — sends a 6-digit OTP to a mobile number before account creation.
 * OTP stored as SHA-256 hash in PendingMobileOtp (TTL 10 min → auto-deleted by MongoDB).
 * MOBILE_AUTH_DISABLED: this route is commented out in authRoutes.js and blocked in register().
 * @route POST /api/auth/send-mobile-otp
 */
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

/**
 * register — creates a new user account.
 * Email path: creates user with isVerified=false, sends OTP via email.
 *   → Uses MongoDB transaction: if email send fails, User.create is rolled back atomically.
 * Mobile path: MOBILE_AUTH_DISABLED — blocked until re-enabled; code preserved for reference.
 *   Mobile path would: verify pending OTP → create user with isVerified=true → delete PendingMobileOtp.
 * Cross-portal check: rejects registration if email belongs to Admin or DeliveryPartner collection.
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  const { name, email, mobile, password, otp } = req.body;
  const ipAddress = req.ip;

  // ── Mobile registration ──────────────────────────────────────────────────
  // MOBILE_AUTH_DISABLED: remove next line to re-enable
  if (mobile) return res.status(400).json({ success: false, message: 'Mobile registration is currently disabled.' });
  /* MOBILE_AUTH_DISABLED_CODE_START
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

  MOBILE_AUTH_DISABLED_CODE_END */

  // ── Email registration ───────────────────────────────────────────────────
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });

  // Block registration if email belongs to another portal
  const portalMsg = await crossPortalCheck(email);
  if (portalMsg) return res.status(403).json({ success: false, message: portalMsg, code: 'WRONG_PORTAL' });

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
    res.status(201).json({ success: true, message: 'Account created! Please check your email for the verification code.' });
  } catch (error) {
    await session.abortTransaction(); // rolls back User.create atomically if email send fails
    logger.error(`Registration error for ${email}: ${error.message} | stack: ${error.stack}`);
    return res.status(500).json({ success: false, message: process.env.NODE_ENV === 'development' ? `Registration failed: ${error.message}` : 'Registration failed. Please try again.' });
  } finally {
    session.endSession();
  }
};

/**
 * verifyOTP — validates the 6-digit registration OTP and activates the account.
 * Brute-force guard: otpAttempts >= 5 → 403 (must request new OTP via register again).
 * On success: isVerified=true, OTP fields cleared, otpAttempts reset to 0.
 * @route POST /api/auth/verify-otp
 */
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

/**
 * login — authenticates a user and issues access + refresh tokens.
 * identifier = email (mobile disabled; original query commented inline for easy re-enable).
 * FLOW:
 *   1. Look up user by email
 *   2. If not found and email-like: crossPortalCheck → helpful redirect message
 *   3. isLocked() check (15-min lockout after 5 failed attempts)
 *   4. bcrypt.compare(password, hash)
 *   5. On wrong password: increment loginAttempts → lock at 5
 *   6. isVerified + isActive guard
 *   7. Issue tokens, prune + cap sessions, set refresh cookie
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  const { identifier, password } = req.body; // identifier = email or mobile
  const ipAddress = req.ip;

  // MOBILE_AUTH_DISABLED: restore original query to re-enable mobile login
  // const query = isMobile(identifier)
  //   ? { mobile: normaliseMobile(identifier) }
  //   : { email: identifier?.toLowerCase()?.trim() };
  const query = { email: identifier?.toLowerCase()?.trim() };

  const user = await User.findOne(query).select('+password +sessions');

  if (!user || user.isLocked()) {
    // If email-based lookup failed, check other portals for a helpful message
    if (!user && isEmail(identifier)) {
      const portalMsg = await crossPortalCheck(identifier);
      if (portalMsg) return res.status(403).json({ success: false, message: portalMsg, code: 'WRONG_PORTAL' });
    }
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

  const accessToken = generateAccessToken(user._id, user.role, 'user');
  const refreshToken = generateRefreshToken(user._id, 'user');

  user.sessions = capSessions(pruneExpiredSessions(user.sessions));
  user.sessions.push(buildSessionEntry(req, refreshToken));
  user.lastLogin = new Date();
  addAuditLog(user, 'LOGGED_IN', 'Local login', ipAddress);
  await user.save({ validateBeforeSave: false });

  sendRefreshTokenCookie(res, refreshToken);
  res.json({ success: true, accessToken, user: { _id: user._id, name: user.name, email: user.email, mobile: user.mobile, role: 'user', avatar: user.avatar } });
};

/**
 * refreshToken — rotates the refresh token and issues a new access token.
 * Handles three user types from one endpoint (user / admin / delivery).
 * Delivery tokens are rejected here → must use /dp-auth/refresh.
 *
 * TOKEN REPLAY ATTACK DETECTION:
 *   - Old refresh token hash looked up in sessions[].
 *   - Not found = token was already rotated (replay of stolen old token).
 *   - Response: wipe ALL sessions (nuclear option) + 401.
 *   - Legitimate user must re-login. Attacker's stolen token is also now worthless.
 *
 * ROTATION:
 *   - Found = overwrite sessions[sessionIndex] with new tokenHash in-place.
 *   - New refresh token set in httpOnly cookie; new access token returned in body.
 * @route POST /api/auth/refresh
 */
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

/**
 * logout — removes the current session from sessions[] and clears the refresh cookie.
 * Operates on either User or Admin collection based on req.userType (set by protect middleware).
 * $pull removes only the session matching the current refresh token hash — other sessions unaffected.
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const hashed = hashToken(token);
    const Model = req.userType === 'admin' ? Admin : User;
    await Model.findByIdAndUpdate(req.user._id, { $pull: { sessions: { tokenHash: hashed } } });
  }
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'Logged out.' });
};

/**
 * getMe — returns the authenticated user's profile.
 * req.user populated by protect middleware from the correct model (User/Admin/DeliveryPartner).
 * Role field is always normalised: admin → 'admin', delivery → 'delivery', else → 'user'.
 * This ensures role consistency even if User.role field contains a stale value.
 * @route GET /api/auth/me
 */
const getMe = async (req, res) => {
  // req.user is already populated by protect middleware from the correct model
  // Convert to plain object and ensure role is included (Mongoose toJSON may strip dynamically added fields)
  const userData = req.user.toObject ? req.user.toObject() : { ...req.user };
  if (req.userType === 'admin') userData.role = 'admin';
  else if (req.userType === 'delivery') userData.role = 'delivery';
  else userData.role = 'user'; // Always 'user' for userType='user' regardless of User.role field
  res.json({ success: true, user: userData });
};

// ─── OAuth Flows ───────────────────────────────────────────────────────────────

/**
 * handleOAuthLogin — shared OAuth login/register handler (used by googleLogin).
 * FLOW:
 *   1. extractionLogic() → verify provider token, extract { email, name, avatar, providerId, emailVerified }
 *   2. email required + emailVerified required (provider-verified emails only)
 *   3. Find existing user by email:
 *      - Found: link new provider if not already linked
 *      - Not found: crossPortalCheck → create new verified user
 *   4. isActive guard
 *   5. Issue tokens, update sessions, set refresh cookie
 * Throws → caught here and returns 401 (no stack trace to client).
 */
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
      // Before creating, ensure email not registered in another portal
      const portalMsg = await crossPortalCheck(email);
      if (portalMsg) return res.status(403).json({ success: false, message: portalMsg, code: 'WRONG_PORTAL' });

      user = await User.create({
        name, email, avatar, isVerified: true,
        providers: [{ providerType: providerName, providerId }],
        auditLogs: [{ action: 'ACCOUNT_CREATED', details: `Created via ${providerName}`, ipAddress: req.ip }]
      });
    }

    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account deactivated' });

    const accessToken = generateAccessToken(user._id, user.role, 'user');
    const splitRToken = generateRefreshToken(user._id, 'user');

    user.sessions = capSessions(pruneExpiredSessions(user.sessions));
    user.sessions.push(buildSessionEntry(req, splitRToken));
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, splitRToken);
    res.json({ success: true, accessToken, user: { _id: user._id, name: user.name, email: user.email, role: 'user', avatar: user.avatar } });
  } catch (err) {
    logger.error(`${providerName} login error: ` + err.message);
    res.status(401).json({ success: false, message: `${providerName} integration failed.` });
  }
};

/**
 * googleLogin — verifies a Google ID token (from frontend Google Sign-In) and delegates to handleOAuthLogin.
 * idToken verified against GOOGLE_CLIENT_ID → payload.email_verified must be true.
 * @route POST /api/auth/google
 */
const googleLogin = (req, res) => handleOAuthLogin(req, res, 'google', async () => {
  const ticket = await googleClient.verifyIdToken({ idToken: req.body.idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  return { email: p.email, name: p.name, avatar: p.picture, providerId: p.sub, emailVerified: p.email_verified };
});

// ─── Forgot Password / OTP Flows ───────────────────────────────────────────────

/**
 * forgotPassword — sends a 6-digit password reset OTP to the user's email.
 * Returns GENERIC_OK regardless of whether the email exists (prevents user enumeration).
 * OAuth-only accounts (no password field) get a specific error — these can't reset passwords.
 * OTP valid 10 min; previous OTP attempts reset to 0 on each new OTP issue.
 * @route POST /api/auth/forgot-password
 */
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

/**
 * verifyResetOtp — validates the password reset OTP and issues a single-use reset token.
 * Brute-force guard: pwdResetOtpAttempts >= 5 → 403, OTP nuked.
 * On success:
 *   - OTP fields cleared immediately (can't be reused)
 *   - 32-byte crypto-random reset token generated → stored as SHA-256 hash in DB
 *   - Plaintext reset token returned to client (used in resetPassword call)
 *   - Reset token valid for 15 minutes
 * DELIBERATELY NOT a JWT — stored hash in DB so it can be burned after single use.
 * @route POST /api/auth/verify-reset-otp
 */
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

/**
 * resetPassword — sets a new password using the reset token from verifyResetOtp.
 * Validates reset token not expired + hash matches stored hash.
 * Rejects if new password is same as current password (bcrypt compare).
 * On success: password updated, ALL sessions wiped (global logout), reset token burned (single use).
 * loginAttempts + lockUntil also cleared (unlocks accounts that were locked).
 * @route POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  const user = await User.findOne({ email }).select('+password +sessions +pwdResetTokenHash +pwdResetTokenExpires');
  
  if (!user || Date.now() > user.pwdResetTokenExpires) {
    return res.status(400).json({ success: false, message: 'Reset token invalid or expired.' });
  }

  if (hashToken(resetToken) !== user.pwdResetTokenHash) {
    return res.status(400).json({ success: false, message: 'Reset token mismatch.' });
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

/**
 * getActiveSessions — returns all non-expired sessions for the authenticated user.
 * Expired sessions pruned from DB on each call (lazy cleanup — no separate cron needed).
 * isCurrent: true = the session matching the caller's current refresh token cookie.
 * tokenHash is NOT returned to client (only sessionId for revocation).
 * @route GET /api/auth/sessions
 */
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

/**
 * revokeSession — removes a specific session by sessionId (targeted device sign-out).
 * 404 if sessionId not found (protects against guessing other users' session IDs — ownership
 * enforced implicitly since we only query req.user._id's sessions).
 * @route DELETE /api/auth/sessions/:id
 */
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

/**
 * revokeAllSessions — wipes all sessions (global sign-out from all devices).
 * Also clears the refresh cookie for the current device.
 * User must re-login on every device after this.
 * @route DELETE /api/auth/sessions/all
 */
const revokeAllSessions = async (req, res) => {
  const user = await User.findById(req.user._id).select('+sessions');
  user.sessions = [];
  addAuditLog(user, 'GLOBAL_SIGNOUT', 'Revoked all active sessions manually', req.ip);
  await user.save({ validateBeforeSave: false });
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'All active sessions globally revoked.' });
};

/**
 * addEmail — allows mobile-registered users to attach an email to their account.
 * Sets isVerified=false until OTP confirmed (enforces email ownership).
 * If email already belongs to another user → 400 (not exposed as "exists" — just "in use").
 * OTP valid 10 min; must call verifyEmailOtp next to finalise.
 * @route POST /api/auth/add-email (protect)
 */
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

/**
 * verifyEmailOtp — confirms the OTP sent by addEmail and marks email as verified.
 * Brute-force guard: otpAttempts >= 5 → 403.
 * On success: isVerified=true, OTP fields cleared, EMAIL_ADDED audit log written.
 * @route POST /api/auth/verify-email-otp (protect)
 */
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
