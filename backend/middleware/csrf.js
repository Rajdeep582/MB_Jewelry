const crypto = require('node:crypto');

/**
 * attachCsrfCookie — Double Submit Cookie pattern (step 1 of 2).
 * Sets a 'csrfToken' cookie if not already present, and echoes the token in the
 * X-CSRF-Token response header.
 *
 * WHY THE HEADER: in production the frontend (e.g. Vercel) and the API live on
 * different domains. JavaScript on the frontend origin can never read a cookie that
 * belongs to the API domain via document.cookie, so without the header the client
 * could not send x-csrf-token and every POST/PUT/DELETE (login included) got 403.
 * The header is only readable by origins allowed by CORS (exposedHeaders in server.js),
 * so a cross-origin attacker still cannot learn the token.
 *
 * SameSite: 'none' in production (cookie must ride along cross-site API calls, same as
 * the refresh cookie), 'strict' locally.
 */
const attachCsrfCookie = (req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  let token = req.cookies.csrfToken;
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', token, {
      httpOnly: false, // same-origin setups may still read it from document.cookie
      secure: isProd,
      sameSite: isProd ? 'none' : 'strict',
    });
  }
  res.setHeader('X-CSRF-Token', token);
  next();
};

/**
 * validateCsrf — Double Submit Cookie pattern (step 2 of 2).
 * Compares the csrfToken cookie value against the x-csrf-token request header.
 * GET/HEAD/OPTIONS are safe methods and skip validation.
 * Skipped entirely in NODE_ENV=test to avoid requiring test clients to manage CSRF state.
 *
 * WHY this works: a cross-origin attacker can neither read the cookie nor the
 * X-CSRF-Token response header (CORS blocks it), so they cannot replicate the header value.
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
