/**
 * portalHint.js — sign-in replies that never reveal which accounts exist.
 *
 * Every failed sign-in (unknown email, wrong password, locked account) gets the SAME reply
 * (LOGIN_FAILED), and an unknown email still pays the cost of one bcrypt check so response
 * times do not give it away either.
 *
 * The friendly "you are registered on another portal" hint is kept, but only for someone who
 * proves they own that account: it is shown only when the password is correct for the account
 * on the other portal. A guesser learns nothing.
 */
const bcrypt = require('bcryptjs');

const LOGIN_FAILED = 'Invalid email or password. After 5 wrong attempts, sign-in is paused for 15 minutes.';

// bcrypt hash of a random string — compared against when the email is unknown (equal timing)
const DUMMY_HASH = '$2a$12$RDjpTcvY7Tz86zG3uVgUcecBrHGktFnqchuFFfhTT55xtGStAldx.';

async function equaliseTiming(password) {
  try { await bcrypt.compare(String(password || ''), DUMMY_HASH); } catch { /* ignore */ }
}

const PORTALS = {
  user:     { model: () => require('../models/User'),            message: 'You are registered as Customer. Please login through the Customer portal.' },
  delivery: { model: () => require('../models/DeliveryPartner'), message: 'You are registered as Delivery Partner. Please login through the Delivery Partner portal.' },
  admin:    { model: () => require('../models/Admin'),           message: 'You are registered as Admin. Please login through the Admin portal.' },
};

/**
 * otherPortalHint — the hint message when (email, password) is valid on one of `portals`, else null.
 * @param {string}   email
 * @param {string}   password
 * @param {string[]} portals  e.g. ['delivery'] — admin accounts are only hinted on the admin side
 */
async function otherPortalHint(email, password, portals) {
  const e = String(email || '').toLowerCase().trim();
  if (!e || typeof password !== 'string' || !password) return null;
  for (const key of portals) {
    const portal = PORTALS[key];
    const doc = await portal.model().findOne({ email: e }).select('+password').lean();
    if (doc?.password && await bcrypt.compare(password, doc.password).catch(() => false)) return portal.message;
  }
  return null;
}

module.exports = { LOGIN_FAILED, otherPortalHint, equaliseTiming };
