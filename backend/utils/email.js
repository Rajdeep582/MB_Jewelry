const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

const sendVerificationEmail = async (userEmail, userName, otpCode) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('CRITICAL: SENDGRID_API_KEY missing from environment variables.');
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY.trim());

    const verifiedSender = process.env.SENDGRID_FROM_EMAIL 
      ? process.env.SENDGRID_FROM_EMAIL.trim() 
      : 'support@mbjewelry.com';

    const msg = {
      to: userEmail,
      from: verifiedSender,
      subject: '💍 M&B Jewelry - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #B8860B; text-align: center;">Welcome to M&B Jewelry!</h2>
          <p style="font-size: 16px; color: #333;">Hi ${userName},</p>
          <p style="font-size: 16px; color: #333;">Please use the following 6-digit code to verify your email address. This code is valid for <strong>10 minutes</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; background-color: #B8860B; color: #fff; padding: 15px 30px; font-size: 24px; font-weight: bold; border-radius: 6px; letter-spacing: 4px;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">If you didn't attempt to register an account, please safely ignore this email.</p>
        </div>
      `,
    };

    const response = await sgMail.send(msg);
    logger.info(`OTP Email sent to ${userEmail} via SendGrid. ID: ${response[0].headers['x-message-id']}`);
    return true;
  } catch (error) {
    logger.error(`Error sending OTP to ${userEmail}: ${error.message}`);
    if (error.response) {
      logger.error(error.response.body); // SendGrid specific error parsing
    }
    throw error;
  }
};

module.exports = { sendVerificationEmail };
