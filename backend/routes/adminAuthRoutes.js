/**
 * Admin Authentication Routes — /api/admin-auth
 *
 * POST /register              — register new admin account (authLimiter)
 * POST /verify-email          — submit email OTP to activate account (otpLimiter, 5-attempt lockout)
 * POST /resend-otp            — resend verification OTP (otpLimiter)
 * POST /login/verify       — 2-step: check the emailed login code → tokens
 * POST /login/resend       — 2-step: email a new login code
 * POST /login                 — admin login → access + refresh tokens (loginLimiter)
 * POST /logout                — invalidate current session (protect + adminOnly)
 * POST /refresh               — rotate refresh token → new access token
 * GET  /me                    — return current admin profile (protect + adminOnly)
 * PATCH /profile/name         — update display name (protect + adminOnly)
 * POST /profile/request-email-change — send OTP to new email address (protect + adminOnly)
 * POST /profile/confirm-email-change — verify OTP and commit new email (protect + adminOnly, 5-attempt lockout)
 * POST /forgot-password     — email a 6-digit password reset code (otpLimiter)
 * POST /verify-reset-otp    — verify code → one-time reset token (authLimiter, 5-attempt lockout)
 * POST /reset-password      — set new password with reset token, revokes all sessions (authLimiter)
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { loginLimiter, authLimiter, otpLimiter, emailOtpLimiter } = require('../middleware/rateLimiter');
const { validateSchema, schemas } = require('../middleware/validation');
const ctrl = require('../controllers/adminAuthController');

router.post('/register',     authLimiter,  emailOtpLimiter, validateSchema(schemas.adminRegister),     ctrl.register);
router.post('/verify-email', otpLimiter,   validateSchema(schemas.adminVerifyEmail),  ctrl.verifyEmail);
router.post('/resend-otp',   otpLimiter,   emailOtpLimiter, validateSchema(schemas.adminResendOtp),    ctrl.resendOtp);
router.post('/login',        loginLimiter, validateSchema(schemas.adminLogin),        ctrl.login);
router.post('/login/verify', loginLimiter, ctrl.verifyLogin);                        // step 2: emailed 6-digit code
router.post('/login/resend', otpLimiter,   emailOtpLimiter, ctrl.resendLoginCode);     // new code for the same sign-in
router.post('/logout',       protect, adminOnly, ctrl.logout);
router.post('/refresh',      ctrl.refreshToken);
router.get('/me',            protect, adminOnly, ctrl.getMe);
router.patch('/profile/name',                protect, adminOnly, ctrl.updateName);
router.post('/profile/request-email-change', protect, adminOnly, ctrl.requestEmailChange);
router.post('/profile/confirm-email-change', protect, adminOnly, ctrl.confirmEmailChange);

// Forgot password (public)
router.post('/forgot-password',  otpLimiter,  emailOtpLimiter, validateSchema(schemas.forgotPassword), ctrl.forgotPassword);
router.post('/verify-reset-otp', authLimiter, validateSchema(schemas.verifyResetOtp), ctrl.verifyResetOtp);
router.post('/reset-password',   authLimiter, validateSchema(schemas.resetPassword),  ctrl.resetPassword);

module.exports = router;
