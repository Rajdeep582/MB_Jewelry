const crypto = require('node:crypto');

// Generate and attach a CSRF token to the response cookie
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

// Validate incoming requests against the Double Submit Cookie
const validateCsrf = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();

  // Pass GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies.csrfToken;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
  }

  next();
};

module.exports = { attachCsrfCookie, validateCsrf };
