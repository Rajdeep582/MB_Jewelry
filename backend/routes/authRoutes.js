const express = require('express');
const router = express.Router();
const { validateSchema, schemas } = require('../middleware/validation');
const { otpLimiter, loginLimiter, authLimiter } = require('../middleware/rateLimiter');

// ─── Validation rule sets ─────────────────────────────────────────────────────
// Validation is imported from validation.js

const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/send-mobile-otp', otpLimiter,  validateSchema(schemas.sendMobileOtp), ctrl.sendMobileOtp);
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
