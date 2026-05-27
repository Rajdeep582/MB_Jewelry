/**
 * Razorpay gateway configuration.
 *
 * Required env vars:
 *   RAZORPAY_KEY_ID     — public key (sent to frontend for Razorpay Checkout)
 *   RAZORPAY_KEY_SECRET — secret key (used server-side for order creation + HMAC verification)
 *
 * If keys are missing or still set to placeholder values, a stub object is exported
 * instead of a real Razorpay instance. The stub rejects all calls with a clear error
 * → surfaces as 503 at the payment endpoint rather than a cryptic crash.
 *
 * DELIBERATELY NOT configured in test env — tests mock the Razorpay SDK directly.
 *
 * isRazorpayConfigured — boolean exported alongside `razorpay` so controllers can
 * gate-check and return 503 before attempting any SDK call.
 */
const Razorpay = require('razorpay');
const logger = require('../utils/logger');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const isConfigured = keyId && keyId !== 'YOUR_RAZORPAY_KEY_ID'
  && keySecret && keySecret !== 'YOUR_RAZORPAY_KEY_SECRET';

let razorpay;

if (isConfigured) {
  razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
} else {
  // Placeholder — will surface a clear error instead of silently failing
  const ERR = new Error('Razorpay keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  razorpay = {
    orders: {
      create: () => Promise.reject(ERR),
    },
  };
  if (process.env.NODE_ENV !== 'test') {
    logger.warn('Razorpay not configured — payment endpoints will return 503 until keys are added to .env');
  }
}

module.exports = { razorpay, isRazorpayConfigured: isConfigured };
