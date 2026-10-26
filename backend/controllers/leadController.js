const Lead = require('../models/Lead');
const User = require('../models/User');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ROWS = 5000;

/**
 * subscribe — POST /api/subscribe (public, rate-limited)
 * Footer "Stay Connected" sign-up → saved as a newsletter lead. Repeats are a no-op.
 */
const subscribe = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  const prev = await Lead.findOneAndUpdate(
    { email },
    { $setOnInsert: { email }, $addToSet: { sources: 'newsletter' } },
    { upsert: true, new: false }
  ).lean();

  const already = !!prev?.sources?.includes('newsletter');
  return res.status(already ? 200 : 201).json({
    success: true,
    alreadySubscribed: already,
    message: already ? 'You are already subscribed.' : 'Thank you for subscribing!',
  });
};

/**
 * listLeads — GET /api/admin/leads (admin)
 * Every customer account (name, phone, email) + footer newsletter emails that don't belong
 * to an account. One row per email, newest first.
 */
const listLeads = async (req, res) => {
  const [users, newsletter, noted] = await Promise.all([
    User.find({}).select('name email phone mobile addresses.phone createdAt').sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
    Lead.find({ sources: 'newsletter' }).select('email createdAt').sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
    Lead.find({ note: { $gt: '' } }).select('email note').limit(MAX_ROWS).lean(),
  ]);
  const notes = new Map(noted.map((l) => [l.email, l.note]));

  const rows = [];
  const seen = new Set();
  for (const u of users) {
    const email = u.email ? String(u.email).toLowerCase() : '';
    if (email) seen.add(email);
    rows.push({
      _id: String(u._id),
      name: u.name || '',
      email,
      phone: u.phone || u.mobile || u.addresses?.find((a) => a.phone)?.phone || '',
      note: notes.get(email) || '',
      createdAt: u.createdAt,
    });
  }
  for (const l of newsletter) {
    if (seen.has(l.email)) continue;
    rows.push({ _id: String(l._id), name: '', email: l.email, phone: '', note: notes.get(l.email) || '', createdAt: l.createdAt });
  }
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, total: rows.length, leads: rows });
};

/**
 * saveLeadNote — PUT /api/admin/leads/note (admin)
 * Body { email, note }. Saves the admin's reminder for a lead (customer account or newsletter
 * email). Empty note clears it. Only emails that are actually leads are accepted.
 */
const saveLeadNote = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { note } = req.body || {};
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email.' });
  }
  if (typeof note !== 'string' || note.trim().length > 500) {
    return res.status(400).json({ success: false, message: 'Note must be text, up to 500 characters.' });
  }

  const isLead = (await User.exists({ email })) || (await Lead.exists({ email, sources: 'newsletter' }));
  if (!isLead) return res.status(404).json({ success: false, message: 'Lead not found.' });

  const clean = note.trim();
  await Lead.updateOne({ email }, { $set: { note: clean }, $setOnInsert: { email } }, { upsert: true });
  res.json({ success: true, note: clean });
};

module.exports = { subscribe, listLeads, saveLeadNote };
