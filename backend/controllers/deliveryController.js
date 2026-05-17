const mongoose = require('mongoose');
const Order       = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normaliseOrder = (doc) => ({ ...doc, _source: 'order' });
const normaliseCustom = (doc) => ({ ...doc, _source: 'custom_order' });

// ─── GET /api/delivery/orders ─────────────────────────────────────────────────
// Returns all delivery-pipeline orders (assigned to agent OR unassigned active orders)
const DELIVERY_ORDER_STATUSES = [
  'confirmed', 'in_production', 'ready_to_ship', 'shipped', 'delivered',
];
const DELIVERY_CUSTOM_STATUSES = [
  'advance_paid', 'in_production', 'final_payment_pending',
  'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered',
];

const getMyDeliveries = async (req, res) => {
  const agentId = req.user._id;

  // Show orders assigned to this agent OR all active pipeline orders
  const [orders, customOrders] = await Promise.all([
    Order.find({
      $or: [
        { deliveryAgent: agentId },
        { deliveryAgent: null, orderStatus: { $in: DELIVERY_ORDER_STATUSES } },
      ],
    })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean(),
    CustomOrder.find({
      $or: [
        { deliveryAgent: agentId },
        { deliveryAgent: null, status: { $in: DELIVERY_CUSTOM_STATUSES } },
      ],
    })
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

// ─── PATCH /api/delivery/orders/:id/status ─────────────────────────────────────
// Delivery partner updates status: in_progress | shipped (no 'delivered' — that's done via confirm)
const updateDeliveryStatus = async (req, res) => {
  const { id } = req.params;
  const { status, source, note } = req.body; // source: 'order' | 'custom_order'

  const ALLOWED = ['in_progress', 'shipped'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be in_progress or shipped' });
  }

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }

  const agentId = req.user._id;

  if (source === 'custom_order') {
    const co = await CustomOrder.findById(id);
    if (!co) return res.status(404).json({ success: false, message: 'Custom order not found' });

    // Payment guard: cannot ship unpaid custom orders
    if (status === 'shipped') {
      const paidStatuses = ['final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'];
      if (!paidStatuses.includes(co.status)) {
        return res.status(403).json({ success: false, message: 'Cannot ship — final payment not completed' });
      }
    }

    const mappedStatus = status === 'shipped' ? 'shipped' : 'in_production';
    co.status = mappedStatus;
    co.trackingHistory.push({ status: mappedStatus, comment: note || '', updatedBy: agentId });
    await co.save();
    return res.json({ success: true, order: co });
  }

  // Regular order
  const STATUS_MAP = { in_progress: 'in_production', shipped: 'shipped' };
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  // Payment guard: cannot ship unpaid orders
  if (status === 'shipped' && order.payment?.status !== 'paid') {
    return res.status(403).json({ success: false, message: 'Cannot ship — order payment not completed' });
  }

  order.orderStatus = STATUS_MAP[status];
  order.trackingHistory.push({ status: STATUS_MAP[status], comment: note || '', updatedBy: agentId });
  if (status === 'shipped' && !order.dispatchedAt) order.dispatchedAt = new Date();
  await order.save();
  return res.json({ success: true, order });
};

// ─── POST /api/delivery/orders/:id/confirm ──────────────────────────────────
// Delivery partner confirms delivery (typed DELIVERED). Sets dpConfirmedAt only — NOT final status.
const confirmDelivery = async (req, res) => {
  const { id } = req.params;
  const { source, note } = req.body; // source: 'order' | 'custom_order'

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }

  const agentId = req.user._id;

  if (source === 'custom_order') {
    const co = await CustomOrder.findById(id);
    if (!co) return res.status(404).json({ success: false, message: 'Custom order not found' });
    if (co.dpConfirmedAt) return res.status(409).json({ success: false, message: 'Already confirmed' });

    co.dpConfirmedAt = new Date();
    co.dpConfirmedBy = agentId;
    co.dpNote        = note || '';
    await co.save();
    return res.json({ success: true, order: co, message: 'Delivery confirmation sent to admin' });
  }

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.dpConfirmedAt) return res.status(409).json({ success: false, message: 'Already confirmed' });

  order.dpConfirmedAt = new Date();
  order.dpConfirmedBy = agentId;
  order.dpNote        = note || '';
  await order.save();
  return res.json({ success: true, order, message: 'Delivery confirmation sent to admin' });
};

module.exports = { getMyDeliveries, updateDeliveryStatus, confirmDelivery };
