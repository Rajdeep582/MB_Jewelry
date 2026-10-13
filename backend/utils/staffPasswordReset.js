/**
 * staffPasswordReset — forgot-password flow for the Admin and Delivery Partner portals.
 *
 * Mirrors the customer flow (authController.forgotPassword / verifyResetOtp / resetPassword):
 *   1. POST /forgot-password  { email }                         → 6-digit OTP emailed (10 min)
 *   2. POST /verify-reset-otp { email, otp }                    → short-lived resetToken (15 min)
 *   3. POST /reset-password   { email, resetToken, newPassword } → password changed, all sessions revoked
 *
 * Security:
 *   - Step 1 always answers with the same generic message (never reveals whether an account exists).
 *   - OTP and reset token are stored only as SHA-256 hashes; both are single-use.
 *   - 5 wrong OTP attempts lock the code; a new code must be requested.
 *   - A successful reset clears the login lockout and signs the account out everywhere.
 */
const crypto = require('node:crypto');
const { sendPasswordResetEmail } = require('./email');
const logger = require('./logger');

const OTP_TTL_MS    = 10 * 60 * 1000;
const TOKEN_TTL_MS  = 15 * 60 * 1000;
const MAX_ATTEMPTS  = 5;
const GENERIC_OK    = { success: true, message: 'If this email is registered, a reset code has been sent.' };
const RESET_FIELDS  = '+pwdResetOtpHash +pwdResetOtpExpires +pwdResetOtpAttempts +pwdResetTokenHash +pwdResetTokenExpires';

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
const audit = (doc, action, details, ip) => {
  if (!Array.isArray(doc.auditLogs)) return;
  doc.auditLogs.push({ action, details, ipAddress: ip });
  if (doc.auditLogs.length > 50) doc.auditLogs = doc.auditLogs.slice(-50);
};
const clearOtp = (doc) => {
  doc.pwdResetOtpHash = undefined;
  doc.pwdResetOtpExpires = undefined;
  doc.pwdResetOtpAttempts = 0;
};

/**
 * @param {import('mongoose').Model} Model   Admin or DeliveryPartner
 * @param {string} portal                    label for logs ('admin' | 'delivery')
 */
function makePasswordResetHandlers(Model, portal) {
  // Step 1 — email a reset code
  const forgotPassword = async (req, res) => {
    const email = String(req.body.email || '').toLowerCase();
    const account = await Model.findOne({ email }).select(RESET_FIELDS);
    if (!account || !account.isActive) return res.json(GENERIC_OK);

    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    account.pwdResetOtpHash = hashToken(rawOtp);
    account.pwdResetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    account.pwdResetOtpAttempts = 0;
    // A fresh code invalidates any earlier, unused reset token
    account.pwdResetTokenHash = undefined;
    account.pwdResetTokenExpires = undefined;
    await account.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(account.email, account.name, rawOtp);
    } catch (err) {
      logger.error(`[${portal}] password reset email failed for ${account.email}: ${err.message}`);
      return res.status(500).json({ success: false, message: 'Could not send the reset code. Please try again later.' });
    }
    logger.info(`[${portal}] password reset code issued for ${account.email}`);
    return res.json(GENERIC_OK);
  };

  // Step 2 — verify the code, issue a one-time reset token
  const verifyResetOtp = async (req, res) => {
    const email = String(req.body.email || '').toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const account = await Model.findOne({ email }).select(RESET_FIELDS);
    if (!account || !account.pwdResetOtpHash) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code. Please request a new one.' });
    }

    if ((account.pwdResetOtpAttempts || 0) >= MAX_ATTEMPTS || !account.pwdResetOtpExpires || Date.now() > account.pwdResetOtpExpires) {
      clearOtp(account);
      await account.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'Code expired or too many attempts. Please request a new one.', code: 'OTP_EXPIRED' });
    }

    if (!safeEqual(hashToken(otp), account.pwdResetOtpHash)) {
      account.pwdResetOtpAttempts = (account.pwdResetOtpAttempts || 0) + 1;
      await account.save({ validateBeforeSave: false });
      const left = MAX_ATTEMPTS - account.pwdResetOtpAttempts;
      return res.status(400).json({ success: false, message: left > 0 ? `Invalid code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many attempts. Please request a new code.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    account.pwdResetTokenHash = hashToken(resetToken);
    account.pwdResetTokenExpires = new Date(Date.now() + TOKEN_TTL_MS);
    clearOtp(account);
    audit(account, 'PWD_RESET_OTP_VERIFIED', 'Password reset code verified', req.ip);
    await account.save({ validateBeforeSave: false });

    return res.json({ success: true, message: 'Code verified. Set your new password.', resetToken });
  };

  // Step 3 — set the new password
  const resetPassword = async (req, res) => {
    const email = String(req.body.email || '').toLowerCase();
    const { resetToken, newPassword } = req.body;
    const account = await Model.findOne({ email }).select(`+password +sessions ${RESET_FIELDS}`);

    if (!account || !account.pwdResetTokenHash || !account.pwdResetTokenExpires || Date.now() > account.pwdResetTokenExpires
        || !safeEqual(hashToken(resetToken), account.pwdResetTokenHash)) {
      return res.status(400).json({ success: false, message: 'Reset session invalid or expired. Please start again.', code: 'RESET_EXPIRED' });
    }

    if (await account.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
    }

    account.password = newPassword;            // hashed by the model's pre('save') hook
    account.loginAttempts = 0;
    account.lockUntil = undefined;
    account.sessions = [];                     // sign out every device
    account.pwdResetTokenHash = undefined;     // single use
    account.pwdResetTokenExpires = undefined;
    audit(account, 'PASSWORD_RESET', 'Password reset via email code', req.ip);
    await account.save({ validateBeforeSave: false });

    logger.info(`[${portal}] password reset completed for ${account.email}`);
    return res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
  };

  return { forgotPassword, verifyResetOtp, resetPassword };
}

module.exports = { makePasswordResetHandlers };
