const axios = require('axios');
const logger = require('./logger');

/**
 * Send SMS OTP via Brevo Transactional SMS API.
 * Requires env vars:
 *   BREVO_API_KEY   — your Brevo API key (v3)
 *   BREVO_SMS_FROM  — sender name (11 chars max, no spaces, e.g. "MBJewels")
 *
 * Docs: https://developers.brevo.com/reference/sendtransactalsms
 */
const sendSmsOtp = async (mobile, otp) => {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_FROM || 'MBJewels';

  if (!apiKey) {
    logger.error('BREVO_API_KEY not set. Cannot send SMS OTP.');
    throw new Error('SMS service not configured.');
  }

  // Normalise to E.164 (+91XXXXXXXXXX)
  const normalised = mobile.replace(/[-\s]/g, '').startsWith('+91')
    ? mobile.replace(/[-\s]/g, '')
    : `+91${mobile.replace(/[-\s]/g, '').replace(/^91/, '')}`;

  const payload = {
    sender,
    recipient: normalised,
    content: `Your M.B. Jewellers OTP is ${otp}. Valid for 10 minutes. Do not share.`,
    type: 'transactional',
  };

  try {
    const { data } = await axios.post(
      'https://api.brevo.com/v3/transactionalSMS/sms',
      payload,
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
    logger.info(`SMS OTP sent to ${normalised}. messageId=${data.messageId}`);
    return true;
  } catch (err) {
    const brevoError = err.response?.data;
    logger.error(`SMS send failed to ${normalised}: status=${err.response?.status} body=${JSON.stringify(brevoError)} msg=${err.message}`);
    const userMsg = brevoError?.message || err.message;
    throw new Error(`Failed to send SMS OTP: ${userMsg}`);
  }
};

module.exports = { sendSmsOtp };
