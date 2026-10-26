const Admin = require('../models/Admin');
const User = require('../models/User');
const DeliveryPartner = require('../models/DeliveryPartner');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
  clearRefreshTokenCookie,
  readRefreshToken,
} = require('../utils/generateToken');
const { rotateRefreshSession } = require('../utils/refreshSessions');
const { sendVerificationEmail, sendAdminLoginCode } = require('../utils/email');
const logger = require('../utils/logger');
const { LOGIN_FAILED, otherPortalHint, equaliseTiming } = require('../utils/portalHint');
const { makePasswordResetHandlers } = require('../utils/staffPasswordReset');

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
/**
 * verifyEmail
 * @route  POST /api/admin-auth/verify-email
 * @access Public
 *
 * Verifies the 6-digit OTP sent to the admin's email on registration.
 *
 * BRUTE-FORCE PROTECTION:
 *   emailOtpAttempts is incremented on every wrong OTP.
 *   At >= 5 wrong attempts the endpoint locks and returns 403 regardless of
 *   whether the OTP is correct. Admin must request a new OTP (resend-otp),
 *   which resets the counter. This mirrors the user OTP lockout exactly.
 *
 * ON SUCCESS: clears emailOtpHash, emailOtpExpiry, emailOtpAttempts → sets isEmailVerified = true.
 * ON WRONG OTP: increments emailOtpAttempts, saves, returns 400.
 * ON LOCKED (>= 5): returns 403 without touching the OTP hash.
 */
const verifyEmail = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP required.' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() })
    .select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts');

  if (!admin) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }
  if (admin.isEmailVerified) {
    return res.status(400).json({ success: false, message: 'Email already verified.' });
  }
  if (!admin.emailOtpHash || !admin.emailOtpExpiry) {
    return res.status(400).json({ success: false, message: 'No pending OTP. Request a new one.' });
  }

  // Lockout check — must come before expiry so attacker can't bypass by getting a fresh OTP
  if (admin.emailOtpAttempts >= 5) {
    return res.status(403).json({ success: false, message: 'Too many incorrect attempts. Request a new OTP.' });
  }

  if (admin.emailOtpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }

  if (hashToken(otp.trim()) !== admin.emailOtpHash) {
    admin.emailOtpAttempts += 1;
    await admin.save({ validateBeforeSave: false });
    const remaining = 5 - admin.emailOtpAttempts;
    return res.status(400).json({
      success: false,
      message: remaining > 0
        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new OTP.',
    });
  }

  admin.isEmailVerified    = true;
  admin.emailOtpHash       = undefined;
  admin.emailOtpExpiry     = undefined;
  admin.emailOtpAttempts   = 0;
  await admin.save({ validateBeforeSave: false });

  logger.info(`Admin email verified: ${admin.email}`);
  res.json({ success: true, message: 'Email verified. You can now log in.' });
};

