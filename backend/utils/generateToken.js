const jwt = require('jsonwebtoken');

/**
 * generateAccessToken — creates a short-lived JWT for API authorization.
 * Payload: { id, role, userType }
 * Expiry: JWT_EXPIRE env var (default 15 minutes)
 * Used by: auth middleware (protect) to identify the caller on each request.
 * userType 'user' | 'admin' | 'delivery' — tells protect which model to load.
 */
const generateAccessToken = (userId, role, userType = 'user') => {
  return jwt.sign({ id: userId, role, userType }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
};

/**
 * generateRefreshToken — creates a long-lived JWT stored server-side (hashed in sessions array).
 * Payload: { id, userType }
 * Expiry: JWT_REFRESH_EXPIRE env var (default 7 days)
 * Single-use: each use rotates to a new token (old one invalidated) → replay attack protection.
 */
const generateRefreshToken = (userId, userType = 'user') => {
  return jwt.sign({ id: userId, userType }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
};

/**
 * sendRefreshTokenCookie — sets the refreshToken as an httpOnly cookie.
 * httpOnly: JS cannot read it → XSS-safe.
 * secure: true in production (HTTPS only).
 * sameSite: 'none' in production (allows cross-origin for deployed frontend/backend on different domains),
 *           'strict' in development (same-origin only).
 * maxAge: 7 days (matches JWT_REFRESH_EXPIRE).
 */
const sendRefreshTokenCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/**
 * clearRefreshTokenCookie — removes the refreshToken cookie on logout.
 * Must use same options (secure, sameSite) as sendRefreshTokenCookie to match the Set-Cookie header.
 */
const clearRefreshTokenCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'strict',
  });
};

module.exports = { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie, clearRefreshTokenCookie };
