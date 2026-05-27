const crypto = require('node:crypto');

/**
 * attachCsrfCookie — Double Submit Cookie pattern (step 1 of 2).
 * Sets a 'csrfToken' cookie if not already present.
 * httpOnly=false so the frontend JavaScript can read it from document.cookie
 * and send it back in the x-csrf-token header on mutating requests.
 * The cookie is SameSite=strict to prevent cross-origin reads.
 */
const attachCsrfCookie = (req, res, next) => {
  // If not already set, assign a new CSRF token to the user's browser cookie
  if (!req.cookies.csrfToken) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', token, {
      httpOnly: false, // The frontend must read this from document.cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
  next();
};

/**
 * validateCsrf — Double Submit Cookie pattern (step 2 of 2).
 * Compares the csrfToken cookie value against the x-csrf-token request header.
 * GET/HEAD/OPTIONS are safe methods and skip validation.
 * Skipped entirely in NODE_ENV=test to avoid requiring test clients to manage CSRF state.
 *
 * WHY this works: a cross-origin attacker cannot read SameSite=strict cookies
 * from document.cookie, so they cannot replicate the matching header value.
 */
const validateCsrf = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();

  // Pass GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrfToken;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
  }

  // Timing-safe comparison — prevents timing oracle on CSRF token length/value
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  const tokensMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!tokensMatch) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
  }

  next();
};

module.exports = { attachCsrfCookie, validateCsrf };
