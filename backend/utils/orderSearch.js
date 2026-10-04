const mongoose = require('mongoose');
const User = require('../models/User');

// Support search helper — shared by admin order lists (regular + custom orders)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * buildOrderSearch — $or conditions that locate an order from whatever the customer quotes.
 * Returns null for an empty search. Input is regex-escaped and capped (no ReDoS / injection).
 *   • order ID (ORD-… / CUS-…)  • tracking number MB-XXXXXXXX (→ deliveryId)  • Mongo _id
 *   • customer name / email / phone (User lookup)  • shipping name / phone / PIN / city
 *   • Razorpay payment / order ID
 */
async function buildOrderSearch(search, { idField, paymentPaths = ['payment.razorpayPaymentId', 'payment.razorpayOrderId'], extra }) {
  const q = String(search ?? '').trim().slice(0, 64);
  if (!q) return null;
  const rx = new RegExp(escapeRegex(q), 'i');
  const or = [
    { [idField]: rx },
    { 'shippingAddress.fullName': rx },
    { 'shippingAddress.phone': rx },
    { 'shippingAddress.pincode': rx },
    { 'shippingAddress.city': rx },
    ...paymentPaths.map((p) => ({ [p]: q })),
    ...(extra ? extra(rx) : []),
  ];

  // Tracking number as shown to customers: MB-XXXXXXXX = tail of the deliveryId UUID
  const tracking = q.replace(/^MB-?/i, '').replaceAll('-', '');
  if (/^[0-9a-f]{4,32}$/i.test(tracking)) {
    or.push({ deliveryId: new RegExp(escapeRegex(tracking), 'i') });
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
    or.push({ deliveryId: q.toLowerCase() });
  }
  if (mongoose.isValidObjectId(q) && /^[0-9a-f]{24}$/i.test(q)) or.push({ _id: q });

  const users = await User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
    .select('_id').limit(200).lean();
  if (users.length) or.push({ user: { $in: users.map((u) => u._id) } });

  return or;
}

module.exports = { buildOrderSearch, escapeRegex };
