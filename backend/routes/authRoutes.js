const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { validateSchema, schemas } = require('../middleware/validation');
const { otpLimiter, loginLimiter, authLimiter } = require('../middleware/rateLimiter');

// ─── Validation rule sets ─────────────────────────────────────────────────────
// Validation is imported from validation.js

// ─── Routes ───────────────────────────────────────────────────────────────────

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/register', authLimiter, validateSchema(schemas.register), require('../controllers/authController').register);
router.post('/verify-otp', authLimiter, validateSchema(schemas.verifyOtp), require('../controllers/authController').verifyOTP);
router.post('/login', loginLimiter, validateSchema(schemas.login), require('../controllers/authController').login);
router.post('/google', authLimiter, validateSchema(schemas.googleOAuth), require('../controllers/authController').googleLogin);
router.post('/facebook', authLimiter, validateSchema(schemas.facebookOAuth), require('../controllers/authController').facebookLogin);
router.post('/logout', require('../middleware/auth').protect, require('../controllers/authController').logout);
router.post('/refresh', require('../controllers/authController').refreshToken);
router.get('/me', require('../middleware/auth').protect, require('../controllers/authController').getMe);

// Forgot password flow
router.post('/forgot-password', otpLimiter, validateSchema(schemas.forgotPassword), require('../controllers/authController').forgotPassword);
router.post('/verify-reset-otp', otpLimiter, validateSchema(schemas.verifyOtp), require('../controllers/authController').verifyResetOtp);
router.post('/reset-password', validateSchema(schemas.resetPassword), require('../controllers/authController').resetPassword);

// Device / Session management
router.get('/sessions', require('../middleware/auth').protect, require('../controllers/authController').getActiveSessions);
router.delete('/sessions/all', require('../middleware/auth').protect, require('../controllers/authController').revokeAllSessions);
router.delete('/sessions/:id', require('../middleware/auth').protect, require('../controllers/authController').revokeSession);

module.exports = router;
