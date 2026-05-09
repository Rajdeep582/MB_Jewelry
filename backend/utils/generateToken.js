const jwt = require('jsonwebtoken');

/**
 * Generate short-lived access token.
 * userType: 'user' | 'admin' | 'delivery'
 */
const generateAccessToken = (userId, role, userType = 'user') => {
  return jwt.sign({ id: userId, role, userType }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
};

const generateRefreshToken = (userId, userType = 'user') => {
  return jwt.sign({ id: userId, userType }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
};

const sendRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

module.exports = { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie };
