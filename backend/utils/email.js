const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * escapeHtml — sanitises user-controlled strings before embedding in HTML email bodies.
 * Prevents XSS if a malicious name/email somehow reaches the mailer.
 * Escapes: & < > " '
 */
const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/**
 * getTransporter — creates a fresh Nodemailer SMTP transport per call.
 * Throws immediately if any required env var is missing (fail-fast on misconfiguration).
 * TLS cert verification: strict in production, relaxed in dev (allows self-signed certs).
 * DELIBERATELY uses `secure: false` — STARTTLS upgrade handled by nodemailer automatically.
 */
const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('CRITICAL: SMTP credentials missing from environment variables.');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production', // verify TLS cert in prod; allow self-signed in dev
    },
  });
};

/**
 * getSender — returns the From address for outgoing mail.
 * Falls back to 'support@mbjewelry.com' if SMTP_FROM_EMAIL env var not set.
 */
const getSender = () => {
  return process.env.SMTP_FROM_EMAIL ? process.env.SMTP_FROM_EMAIL.trim() : 'support@mbjewelry.com';
};

/**
 * sendVerificationEmail — sends a 6-digit OTP to a user's email for account verification.
 * OTP is valid for 10 minutes (enforced server-side via otpExpires field, not by this mailer).
 * userName is HTML-escaped before embedding to prevent injection.
 * @param {string} userEmail — recipient address
 * @param {string} userName  — display name (HTML-escaped)
 * @param {string} otpCode   — 6-digit OTP string
 * @returns {Promise<true>} on success; throws on SMTP error
 */
const sendVerificationEmail = async (userEmail, userName, otpCode) => {
  try {
    const transporter = getTransporter();
    const from = getSender();

    const mailOptions = {
      from: `"M&B Jewelry" <${from}>`,
      to: userEmail,
      subject: '💍 M&B Jewelry - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #B8860B; text-align: center;">Welcome to M&B Jewelry!</h2>
          <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(userName)},</p>
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

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Verification OTP sent to ${userEmail}. MsgID: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Error sending verification OTP to ${userEmail}: ${error.message}`);
    throw error;
  }
};

/**
 * sendPasswordResetEmail — sends a 6-digit OTP for password reset.
 * Includes a security notice telling users to ignore if they didn't request a reset.
 * OTP validity (10 min) enforced server-side via pwdResetOtpExpires field.
 * @param {string} userEmail — recipient address
 * @param {string} userName  — display name (HTML-escaped)
 * @param {string} otpCode   — 6-digit OTP string
 * @returns {Promise<true>} on success; throws on SMTP error
 */
const sendPasswordResetEmail = async (userEmail, userName, otpCode) => {
  try {
    const transporter = getTransporter();
    const from = getSender();

    const mailOptions = {
      from: `"M&B Jewelry" <${from}>`,
      to: userEmail,
      subject: '🔐 M&B Jewelry - Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #B8860B; text-align: center;">Password Reset Request</h2>
          <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(userName)},</p>
          <p style="font-size: 16px; color: #333;">
            We received a request to reset the password for your M&B Jewelry account.
            Use the code below to proceed. It is valid for <strong>10 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; background-color: #B8860B; color: #fff; padding: 15px 30px; font-size: 24px; font-weight: bold; border-radius: 6px; letter-spacing: 4px;">
              ${otpCode}
            </span>
          </div>
          <div style="background-color: #fff8e1; border-left: 4px solid #B8860B; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #555;">
              ⚠️ <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email.
              Your password will remain unchanged. Do not share this code with anyone.
            </p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">M&B Jewelry will never ask for your password via email or phone.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset OTP sent to ${userEmail}. MsgID: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Error sending password reset OTP to ${userEmail}: ${error.message}`);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
