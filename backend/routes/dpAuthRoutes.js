const express = require('express');
const router = express.Router();
const { protect, deliveryOnly } = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiter');
const { validateSchema, schemas } = require('../middleware/validation');
const ctrl = require('../controllers/dpAuthController');

router.post('/register', authLimiter,  validateSchema(schemas.dpRegister), ctrl.registerDP);
router.post('/login',    loginLimiter, validateSchema(schemas.dpLogin),    ctrl.loginDP);
router.post('/logout',   protect, deliveryOnly, ctrl.logoutDP);
router.post('/refresh',  ctrl.refreshDP);
router.get('/me',        protect, deliveryOnly, ctrl.getMeDP);
router.get('/profile',   protect, deliveryOnly, ctrl.getProfileDP);
router.patch('/profile', protect, deliveryOnly, ctrl.updateProfileDP);

module.exports = router;
