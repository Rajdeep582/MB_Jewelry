const express = require('express');
const router = express.Router();
const { protect, deliveryOnly } = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/dpAuthController');

router.post('/register', authLimiter, ctrl.registerDP);
router.post('/login',    loginLimiter, ctrl.loginDP);
router.post('/logout',   protect, deliveryOnly, ctrl.logoutDP);
router.post('/refresh',  ctrl.refreshDP);
router.get('/me',        protect, deliveryOnly, ctrl.getMeDP);
router.get('/profile',   protect, deliveryOnly, ctrl.getProfileDP);
router.patch('/profile', protect, deliveryOnly, ctrl.updateProfileDP);

module.exports = router;
