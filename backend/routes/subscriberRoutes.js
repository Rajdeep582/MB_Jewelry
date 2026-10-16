/**
 * Newsletter Routes — /api/subscribe
 *   POST /  — public footer sign-up, saved as a lead (authLimiter: 20 req / 15 min per IP)
 * Admin list/remove lives in adminRoutes (/api/admin/leads).
 */
const express = require('express');
const router = express.Router();
const { subscribe } = require('../controllers/leadController');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/', authLimiter, subscribe);

module.exports = router;
