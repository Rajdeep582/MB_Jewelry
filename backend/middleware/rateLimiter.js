const rateLimit = require('express-rate-limit');
const { logAlert } = require('../utils/alerting');

/**
 * Rate limiters — protect endpoints from brute force, credential stuffing, and spam.
 *
 * All limiters raise their caps drastically in NODE_ENV=test so limiter state doesn't
 * bleed between test cases. The dedicated rate-limit test describe block re-tests at low caps.
 *
 * Exported limiters:
 *   authLimiter    — generic auth routes (register, resend OTP) → 20 req / 15 min
 *   loginLimiter   — login endpoints → 10 req / 15 min (strict, brute-force guard)
 *   otpLimiter     — OTP send endpoints → 5 req / 1 hour (prevents email/SMS flooding)
 *   paymentLimiter — order creation & payment verify → 10 req / 1 min (double-click + replay guard)
 *
 * Limiters fire logAlert() on trigger so security alerts are emitted to the alerting system.
 */
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

// Payment limiter — prevents double-click order creation and brute-force verify
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_TEST ? 10000 : 10,
  message: { success: false, message: 'Too many payment requests. Please wait a moment.' },
});

/**
 * emailOtpLimiter — max 3 code emails per EMAIL ADDRESS per hour (on top of the per-IP limits).
 * Per-IP limits alone are weak behind a proxy (many visitors can share one IP) and let one person
 * flood a customer's inbox from many IPs. Keyed by the normalised email in the body
 * (register / forgot-password / resend-otp); falls back to the IP when no email is given.
 * Uses the same generic reply for every email, so it reveals nothing about which accounts exist.
 */
const EMAIL_OTP_MAX = 3;
const emailOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: EMAIL_OTP_MAX,
  skip: () => IS_TEST && !process.env.TEST_EMAIL_LIMIT,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `email:${email}` : `ip:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many codes requested for this email. Please try again in an hour.' },
  handler: (req, res, next, options) => {
    logAlert('EMAIL_OTP_LIMIT', `OTP email limit hit for ${String(req.body?.email || '').slice(0, 80)}`, req.ip);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * customOrderLimiter — max 5 custom-order requests per CUSTOMER per hour (photos are up to
 * 4 × 10 MB each). Keyed by the signed-in user, so it works behind shared IPs; runs BEFORE the
 * photo upload, so a blocked request uploads nothing.
 */
const CUSTOM_ORDER_MAX_PER_HOUR = 5;
const customOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: CUSTOM_ORDER_MAX_PER_HOUR,
  skip: () => IS_TEST && !process.env.TEST_CUSTOM_ORDER_LIMIT,
  keyGenerator: (req) => (req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'You have sent several custom order requests in the last hour. Please try again later.' },
  handler: (req, res, next, options) => {
    logAlert('CUSTOM_ORDER_LIMIT', `Custom order limit hit by user ${req.user?._id || '-'}`, req.ip);
    res.status(options.statusCode).json(options.message);
  },
});

/** contactLimiter — Contact-page messages: max 5 per signed-in customer per hour (inbox spam guard). */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => IS_TEST && !process.env.TEST_CONTACT_LIMIT,
  keyGenerator: (req) => (req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'You have sent several messages in the last hour. Please try again later or call us.' },
});

module.exports = { authLimiter, loginLimiter, otpLimiter, paymentLimiter, emailOtpLimiter, EMAIL_OTP_MAX, customOrderLimiter, CUSTOM_ORDER_MAX_PER_HOUR, contactLimiter };