// POST /api/admin-auth/resend-otp
const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

  const admin = await Admin.findOne({ email: email.toLowerCase() })
    .select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts');

  if (!admin) return res.status(404).json({ success: false, message: 'Account not found.' });
  if (admin.isEmailVerified) return res.status(400).json({ success: false, message: 'Already verified.' });

  // Throttle: don't resend if existing OTP still has > 8 min remaining AND not yet locked out
  if (
    admin.emailOtpAttempts < 5 &&
    admin.emailOtpExpiry &&
    admin.emailOtpExpiry > new Date(Date.now() + 2 * 60 * 1000)
  ) {
    return res.status(429).json({ success: false, message: 'OTP recently sent. Wait before requesting again.' });
  }

  const { otp, hash } = generateOtp();
  admin.emailOtpHash      = hash;
  admin.emailOtpExpiry    = new Date(Date.now() + 10 * 60 * 1000);
  admin.emailOtpAttempts  = 0; // reset lockout counter — new OTP = fresh window
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
      // Portal hint only when the password is right for that other account (never reveals accounts)
      const hint = await otherPortalHint(email, password, ['user', 'delivery']);
      if (hint) return res.status(403).json({ success: false, message: hint, code: 'WRONG_PORTAL' });
      await equaliseTiming(password);
    }
    return res.status(401).json({ success: false, message: LOGIN_FAILED });
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    admin.loginAttempts = (admin.loginAttempts || 0) + 1;
    if (admin.loginAttempts >= 5) admin.lockUntil = Date.now() + 15 * 60 * 1000;
    await admin.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: LOGIN_FAILED });
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

  // ── Step 2 of sign-in: email a one-time code (2-step verification) ──
  // The password alone never signs an admin in. Tokens are issued by verifyLogin() once the
  // 6-digit code from the admin's registered email is entered. The random `challenge` returned
  // here ties the code to this password check, so the code can't be used without the password.
  admin.loginAttempts = 0;
  admin.lockUntil = undefined;
  const loginOtp = issueLoginCode(admin);
  const challenge = crypto.randomBytes(32).toString('hex');
  admin.loginChallengeHash = hashToken(challenge);
  await admin.save({ validateBeforeSave: false });

  try {
    await sendAdminLoginCode(admin.email, admin.name, loginOtp, { ip: req.ip });
  } catch (err) {
    logger.error(`Admin login code email failed for ${admin.email}: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Could not send the login code to your email. Please try again.' });
  }
  res.json({
    success: true,
    otpRequired: true,
    challenge,
    email: maskEmail(admin.email),
    message: `We sent a 6-digit code to ${maskEmail(admin.email)}. Enter it to finish signing in.`,
  });
};

const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;

/** a****n@gmail.com — shown on screen so the admin knows where the code went. */
function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return email;
  const shown = user.length <= 2 ? `${user[0]}*` : `${user[0]}${'*'.repeat(Math.min(user.length - 2, 6))}${user.at(-1)}`;
  return `${shown}@${domain}`;
}

/** Fresh 6-digit login code: hash stored on the admin (caller saves); plain code returned for the email only. */
function issueLoginCode(admin) {
  const { otp, hash } = generateOtp();
  admin.loginOtpHash = hash;
  admin.loginOtpExpiry = new Date(Date.now() + LOGIN_OTP_TTL_MS);
  admin.loginOtpAttempts = 0;
  return otp;
}

/** Load the admin for a login challenge (email + challenge from step 1). */
async function findChallengedAdmin(email, challenge) {
  if (typeof email !== 'string' || typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge)) return null;
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
    .select('+sessions +loginOtpHash +loginOtpExpiry +loginOtpAttempts +loginChallengeHash');
  if (!admin?.loginChallengeHash) return null;
  const a = Buffer.from(admin.loginChallengeHash);
  const b = Buffer.from(hashToken(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? admin : null;
}

// POST /api/admin-auth/login/verify   { email, challenge, otp }
// Step 2 of admin sign-in: checks the emailed code, then issues the session (same as before).
const verifyLogin = async (req, res) => {
  const { email, challenge, otp } = req.body || {};
  const admin = await findChallengedAdmin(email, challenge);
  const expired = { success: false, message: 'This sign-in has expired. Please enter your password again.', code: 'LOGIN_EXPIRED' };
  if (!admin) return res.status(401).json(expired);
  if (!admin.isActive) return res.status(403).json({ success: false, message: 'Account deactivated.' });

  if (!admin.loginOtpHash || !admin.loginOtpExpiry || admin.loginOtpExpiry < new Date()
      || admin.loginOtpAttempts >= LOGIN_OTP_MAX_ATTEMPTS) {
    admin.loginChallengeHash = undefined;
    admin.loginOtpHash = undefined;
    await admin.save({ validateBeforeSave: false });
    return res.status(401).json(expired);
  }

  const code = typeof otp === 'string' || typeof otp === 'number' ? String(otp).trim() : '';
  const given = Buffer.from(hashToken(code));
  const stored = Buffer.from(admin.loginOtpHash);
  if (!/^\d{6}$/.test(code) || given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    admin.loginOtpAttempts = (admin.loginOtpAttempts || 0) + 1;
    const left = LOGIN_OTP_MAX_ATTEMPTS - admin.loginOtpAttempts;
    if (left <= 0) {
      admin.loginChallengeHash = undefined;
      admin.loginOtpHash = undefined;
      logger.warn(`Admin login code failed ${LOGIN_OTP_MAX_ATTEMPTS} times for ${admin.email} from ${req.ip}`);
    }
    await admin.save({ validateBeforeSave: false });
    return res.status(left <= 0 ? 401 : 400).json(left <= 0
      ? expired
      : { success: false, message: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` });
  }

  // Code OK → single use, then sign in
  admin.loginOtpHash = undefined;
  admin.loginOtpExpiry = undefined;
  admin.loginOtpAttempts = 0;
  admin.loginChallengeHash = undefined;

  const accessToken  = generateAccessToken(admin._id, 'admin', 'admin');
  const refreshToken = generateRefreshToken(admin._id, 'admin');

  admin.sessions = capSessions(pruneExpiredSessions(admin.sessions));
  admin.sessions.push(buildSession(req, refreshToken));
  admin.lastLogin = new Date();
  admin.markModified('sessions');
  await admin.save({ validateBeforeSave: false });

  logger.info(`Admin ${admin.email} signed in (2-step) from ${req.ip}`);
  sendRefreshTokenCookie(res, refreshToken, 'admin');
  res.json({ success: true, accessToken, user: adminPayload(admin) });
};

