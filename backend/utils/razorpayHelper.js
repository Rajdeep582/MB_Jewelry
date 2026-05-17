const crypto = require('node:crypto');

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature to verify
 * @returns {boolean}
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  try {
    // Timing-safe comparison — prevents side-channel attacks leaking signature bytes
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false; // Buffer length mismatch → invalid signature
  }
};

module.exports = { verifyRazorpaySignature };
