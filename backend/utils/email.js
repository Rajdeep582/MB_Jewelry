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
    // Fail fast instead of hanging the request when the SMTP port is unreachable
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
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
 * sendViaBrevoApi — sends through Brevo's HTTPS API (port 443).
 * Needed on hosts that block outbound SMTP ports 25/465/587 (e.g. Railway Hobby/Free plans).
 */
const BRAND_NAME = 'M.B. Jewellers';
/** Display name from a `"Name" <addr>` from-header (falls back to the brand name). */
const senderName = (from) => (typeof from === 'string' && /^"([^"]+)"/.exec(from)?.[1]) || BRAND_NAME;

const sendViaBrevoApi = async ({ from, to, subject, html, replyTo }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY.trim(), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName(from), email: getSender() },
      to: [{ email: to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${data.message || res.statusText}`);
  return { messageId: data.messageId };
};

/**
 * deliver — Brevo HTTPS API when BREVO_API_KEY is set, otherwise SMTP.
 * If the API call fails and SMTP is configured, falls back to SMTP (keeps local dev working).
 */
const deliver = async (mailOptions) => {
  if (process.env.BREVO_API_KEY) {
    try {
      return await sendViaBrevoApi(mailOptions);
    } catch (err) {
      if (!process.env.SMTP_HOST) throw err;
      logger.warn(`Brevo API send failed (${err.message}) — falling back to SMTP`);
    }
  }
  return getTransporter().sendMail(mailOptions);
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
    const from = getSender();

    const mailOptions = {
      from: `"${BRAND_NAME}" <${from}>`,
      to: userEmail,
      subject: '💍 M.B. Jewellers - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #B8860B; text-align: center;">Welcome to M.B. Jewellers!</h2>
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

    const info = await deliver(mailOptions);
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
    const from = getSender();

    const mailOptions = {
      from: `"${BRAND_NAME}" <${from}>`,
      to: userEmail,
      subject: '🔐 M.B. Jewellers - Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #B8860B; text-align: center;">Password Reset Request</h2>
          <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(userName)},</p>
          <p style="font-size: 16px; color: #333;">
            We received a request to reset the password for your M.B. Jewellers account.
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
          <p style="color: #999; font-size: 12px; text-align: center;">M.B. Jewellers will never ask for your password via email or phone.</p>
        </div>
      `,
    };

    const info = await deliver(mailOptions);
    logger.info(`Password reset OTP sent to ${userEmail}. MsgID: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Error sending password reset OTP to ${userEmail}: ${error.message}`);
    throw error;
  }
};

/**
 * sendAdminLoginCode — 2-step verification code for admin sign-in (valid 10 minutes).
 * Includes time + IP so the admin can spot a login they did not start.
 */
const sendAdminLoginCode = async (adminEmail, adminName, otpCode, { ip = '', when = new Date() } = {}) => {
  const from = getSender();
  const time = new Date(when).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const info = await deliver({
    from: `"M.B. Jewellers Admin" <${from}>`,
    to: adminEmail,
    subject: `${otpCode} is your M.B. Jewellers admin login code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #B8860B; text-align: center;">Admin sign-in code</h2>
        <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(adminName || 'Admin')},</p>
        <p style="font-size: 16px; color: #333;">Someone entered your admin password. Use this code to finish signing in. It is valid for <strong>10 minutes</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; background-color: #B8860B; color: #fff; padding: 15px 30px; font-size: 26px; font-weight: bold; border-radius: 6px; letter-spacing: 6px;">${otpCode}</span>
        </div>
        <p style="color: #666; font-size: 13px;">Time: ${escapeHtml(time)} IST${ip ? `<br/>IP: ${escapeHtml(ip)}` : ''}</p>
        <p style="color: #b91c1c; font-size: 14px;"><strong>Not you?</strong> Do not share this code with anyone. Change your admin password right away (Forgot password on the admin login page).</p>
      </div>`,
  });
  logger.info(`Admin login code sent to ${adminEmail}. MsgID: ${info.messageId}`);
  return true;
};

