const Razorpay = require('razorpay');

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
    console.warn('⚠️  Razorpay not configured — payment endpoints will return errors');
  }
}

module.exports = { razorpay, isRazorpayConfigured: isConfigured };
