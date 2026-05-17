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
