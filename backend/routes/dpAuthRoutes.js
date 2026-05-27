/**
 * Delivery Partner Authentication Routes — /api/dp-auth
 *
 * POST /register  — register DP account (authLimiter); account inactive until admin approves
 * POST /login     — DP login → access + refresh tokens (loginLimiter); blocked if not approved
 * POST /logout    — invalidate current session (protect + deliveryOnly)
 * POST /refresh   — rotate refresh token → new access token
 * GET  /me        — return minimal DP identity (protect + deliveryOnly)
 * GET  /profile   — return full DP profile (protect + deliveryOnly)
 * PATCH /profile  — update DP profile fields (protect + deliveryOnly)
 */
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