// POST /api/admin-auth/login/resend   { email, challenge }
// New code for the same sign-in (old code stops working). Per-email limit applies on the route.
const resendLoginCode = async (req, res) => {
  const { email, challenge } = req.body || {};
  const admin = await findChallengedAdmin(email, challenge);
  if (!admin || !admin.isActive) {
    return res.status(401).json({ success: false, message: 'This sign-in has expired. Please enter your password again.', code: 'LOGIN_EXPIRED' });
  }
  const loginOtp = issueLoginCode(admin);
  await admin.save({ validateBeforeSave: false });
  try {
    await sendAdminLoginCode(admin.email, admin.name, loginOtp, { ip: req.ip });
  } catch (err) {
    logger.error(`Admin login code resend failed for ${admin.email}: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Could not send the code. Please try again.' });
  }
  res.json({ success: true, message: `A new code was sent to ${maskEmail(admin.email)}.` });
};

// POST /api/admin-auth/logout
const logout = async (req, res) => {
  const { token, legacy } = readRefreshToken(req, 'admin');
  if (token) {
    const hashed = hashToken(token);
    await Admin.findByIdAndUpdate(req.user._id, { $pull: { sessions: { tokenHash: hashed } } });
  }
  clearRefreshTokenCookie(res, 'admin');
  if (legacy) clearRefreshTokenCookie(res, 'user'); // legacy shared cookie held this admin session
  res.json({ success: true, message: 'Logged out.' });
};

// GET /api/admin-auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: adminPayload(req.user) });
};

// POST /api/admin-auth/refresh
// Reads the admin portal's own cookie (falls back once to the legacy shared cookie).
// Rotation + replay detection: utils/refreshSessions.js
const refreshToken = async (req, res) => {
  const { token, legacy } = readRefreshToken(req, 'admin');
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
  }

  // A legacy cookie holding a customer token belongs to the shop session — leave it untouched.
  if (decoded.userType !== 'admin') {
    return res.status(401).json({ success: false, message: 'Invalid token type.' });
  }

  const admin = await Admin.findById(decoded.id).select('+sessions');
  if (!admin || !admin.isActive) {
    return res.status(401).json({ success: false, message: 'Admin not found or inactive.' });
  }

  const result = await rotateRefreshSession({ Model: Admin, doc: admin, token, userType: 'admin', req, newSessionId: true });

  if (result.status === 'replay') {
    admin.sessions = [];
    await admin.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }

  if (result.status === 'rotated') {
    sendRefreshTokenCookie(res, result.refreshToken, 'admin');
    if (legacy) clearRefreshTokenCookie(res, 'user'); // migrate off the legacy shared cookie
  }
  res.json({ success: true, accessToken: generateAccessToken(admin._id, 'admin', 'admin') });
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
  const admin = await Admin.findById(req.user._id).select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts');
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
  const { otp, hash } = generateOtp();
  admin.emailOtpHash      = hash;
  admin.emailOtpExpiry    = new Date(Date.now() + 10 * 60 * 1000);
  admin.emailOtpAttempts  = 0; // reset lockout — new OTP window
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
/**
 * confirmEmailChange
 * @route  POST /api/admin-auth/profile/confirm-email-change
 * @access Admin (authenticated)
 *
 * Confirms the OTP sent to the new email address during an email-change request.
 * Same 5-attempt lockout as verifyEmail — prevents brute-force on email-change OTP.
 * emailOtpAttempts reset to 0 on success.
 */
const confirmEmailChange = async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ success: false, message: 'OTP required.' });

  const admin = await Admin.findById(req.user._id)
    .select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts +pendingEmail');
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
  if (!admin.emailOtpHash || !admin.emailOtpExpiry || !admin.get('pendingEmail')) {
    return res.status(400).json({ success: false, message: 'No pending email change. Request again.' });
  }

  if (admin.emailOtpAttempts >= 5) {
    return res.status(403).json({ success: false, message: 'Too many incorrect attempts. Request a new OTP.' });
  }

  if (admin.emailOtpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP expired. Request again.' });
  }

  if (hashToken(otp) !== admin.emailOtpHash) {
    admin.emailOtpAttempts += 1;
    await admin.save({ validateBeforeSave: false });
    const remaining = 5 - admin.emailOtpAttempts;
    return res.status(400).json({
      success: false,
      message: remaining > 0
        ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new OTP.',
    });
  }

  admin.email              = admin.get('pendingEmail');
  admin.emailOtpHash       = undefined;
  admin.emailOtpExpiry     = undefined;
  admin.emailOtpAttempts   = 0;
  admin.set('pendingEmail', undefined);
  await admin.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Email updated successfully.', user: adminPayload(admin) });
};

// Forgot password — POST /forgot-password, /verify-reset-otp, /reset-password
const { forgotPassword, verifyResetOtp, resetPassword } = makePasswordResetHandlers(Admin, 'admin');

module.exports = { register, verifyEmail, resendOtp, login, verifyLogin, resendLoginCode, logout, getMe, refreshToken, updateName, requestEmailChange, confirmEmailChange, forgotPassword, verifyResetOtp, resetPassword };
