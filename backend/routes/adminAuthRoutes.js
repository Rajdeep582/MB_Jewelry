/**
 * Admin Authentication Routes — /api/admin-auth
 *
 * POST /register              — register new admin account (authLimiter)
 * POST /verify-email          — submit email OTP to activate account (otpLimiter, 5-attempt lockout)
 * POST /resend-otp            — resend verification OTP (otpLimiter)
 * POST /login                 — admin login → access + refresh tokens (loginLimiter)
 * POST /logout                — invalidate current session (protect + adminOnly)
 * POST /refresh               — rotate refresh token → new access token
 * GET  /me                    — return current admin profile (protect + adminOnly)
 * PATCH /profile/name         — update display name (protect + adminOnly)
 * POST /profile/request-email-change — send OTP to new email address (protect + adminOnly)
 * POST /profile/confirm-email-change — verify OTP and commit new email (protect + adminOnly, 5-attempt lockout)
 */
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { loginLimiter, authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validateSchema, schemas } = require('../middleware/validation');
const ctrl = require('../controllers/adminAuthController');

router.post('/register',     authLimiter,  validateSchema(schemas.adminRegister),     ctrl.register);
router.post('/verify-email', otpLimiter,   validateSchema(schemas.adminVerifyEmail),  ctrl.verifyEmail);
router.post('/resend-otp',   otpLimiter,   validateSchema(schemas.adminResendOtp),    ctrl.resendOtp);
router.post('/login',        loginLimiter, validateSchema(schemas.adminLogin),        ctrl.login);
router.post('/logout',       protect, adminOnly, ctrl.logout);
router.post('/refresh',      ctrl.refreshToken);
router.get('/me',            protect, adminOnly, ctrl.getMe);
router.patch('/profile/name',                protect, adminOnly, ctrl.updateName);
router.post('/profile/request-email-change', protect, adminOnly, ctrl.requestEmailChange);
router.post('/profile/confirm-email-change', protect, adminOnly, ctrl.confirmEmailChange);

module.exports = router;
