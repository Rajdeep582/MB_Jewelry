const logger = require('./logger');

/**
 * Standardize alerts for critical events.
 * In a real-world enterprise setting, this could ping Slack or email the admin directly.
 */
const logAlert = (actionType, details, reqIp = 'Unknown') => {
  const alertStr = `CRITICAL ALERT [${actionType}] - ${details} (IP: ${reqIp})`;
  logger.warn(alertStr);
  
  // Future: Hook this up to `nodemailer` to dispatch an explicit Admin warning email
  // Example: sendAlertEmailToAdmin(actionType, details, reqIp);
};

module.exports = { logAlert };
