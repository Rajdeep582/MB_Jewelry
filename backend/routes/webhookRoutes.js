/**
 * Webhook Routes — /api/webhooks
 *
 * POST /razorpay — receives Razorpay payment event webhooks.
 *
 * CRITICAL: This route is mounted with express.raw({ type: 'application/json' }) body parser
 * in server.js, BEFORE the global express.json() parser. This preserves the exact raw bytes
 * that Razorpay signed, so our HMAC-SHA256 verification (crypto.timingSafeEqual) matches.
 * If express.json() ran first, body re-serialisation would break the signature.
 *
 * Security: only Razorpay's servers should be calling this endpoint.
 * Signature is verified inside handleWebhook before any state mutation occurs.
 * No authentication middleware needed — HMAC IS the authentication.
 */
const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/orderController');

// NOTE: This route uses express.raw() body parsing (mounted BEFORE express.json() in server.js)
// so that we can compute the HMAC signature over the exact raw bytes Razorpay sent.
router.post('/razorpay', handleWebhook);

module.exports = router;
