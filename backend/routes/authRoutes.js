/**
 * User Authentication Routes — /api/auth
 *
 * Registration & Verification:
 *   POST /register        — register with email + password (authLimiter)
 *   POST /verify-otp      — submit registration OTP to activate account (authLimiter)
 *   POST /login           — email/password login → access + refresh tokens (loginLimiter)
 *   POST /google          — Google OAuth login/register (authLimiter)
 *   POST /logout          — invalidate session (protect)
 *   POST /refresh         — rotate refresh token → new access token
 *   GET  /me              — return current user profile (protect)
 *
 * Password Reset (3-step):
 *   POST /forgot-password   — send reset OTP to email (otpLimiter)
 *   POST /verify-reset-otp  — validate OTP → issue short-lived reset token (otpLimiter)
 *   POST /reset-password    — consume reset token, set new password (authLimiter)
 *
 * Email attachment (mobile-registered users adding email):
 *   POST /add-email         — send OTP to new email address (protect)
 *   POST /verify-email-otp  — verify OTP and attach email to account (protect)
 *
 * Session management:
 *   GET    /sessions      — list all active sessions for current user (protect)
 *   DELETE /sessions/all  — revoke all sessions (protect)
 *   DELETE /sessions/:id  — revoke specific session by sessionId (protect)
 *
 * NOTE: Mobile OTP route (/send-mobile-otp) is commented out — MOBILE_AUTH_DISABLED.
 */
const express = require('express');
const router = express.Router();
const { validateSchema, schemas } = require('../middleware/validation');
const { otpLimiter, loginLimiter, authLimiter } = require('../middleware/rateLimiter');

// ─── Validation rule sets ─────────────────────────────────────────────────────
// Validation is imported from validation.js

const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ─── Auth ─────────────────────────────────────────────────────────────────────
// MOBILE_AUTH_DISABLED: uncomment to re-enable mobile OTP route
// router.post('/send-mobile-otp', otpLimiter,  validateSchema(schemas.sendMobileOtp), ctrl.sendMobileOtp);
router.post('/register',        authLimiter, validateSchema(schemas.register),       ctrl.register);
router.post('/verify-otp',      authLimiter, validateSchema(schemas.verifyOtp),      ctrl.verifyOTP);
router.post('/login',           loginLimiter, validateSchema(schemas.login),         ctrl.login);
router.post('/google',          authLimiter, validateSchema(schemas.googleOAuth),    ctrl.googleLogin);
router.post('/logout',          protect,                                             ctrl.logout);
router.post('/refresh',                                                              ctrl.refreshToken);
router.get('/me',               protect,                                             ctrl.getMe);

// Forgot password
router.post('/forgot-password',   otpLimiter, validateSchema(schemas.forgotPassword), ctrl.forgotPassword);
router.post('/verify-reset-otp',  otpLimiter, validateSchema(schemas.verifyResetOtp), ctrl.verifyResetOtp);
router.post('/reset-password',  authLimiter, validateSchema(schemas.resetPassword),   ctrl.resetPassword);

// Profile: add email (mobile-registered users)
router.post('/add-email',        protect, validateSchema(schemas.addEmail),        ctrl.addEmail);
router.post('/verify-email-otp', protect, validateSchema(schemas.verifyEmailOtp),  ctrl.verifyEmailOtp);

// Session management
router.get('/sessions',        protect, ctrl.getActiveSessions);
router.delete('/sessions/all', protect, ctrl.revokeAllSessions);
router.delete('/sessions/:id', protect, ctrl.revokeSession);

module.exports = router;
