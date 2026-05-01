const rateLimit = require('express-rate-limit');
const { logAlert } = require('../utils/alerting');

// In test mode we raise the caps drastically so limiter state doesn't bleed
// between test cases. The rate-limit describe block tests them at low caps.
const IS_TEST = process.env.NODE_ENV === 'test';

// Standard generic auth rate limiter (e.g. 20 requests per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 10000 : 20,
  message: { success: false, message: 'Too many authentication requests, please try again later.' },
  handler: (req, res, next, options) => {
    logAlert('RATE_LIMIT_EXCEEDED', `Auth endpoints hit max limits from IP ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

// Login limiter (Strict prevents brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: IS_TEST ? 10000 : 10, // 10 attempts
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    logAlert('BRUTE_FORCE_ATTEMPT', `Login endpoints hit max attempts from IP ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

// OTP limiter (Prevents sending too many emails)
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: IS_TEST ? 10000 : 5,
  message: { success: false, message: 'Too many OTP requests from this IP. Please try again in an hour.' },
});

module.exports = { authLimiter, loginLimiter, otpLimiter };
