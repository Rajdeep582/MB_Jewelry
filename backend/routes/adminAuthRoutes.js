const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { loginLimiter, authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/adminAuthController');

router.post('/register',     authLimiter,  ctrl.register);
router.post('/verify-email', otpLimiter,   ctrl.verifyEmail);
router.post('/resend-otp',   otpLimiter,   ctrl.resendOtp);
router.post('/login',        loginLimiter, ctrl.login);
router.post('/logout',       protect, adminOnly, ctrl.logout);
router.post('/refresh',      ctrl.refreshToken);
router.get('/me',            protect, adminOnly, ctrl.getMe);
router.patch('/profile/name',                protect, adminOnly, ctrl.updateName);
router.post('/profile/request-email-change', protect, adminOnly, ctrl.requestEmailChange);
router.post('/profile/confirm-email-change', protect, adminOnly, ctrl.confirmEmailChange);

module.exports = router;
