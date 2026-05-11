const logger = require('../utils/logger');

/**
 * IP whitelist for admin routes.
 * Set ADMIN_ALLOWED_IPS in .env as comma-separated list.
 * If ADMIN_ALLOWED_IPS is empty or unset, whitelist is DISABLED (dev mode — all IPs allowed).
 * Use 0.0.0.0/0 to allow all IPs (open access).
 *
 * Examples:
 *   ADMIN_ALLOWED_IPS=203.0.113.10,198.51.100.5
 *   ADMIN_ALLOWED_IPS=203.0.113.10,127.0.0.1   # include localhost explicitly if needed
 *   ADMIN_ALLOWED_IPS=0.0.0.0/0                 # allow all
 *   # leave blank during development to allow all IPs
 */
const adminIpWhitelist = (req, res, next) => {
  const raw = process.env.ADMIN_ALLOWED_IPS || '';
  const allowedIps = raw.split(',').map((ip) => ip.trim()).filter(Boolean);

  // Whitelist disabled — allow all (dev / not configured)
  if (allowedIps.length === 0) return next();

  // 0.0.0.0/0 = allow all IPs explicitly
  if (allowedIps.includes('0.0.0.0/0')) return next();

  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const normalised = clientIp.replace('::ffff:', ''); // strip IPv4-mapped IPv6 prefix

  if (allowedIps.includes(normalised) || allowedIps.includes(clientIp)) {
    return next();
  }

  logger.warn(`Admin portal access denied for IP ${clientIp} — not in whitelist`);
  return res.status(403).json({ success: false, message: 'Access denied: your IP is not authorized.' });
};

module.exports = adminIpWhitelist;
