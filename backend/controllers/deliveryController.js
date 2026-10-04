const mongoose = require('mongoose');
const Order       = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * _source tag added to every returned document so the frontend knows which
 * confirm endpoint to call and how to render the card.
 * 'order'        → regular Order model
 * 'custom_order' → CustomOrder model
 */
const normaliseOrder = (doc) => ({ ...doc, _source: 'order' });
const normaliseCustom = (doc) => ({ ...doc, _source: 'custom_order' });

// ─── GET /api/delivery/orders ─────────────────────────────────────────────────
/**
 * getMyDeliveries
 * @route  GET /api/delivery/orders
 * @access Delivery partner only (deliveryOnly middleware)
 *
 * Returns ALL orders with status "shipped" or "delivered".
 * No per-agent assignment — every authenticated DP sees the full list.
 * Business model: single DP, no individual order assignment needed.
 *
 * Returns both regular Orders and CustomOrders in separate arrays,
 * each normalised with _source so the frontend can route confirm calls.
 *
 * WHAT DP CAN DO AFTER SEEING THIS LIST:
 *   Only: POST /api/delivery/orders/:id/confirm  →  sets dpConfirmedAt flag.
 *   Cannot: change orderStatus in any way. All status transitions are admin-only
 *           via PUT /api/orders/:id/status.
 *
 * ADMIN FLOW (after DP confirms):
 *   Admin sees dpConfirmedAt indicator in panel → types DELIVERED → admin marks
 *   order.orderStatus = 'delivered'. Without dpConfirmedAt, admin is blocked.
 */
const DELIVERY_ORDER_STATUSES  = ['shipped', 'delivered'];
const DELIVERY_CUSTOM_STATUSES = ['shipped', 'delivered'];

// Internal / payment fields a delivery partner never needs to see
const DP_HIDDEN_ORDER  = '-payment.razorpaySignature -payment.razorpayPaymentId -payment.razorpayOrderId -payment.failReason';
const DP_HIDDEN_CUSTOM = '-adminNotes -advancePayment -finalPayment -description -budget';

const getMyDeliveries = async (req, res) => {
  const [orders, customOrders] = await Promise.all([
    Order.find({ orderStatus: { $in: DELIVERY_ORDER_STATUSES } })
      .select(DP_HIDDEN_ORDER)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean(),
    CustomOrder.find({ status: { $in: DELIVERY_CUSTOM_STATUSES } })
      .select(DP_HIDDEN_CUSTOM)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  res.json({
    success: true,
    orders:       orders.map(normaliseOrder),
    customOrders: customOrders.map(normaliseCustom),
  });
};

// ─── POST /api/delivery/orders/:id/confirm ────────────────────────────────────
/**
 * confirmDelivery
 * @route  POST /api/delivery/orders/:id/confirm
 * @access Delivery partner only (deliveryOnly middleware)
 *
 * DP calls this after physically delivering the order. Sets a flag only —
 * does NOT change orderStatus. Admin must still mark the order "delivered"
 * in the admin panel, and admin is blocked from doing so until this flag exists.
 *
 * BODY:
 *   source  {string}  'order' | 'custom_order'  — which model to update
 *   note    {string}  optional delivery note (e.g. "Left at door")
 *
 * FIELDS SET ON THE DOCUMENT:
 *   dpConfirmedAt  — timestamp of DP confirmation
 *   dpConfirmedBy  — DP's user._id (audit trail)
 *   dpNote         — optional note from DP
 *
 * FIELDS DELIBERATELY NOT CHANGED:
 *   orderStatus / status — stays "shipped". Admin changes this to "delivered".
 *
 * IDEMPOTENCY:
 *   Second call on same order returns 409. DP cannot re-confirm.
 */
const confirmDelivery = async (req, res) => {
  const { id } = req.params;
  const { source, note } = req.body; // source: 'order' | 'custom_order'

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }

  const VALID_SOURCES = ['order', 'custom_order'];
  if (!source || !VALID_SOURCES.includes(source)) {
    return res.status(400).json({ success: false, message: "source must be 'order' or 'custom_order'" });
  }

  const agentId = req.user._id;

  // Atomic: only a SHIPPED order, not yet confirmed, and either unassigned or assigned to
  // this partner. One conditional write also makes a double-tap / two partners safe.
  const Model = source === 'custom_order' ? CustomOrder : Order;
  const statusField = source === 'custom_order' ? 'status' : 'orderStatus';
  const updated = await Model.findOneAndUpdate(
    {
      _id: id,
      [statusField]: 'shipped',
      dpConfirmedAt: { $exists: false },
      $or: [{ deliveryAgent: null }, { deliveryAgent: { $exists: false } }, { deliveryAgent: agentId }],
    },
    { $set: { dpConfirmedAt: new Date(), dpConfirmedBy: agentId, dpNote: String(note || '').slice(0, 500) } },
    { new: true }
  ).select(source === 'custom_order' ? DP_HIDDEN_CUSTOM : DP_HIDDEN_ORDER);

  if (updated) {
    return res.json({ success: true, order: updated, message: 'Delivery confirmation sent to admin' });
  }

  // Explain why nothing matched
  const doc = await Model.findById(id).select(`${statusField} dpConfirmedAt deliveryAgent`).lean();
  if (!doc) {
    return res.status(404).json({ success: false, message: source === 'custom_order' ? 'Custom order not found' : 'Order not found' });
  }
  if (doc.dpConfirmedAt) return res.status(409).json({ success: false, message: 'Already confirmed' });
  if (doc[statusField] !== 'shipped') {
    return res.status(400).json({ success: false, message: `Only shipped orders can be confirmed as delivered (current: ${doc[statusField]}).` });
  }
  return res.status(403).json({ success: false, message: 'This order is assigned to another delivery partner.' });
};

module.exports = { getMyDeliveries, confirmDelivery };
