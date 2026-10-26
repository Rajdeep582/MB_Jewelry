/**
 * Contact Routes — /api/contact
 *   POST /  — "Send a message" on the Contact page. Signed-in customers only: the reply address
 *             is the account email (never typed in). Google accounts: the Google name is used;
 *             email/password accounts: optional typed name ("Anonymous" when empty).
 *             Delivered to the shop inbox (utils/email.sendContactMessage); 5 messages / hour / customer.
 */
const express = require('express');
const router = express.Router();
const { protect, userOnly } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');
const { validateSchema, schemas } = require('../middleware/validation');
const { sendContactMessage } = require('../utils/email');
const logger = require('../utils/logger');

router.post('/', protect, userOnly, contactLimiter, validateSchema(schemas.contactMessage), async (req, res) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Your account has no email address. Please add one in your profile, or call us.' });
  }
  const { name = '', subject = '', message } = req.body;
  // Signed in with Google → the Google account name is always used (a typed name is ignored).
  // Email/password account → the typed name, or "Anonymous" when left empty.
  const isGoogle = (req.user.providers || []).some((p) => p.providerType === 'google');
  const senderName = isGoogle ? String(req.user.name || '').trim() : name.trim();
  try {
    await sendContactMessage({ name: senderName, email, subject, message });
  } catch (err) {
    logger.error(`Contact message from ${email} failed: ${err.message}`);
    return res.status(502).json({ success: false, message: 'Could not send your message right now. Please try again or call us.' });
  }
  return res.json({ success: true, message: 'Message sent! We will reply to your email within 24 hours.' });
});

module.exports = router;
