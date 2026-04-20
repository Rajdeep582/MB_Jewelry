const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/orderController');

// NOTE: This route uses express.raw() body parsing (mounted BEFORE express.json() in server.js)
// so that we can compute the HMAC signature over the exact raw bytes Razorpay sent.
router.post('/razorpay', handleWebhook);

module.exports = router;
