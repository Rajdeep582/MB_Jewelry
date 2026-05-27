const logger = require('../utils/logger');

/**
 * errorHandler — Express centralized error handler (must have 4 params).
 * Registered LAST in server.js after all routes.
 *
 * NORMALIZES:
 *   - Mongoose ValidationError  → 400 with joined field messages
 *   - Mongoose duplicate key (11000) → 400 with field name in message
 *   - Mongoose CastError (bad ObjectId) → 400
 *   - JsonWebTokenError / TokenExpiredError → 401
 *   - All others → 500 (statusCode from err.statusCode if set)
 *
 * In development: includes stack trace in response.
 * In production: stack trace is stripped.
 * All errors are logged with correlationId for tracing.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip} - correlationId=${req.correlationId || 'none'}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };
