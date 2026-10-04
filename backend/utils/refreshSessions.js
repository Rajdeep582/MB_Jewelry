const crypto = require('node:crypto');
const { generateRefreshToken } = require('./generateToken');

/**
 * refreshSessions.js — refresh-token rotation shared by the user, admin and delivery portals.
 *
 * Every refresh swaps the session's token hash for a new one (single-use refresh tokens).
 * Two refreshes carrying the SAME cookie can legitimately arrive together — two open tabs whose
 * access tokens expire at the same moment, or a retried request. Without care the slower one
 * looked like a stolen-token replay and wiped every session (the "random logout").
 *
 *   • The swap is atomic (compare-and-set on the old hash), so two parallel requests can never
 *     both rotate and leave the browser holding a token the server no longer knows.
 *   • The previous hash stays valid for REFRESH_REUSE_GRACE_MS. A request inside that window
 *     gets a fresh access token without another rotation; the cookie set by the request that
 *     did rotate stays authoritative.
 *   • Anything older/unknown is still treated as a replay by the caller.
 */
const REFRESH_REUSE_GRACE_MS = 30 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const isLive = (s, now) => s?.expiresAt && new Date(s.expiresAt).getTime() > now;

/**
 * rotateRefreshSession
 * @param {object}  opts
 * @param {import('mongoose').Model} opts.Model  User | Admin | DeliveryPartner
 * @param {object}  opts.doc        document loaded with +sessions
 * @param {string}  opts.token      refresh token from the cookie (already JWT-verified)
 * @param {string}  opts.userType   'user' | 'admin' | 'delivery'
 * @param {object}  opts.req        express request (device + IP for the session entry)
 * @param {boolean} [opts.newSessionId=false]  issue a new sessionId on rotation (admin portal)
 * @returns {Promise<{ status: 'rotated', refreshToken: string } | { status: 'reused' } | { status: 'replay' }>}
 */
async function rotateRefreshSession({ Model, doc, token, userType, req, newSessionId = false }) {
  const now = Date.now();
  const tokenHash = hashToken(token);
  let current = doc;

  const session = (current.sessions || []).find((s) => s.tokenHash === tokenHash && isLive(s, now));
  if (session) {
    const refreshToken = generateRefreshToken(current._id, userType);
    const entry = {
      sessionId: newSessionId ? crypto.randomUUID() : session.sessionId,
      tokenHash: hashToken(refreshToken),
      prevTokenHash: tokenHash,
      rotatedAt: new Date(now),
      deviceId: req.headers['user-agent']?.substring(0, 50) || 'Unknown',
      ipAddress: req.ip,
      createdAt: session.createdAt || new Date(now),
      expiresAt: new Date(now + SESSION_TTL_MS),
    };

    // Compare-and-set: only succeeds if the old hash is still the current one.
    const result = await Model.updateOne(
      { _id: current._id, 'sessions.tokenHash': tokenHash },
      { $set: { 'sessions.$': entry } }
    );
    if (result.modifiedCount === 1) {
      // Housekeeping — drop expired sessions (separate update: can't mix with the positional $set)
      await Model.updateOne({ _id: current._id }, { $pull: { sessions: { expiresAt: { $lte: new Date(now) } } } });
      return { status: 'rotated', refreshToken };
    }
    // A parallel refresh rotated this session first — re-read and fall through to the grace check.
    current = await Model.findById(current._id).select('+sessions');
  }

  const justRotated = (current?.sessions || []).find(
    (s) => s.prevTokenHash === tokenHash
      && s.rotatedAt
      && now - new Date(s.rotatedAt).getTime() <= REFRESH_REUSE_GRACE_MS
      && isLive(s, now)
  );
  if (justRotated) return { status: 'reused' };

  return { status: 'replay' };
}

module.exports = { rotateRefreshSession, hashToken, REFRESH_REUSE_GRACE_MS };
