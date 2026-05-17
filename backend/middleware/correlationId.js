const crypto = require('node:crypto');

/**
 * Attach a correlation ID to every request for distributed tracing.
 * Respects an upstream x-correlation-id header (e.g. from a load balancer or API gateway).
 * The ID is echoed back in the response header so the client can correlate logs.
 */
const correlationId = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
};

module.exports = { correlationId };