/**
 * sendAdminAlert — emails every active, verified admin about something that needs action
 * (e.g. a payment that arrived after its stock hold expired). Never throws to the caller's flow
 * beyond the returned promise; callers attach .catch().
 */
const sendAdminAlert = async (subject, html) => {
  const Admin = require('../models/Admin');
  const admins = await Admin.find({ isActive: true, isEmailVerified: true }).select('email').lean();
  for (const a of admins) {
    try {
      await deliver({ from: `"M.B. Jewellers Alerts" <${getSender()}>`, to: a.email, subject, html });
    } catch (err) {
      logger.error(`Admin alert to ${a.email} failed: ${err.message}`);
    }
  }
};

/**
 * sendGoogleAccountNotice — someone asked for a password reset on an account that signs in with
 * Google only. The website gives everyone the same reply; the real owner learns why by email.
 */
const sendGoogleAccountNotice = async (userEmail, userName) => {
  const from = getSender();
  const info = await deliver({
    from: `"M.B. Jewellers" <${from}>`,
    to: userEmail,
    subject: 'About your M.B. Jewellers password reset request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #B8860B; text-align: center;">Password reset request</h2>
        <p style="font-size: 16px; color: #333;">Hi ${escapeHtml(userName || 'there')},</p>
        <p style="font-size: 16px; color: #333;">We received a request to reset your password. Your account signs in with <strong>Google</strong>, so it has no separate password.</p>
        <p style="font-size: 16px; color: #333;">Please use <strong>Continue with Google</strong> on the sign-in page.</p>
        <p style="color: #666; font-size: 13px;">If you did not ask for this, you can ignore this email.</p>
      </div>`,
  });
  logger.info(`Google-account notice sent to ${userEmail}. MsgID: ${info.messageId}`);
  return true;
};

/**
 * sendContactMessage — "Send a message" form on the Contact page (signed-in customers only).
 * Goes to the shop inbox (CONTACT_EMAIL, default the shop's Gmail). Reply-To is the customer's
 * account email, so pressing Reply in the inbox answers the customer directly.
 * Text arrives with "<" already turned into "&lt;" (request sanitiser) — undone here, then the
 * whole text is HTML-escaped once.
 */
const CONTACT_INBOX_DEFAULT = 'mbjewellers2021@gmail.com';
const sendContactMessage = async ({ name, email, subject, message }) => {
  const inbox = (process.env.CONTACT_EMAIL || CONTACT_INBOX_DEFAULT).trim();
  const plain = (v) => escapeHtml(String(v || '').replace(/&lt;/g, '<'));
  const who = plain(name) || 'Anonymous';
  const subj = String(subject || '').replace(/&lt;/g, '<').trim() || 'Website message';
  const info = await deliver({
    from: `"M.B. Jewellers Website" <${getSender()}>`,
    to: inbox,
    replyTo: email,
    subject: `Contact form: ${subj}`.slice(0, 150),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #B8860B; margin-top: 0;">New message from the website</h2>
        <p style="font-size: 14px; color: #333;"><strong>From:</strong> ${who}<br/><strong>Email:</strong> ${plain(email)}<br/><strong>Subject:</strong> ${plain(subj)}</p>
        <div style="font-size: 15px; color: #222; white-space: pre-wrap; border-left: 3px solid #D4AF37; padding: 8px 12px; background: #faf7ef;">${plain(message)}</div>
        <p style="color: #888; font-size: 12px;">Reply to this email to answer the customer directly.</p>
      </div>`,
  });
  logger.info(`Contact message from ${email} delivered to shop inbox. MsgID: ${info.messageId}`);
  return true;
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendAdminAlert, sendAdminLoginCode, sendGoogleAccountNotice, sendContactMessage };
