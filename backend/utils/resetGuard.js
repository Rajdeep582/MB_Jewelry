/**
 * resetGuard.js — per-ACCOUNT cap on wrong password-reset codes.
 *
 * Each code allows 5 tries, but asking for a new code starts a fresh 5. This guard counts wrong
 * codes per account over a rolling 24 h: after DAILY_MAX_FAILS, no new codes are sent and no
 * code is accepted until the window ends. Works on User, Admin and DeliveryPartner documents
 * (fields pwdResetFails / pwdResetFailsSince, select: false).
 */
const DAILY_MAX_FAILS = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const RESET_GUARD_FIELDS = '+pwdResetFails +pwdResetFailsSince';
const RESET_BLOCKED_MSG = 'Too many wrong codes for this account. Please try again in 24 hours.';

const windowOpen = (doc) => doc.pwdResetFailsSince && Date.now() - new Date(doc.pwdResetFailsSince).getTime() < WINDOW_MS;

function resetBlocked(doc) {
  return !!(windowOpen(doc) && (doc.pwdResetFails || 0) >= DAILY_MAX_FAILS);
}

function recordResetFail(doc) {
  if (!windowOpen(doc)) {
    doc.pwdResetFails = 0;
    doc.pwdResetFailsSince = new Date();
  }
  doc.pwdResetFails = (doc.pwdResetFails || 0) + 1;
}

function clearResetFails(doc) {
  doc.pwdResetFails = 0;
  doc.pwdResetFailsSince = undefined;
}

module.exports = { DAILY_MAX_FAILS, RESET_GUARD_FIELDS, RESET_BLOCKED_MSG, resetBlocked, recordResetFail, clearResetFails };
