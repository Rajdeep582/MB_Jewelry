const mongoose = require('mongoose');
const crypto   = require('node:crypto');
const CustomOrder = require('../models/CustomOrder');
const Transaction  = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const { verifyRazorpaySignature }        = require('../utils/razorpayHelper');
const { ORDER_STATUSES } = require('../utils/constants');

const logger = require('../utils/logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const requiredAddrFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];

function validateAddress(addr) {
  for (const f of requiredAddrFields) {
    if (!addr?.[f]) return `Shipping address is missing: ${f}`;
  }
  return null;
}

// ─── Create Custom Order (User submits inquiry) ───────────────────────────────
// @route   POST /api/custom-orders
// @access  Private
const createCustomOrder = async (req, res) => {
  const {
    type, material, purity, description,
    fingerSize, neckSize, wristSize, weight, budget,
    shippingAddress, preferredDeliveryDate,
  } = req.body;

  // Required field validation
  if (!type || !material || !description) {
    return res.status(400).json({ success: false, message: 'type, material, and description are required' });
  }

  const addrError = validateAddress(shippingAddress);
  if (addrError) {
    return res.status(400).json({ success: false, message: addrError });
  }

  // Build reference images from uploaded files (multer populates req.files)
  const referenceImages = (req.files || []).map((file) => {
    if (file.path?.startsWith('http')) {
      return { url: file.path, publicId: file.filename };
    }
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    return {
      url: `${backendUrl}/uploads/custom_orders/${file.filename}`,
      publicId: file.filename,
    };
  });

  const customOrder = await CustomOrder.create({
    user: req.user._id,
    type, material, purity: purity || 'None',
    description,
    fingerSize:  fingerSize  || '',
    neckSize:    neckSize    || '',
    wristSize:   wristSize   || '',
    weight:      weight      || '',
    budget:      budget      || '',
    referenceImages,
    shippingAddress,
    preferredDeliveryDate: preferredDeliveryDate || undefined,
    status: 'pending',
  });

  logger.info(`Custom order created: ${customOrder._id} by user ${req.user._id}`);

  res.status(201).json({ success: true, customOrder });
};

// ─── Get My Custom Orders (User) ─────────────────────────────────────────────
// @route   GET /api/custom-orders/my-orders
// @access  Private
const getMyCustomOrders = async (req, res) => {
  const orders = await CustomOrder.find({ user: req.user._id })
    .select('-advancePayment.razorpaySignature -finalPayment.razorpaySignature -adminNotes -trackingHistory')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, orders });
};

// ─── Get Single Custom Order ──────────────────────────────────────────────────
// @route   GET /api/custom-orders/:id
// @access  Private (owner or admin)
const getCustomOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const order = await CustomOrder.findById(req.params.id)
    .select('-advancePayment.razorpaySignature -finalPayment.razorpaySignature')
    .populate('user', 'name email');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Custom order not found' });
  }

  // Owner or admin only
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  // Hide internal admin notes from non-admins
  if (req.user.role !== 'admin') {
    order.adminNotes = undefined;
  }

  res.json({ success: true, order });
};

// ─── Cancel Custom Order (User) ───────────────────────────────────────────────
// @route   PUT /api/custom-orders/:id/cancel
// @access  Private (Owner only)
const cancelCustomOrderUser = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const order = await CustomOrder.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Custom order not found' });
  }

  // Only the owner can cancel it
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorised to cancel this order' });
  }

  // Can only cancel if payment hasn't started (pending or quoted)
  if (!['pending', 'quoted'].includes(order.status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Order cannot be cancelled at this stage. Please contact support.' 
    });
  }

  order.status = 'cancelled';
  order.trackingHistory.push({
    status: 'cancelled',
    comment: 'Order cancelled by customer',
    updatedBy: req.user._id,
  });

  await order.save();
  logger.info(`Custom order ${order._id} cancelled by user ${req.user._id}`);

  res.json({ success: true, message: 'Order cancelled successfully', order });
};

// ─── Phase 1: Create Payment Intent ───────────────────────────────────────────

// Helper to determine the payment amount and validate order state
function getCustomOrderPaymentAmounts(order, phase) {
  let amountToPay = 0;
  let errorMsg = null;

  if (phase === 'advance') {
    if (order.status !== 'quoted') {
      errorMsg = `Cannot pay advance. Order is in "${order.status}" status.`;
    } else {
      amountToPay = order.advanceAmount;
    }
  } else if (phase === 'final') {
    if (order.status !== 'shipped') {
      errorMsg = `Cannot pay final balance. Order is in "${order.status}" status.`;
    } else {
      amountToPay = order.finalAmount;
    }
  }
  return { amountToPay, errorMsg };
}

// @route   POST /api/custom-orders/create-payment
// @access  Private
const createCustomPayment = async (req, res) => {
  const { customOrderId, phase } = req.body;

  if (!customOrderId || !mongoose.isValidObjectId(customOrderId)) {
    return res.status(400).json({ success: false, message: 'Invalid custom order ID' });
  }
  if (!['advance', 'final'].includes(phase)) {
    return res.status(400).json({ success: false, message: 'Invalid payment phase' });
  }

  const order = await CustomOrder.findById(customOrderId);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  // Ownership check
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  // Pre-flight checks based on phase
  let { amountToPay, errorMsg } = getCustomOrderPaymentAmounts(order, phase);
  if (errorMsg) {
    return res.status(400).json({ success: false, message: errorMsg });
  }
  // ── Self-heal: legacy orders quoted before two-phase amounts were computed ──
  // If quoteAmount is set but the derived amounts are 0, recompute and persist them.
  if ((!amountToPay || amountToPay <= 0) && order.quoteAmount > 0) {
    const taxAmount     = Math.round(order.quoteAmount * 0.18);
    const totalAmount   = order.quoteAmount + taxAmount;
    const advanceAmount = Math.round(totalAmount * 0.7);
    const finalAmount   = totalAmount - advanceAmount;

    // Persist the recomputed amounts so future requests don't need to recompute
    await CustomOrder.findByIdAndUpdate(customOrderId, {
      taxAmount, totalAmount, advanceAmount, finalAmount,
    });

    // Update local reference
    order.taxAmount     = taxAmount;
    order.totalAmount   = totalAmount;
    order.advanceAmount = advanceAmount;
    order.finalAmount   = finalAmount;

    amountToPay = phase === 'advance' ? advanceAmount : finalAmount;
    logger.info(`Self-healed legacy amounts for custom order ${customOrderId}: advance=${advanceAmount}, final=${finalAmount}`);
  }

  if (!amountToPay || amountToPay <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount is not set or invalid. Please contact support.' });
  }

  // Razorpay's per-transaction limit is ₹5,00,00,000 (5 crore)
  const RAZORPAY_MAX_INR = 50000000;
  if (amountToPay > RAZORPAY_MAX_INR) {
    return res.status(400).json({
      success: false,
      message: `Payment amount (₹${amountToPay.toLocaleString('en-IN')}) exceeds the per-transaction limit of ₹5 crore. Please contact us to arrange an alternate payment method.`,
    });
  }

  if (!isRazorpayConfigured) {
    return res.status(503).json({ success: false, message: 'Payment gateway is not configured.' });
  }

  // Atomic: update order payment status + create transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  let transaction;
  try {
    const paymentStateField = phase === 'advance' ? 'advancePayment.status' : 'finalPayment.status';
    await CustomOrder.findByIdAndUpdate(
      customOrderId,
      { [paymentStateField]: 'pending', [`${phase}Payment.method`]: 'razorpay' },
      { session }
    );

    [transaction] = await Transaction.create(
      [{
        order:     customOrderId,
        orderType: 'CustomOrder',
        user:      req.user._id,
        amount:    amountToPay,
        currency:  'INR',
        status:    'pending',
        phase,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Custom order payment intent failed (${phase}): ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to initiate payment. Please try again.' });
  }

  // Create Razorpay order
  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(amountToPay * 100),
      currency: 'INR',
      receipt:  `custom_${phase}_${customOrderId}`,
      notes: {
        userId:        req.user._id.toString(),
        customOrderId: customOrderId.toString(),
        type:          'custom_order',
        phase,
      },
    });
  } catch (err) {
    // Razorpay failed — revert payment status
    await CustomOrder.findByIdAndUpdate(customOrderId, { [`${phase}Payment.status`]: 'pending' });
    await Transaction.deleteOne({ _id: transaction._id });
    logger.error(`Razorpay order creation failed for custom order ${customOrderId}: ${err.message}`);
    return res.status(502).json({ success: false, message: 'Payment gateway error. Please try again.' });
  }

  // Link Razorpay order IDs
  await CustomOrder.findByIdAndUpdate(customOrderId, { [`${phase}Payment.razorpayOrderId`]: razorpayOrder.id });
  await Transaction.findByIdAndUpdate(transaction._id, { razorpayOrderId: razorpayOrder.id });

  logger.info(`Custom order payment (${phase}) initiated: order=${customOrderId}, razorpayOrder=${razorpayOrder.id}`);

  res.json({
    success: true,
    razorpayOrderId: razorpayOrder.id,
    customOrderId,
    phase,
    amount:   razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId:    process.env.RAZORPAY_KEY_ID,
  });
};

// ─── Phase 2: Verify Payment ──────────────────────────────────────────────────
// @route   POST /api/custom-orders/verify-payment
// @access  Private
const verifyCustomPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, customOrderId, phase } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !customOrderId || !phase) {
    return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
  }
  if (!mongoose.isValidObjectId(customOrderId)) {
    return res.status(400).json({ success: false, message: 'Invalid custom order ID' });
  }

  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    await Transaction.findOneAndUpdate({ razorpayOrderId: String(razorpayOrderId) }, { status: 'failed', failReason: 'Signature mismatch' });
    return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
  }

  const order = await CustomOrder.findById(customOrderId);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  // Check idempotency
  if (phase === 'advance' && order.advancePayment.status === 'paid') return res.json({ success: true, message: 'Advance already paid', order });
  if (phase === 'final'   && order.finalPayment.status === 'paid')   return res.json({ success: true, message: 'Final already paid', order });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Advance payment sets status to advance_paid;
    // Final payment leaves order status as 'shipped'; admin manually confirms delivery.
    const nextStatus = phase === 'advance' ? 'advance_paid' : order.status;

    // Update payment fields on the custom order
    await CustomOrder.findByIdAndUpdate(
      customOrderId,
      {
        status: nextStatus,
        [`${phase}Payment.razorpayPaymentId`]: razorpayPaymentId,
        [`${phase}Payment.razorpaySignature`]: razorpaySignature,
        [`${phase}Payment.status`]:            'paid',
        [`${phase}Payment.paidAt`]:            new Date(),
      },
      { session }
    );

    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId) },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
        gatewayResponse: { razorpayOrderId, razorpayPaymentId },
        order: customOrderId,
        orderType: 'CustomOrder',
      },
      { session }
    );

    // Re-fetch within session to get the updated doc for tracking history
    const confirmedOrder = await CustomOrder.findById(customOrderId).session(session);
    confirmedOrder.trackingHistory.push({
      status: nextStatus,
      comment: phase === 'advance' ? 'Advance payment (70%) received.' : 'Final balance (30%) received.',
      updatedBy: req.user._id,
    });
    await confirmedOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`Custom order payment (${phase}) confirmed: order=${customOrderId}`);

    // Re-fetch clean document (without session) to return to client
    const freshOrder = await CustomOrder.findById(customOrderId)
      .select('-advancePayment.razorpaySignature -finalPayment.razorpaySignature');

    return res.json({
      success: true,
      message: `Payment verified. ${phase === 'advance' ? 'Advance paid successfully!' : 'Final balance paid!'}`,
      order: freshOrder,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Custom order payment rollback: ${err.message}`);

    await CustomOrder.findByIdAndUpdate(customOrderId, { [`${phase}Payment.status`]: 'failed', [`${phase}Payment.failReason`]: err.message });
    await Transaction.findOneAndUpdate({ razorpayOrderId }, { status: 'failed', failReason: err.message });

    return res.status(500).json({ success: false, message: `Payment confirmation failed: ${err.message}` });
  }
};

// ─── Phase 3: Fail Payment ────────────────────────────────────────────────────
// @route   POST /api/custom-orders/fail-payment
// @access  Private
const failCustomPayment = async (req, res) => {
  const { customOrderId, reason, phase } = req.body;

  if (!customOrderId || !mongoose.isValidObjectId(customOrderId) || !phase) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const order = await CustomOrder.findById(customOrderId);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });
  if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorised' });

  const failReason = reason || 'Payment cancelled by user';
  const revertStatus = phase === 'advance' ? 'quoted' : 'final_payment_pending';

  const failSession = await mongoose.startSession();
  failSession.startTransaction();
  try {
    await CustomOrder.findByIdAndUpdate(
      customOrderId,
      { status: revertStatus, [`${phase}Payment.status`]: 'failed', [`${phase}Payment.failReason`]: failReason },
      { session: failSession }
    );
    await Transaction.findOneAndUpdate(
      { order: String(customOrderId), status: 'pending' },
      { status: 'failed', failReason },
      { session: failSession }
    );
    await failSession.commitTransaction();
    failSession.endSession();
  } catch (err) {
    await failSession.abortTransaction();
    failSession.endSession();
    logger.error(`Failed to record custom order payment failure: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to record payment failure.' });
  }

  res.json({ success: true, message: 'Payment failure recorded' });
};

// ─── Get All Custom Orders (Admin) ────────────────────────────────────────────
// @route   GET /api/custom-orders
// @access  Admin
const getAllCustomOrders = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = {};
  if (status) query.status = String(status);

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    CustomOrder.find(query)
      .select('-advancePayment.razorpaySignature -finalPayment.razorpaySignature')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    CustomOrder.countDocuments(query),
  ]);

  res.json({
    success: true,
    orders,
    total,
    pages: Math.ceil(total / Number(limit)),
    page:  Number(page),
  });
};

// ─── Set Quote (Admin) ────────────────────────────────────────────────────────
// @route   PUT /api/custom-orders/:id/quote
// @access  Admin
const setQuote = async (req, res) => {
  const { quoteAmount, quoteNote, expectedDeliveryDate, adminNotes } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  if (!quoteAmount || quoteAmount <= 0) {
    return res.status(400).json({ success: false, message: 'quoteAmount must be a positive number' });
  }

  const order = await CustomOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  // Can only update quote if not delivered or cancelled
  if (['delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot update quote on order with status "${order.status}"`,
    });
  }

  order.quoteAmount   = Number(quoteAmount);
  order.taxAmount     = Math.round(order.quoteAmount * 0.18);
  order.totalAmount   = order.quoteAmount + order.taxAmount;

  if (order.advancePayment?.status === 'paid') {
    // If advance is already paid, keep the existing advanceAmount
    // and absorb any difference in the finalAmount.
    order.finalAmount = order.totalAmount - order.advanceAmount;
  } else {
    order.advanceAmount = Math.round(order.totalAmount * 0.7);
    order.finalAmount   = order.totalAmount - order.advanceAmount;
  }

  order.quoteNote   = quoteNote   || '';
  if (expectedDeliveryDate) order.expectedDeliveryDate = expectedDeliveryDate;
  if (adminNotes !== undefined) order.adminNotes = adminNotes;
  order.quotedAt    = new Date();
  
  if (order.status === 'pending') {
    order.status = 'quoted';
  }

  order.trackingHistory.push({
    status:    'quoted',
    comment:   quoteNote || `Quote set: ₹${order.quoteAmount} (+18% GST). Advance: ₹${order.advanceAmount}`,
    updatedBy: req.user._id,
  });

  await order.save();
  logger.info(`Custom order ${order._id} quoted at ₹${quoteAmount} by admin ${req.user._id}`);

  res.json({ success: true, order });
};

// Helper to validate and apply state transitions for Custom Orders
function applyCustomOrderTransition(order, status) {
  const current = order.status;
  const validStatuses = Object.values(ORDER_STATUSES);

  // ── Regression guard ──
  const currentIdx = validStatuses.indexOf(current);
  const newIdx     = validStatuses.indexOf(status);
  if (newIdx < currentIdx && status !== 'cancelled') {
    return { error: `Cannot revert status from "${current}" to "${status}"` };
  }

  // ── Guard: cannot cancel after advance payment is received ──
  if (status === 'cancelled' && order.advancePayment?.status === 'paid') {
    return { error: 'Cannot cancel order after advance payment has been received.' };
  }

  // ── Guard: cannot deliver unless final payment is done ──
  if (status === 'delivered' && order.finalPayment?.status !== 'paid') {
    return { error: 'Cannot mark as delivered. Final payment (30%) has not been received yet.' };
  }

  // ── Dispatch: auto-generate deliveryId + set internal tracking ref ──
  if (status === 'shipped') {
    if (order.deliveryId) {
      logger.info(`deliveryId reused for custom order ${order._id} (idempotent)`);
    } else {
      order.deliveryId    = crypto.randomUUID();
      logger.info(`deliveryId generated for custom order ${order._id}: ${order.deliveryId}`);
    }
    order.trackingNumber = order.deliveryId;
    order.dispatchedAt   = order.dispatchedAt || new Date();
  }

  return { error: null };
}

// ─── Update Custom Order Status (Admin) ──────────────────────────────────────
// @route   PUT /api/custom-orders/:id/status
// @access  Admin
const updateCustomOrderStatus = async (req, res) => {
  // Internal courier system: only status, estimatedDelivery, and comment accepted.
  const { status, comment, estimatedDelivery } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const validStatuses = Object.values(ORDER_STATUSES);

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const order = await CustomOrder.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  const current = order.status;

  // ── Idempotency ──
  if (current === status) {
    return res.json({ success: true, order, message: 'Order is already in this status' });
  }

  // Delegate validation and field updates to helper
  const transition = applyCustomOrderTransition(order, status);
  if (transition.error) {
    return res.status(400).json({ success: false, message: transition.error });
  }

  // ── Apply fields ──
  order.status = status;
  if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
  if (status === 'delivered') order.deliveredAt   = new Date();

  order.trackingHistory.push({
    status,
    comment:   comment || '',
    updatedBy: req.user._id,
  });

  await order.save();
  logger.info(
    `Custom order ${order._id} "${current}" → "${status}" by admin ${req.user._id}` +
    (order.deliveryId ? ` | deliveryId=${order.deliveryId}` : '')
  );

  res.json({ success: true, order });
};

// ─── Stats (Admin) ────────────────────────────────────────────────────────────
// @route   GET /api/custom-orders/stats
// @access  Admin
const getCustomOrderStats = async (req, res) => {
  const [total, pendingCount, statusCounts, revenueAgg, revenueAggFinal] = await Promise.all([
    CustomOrder.countDocuments(),
    CustomOrder.countDocuments({ status: 'pending' }),
    CustomOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    CustomOrder.aggregate([
      { $match: { 'advancePayment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$advanceAmount' } } },
    ]),
    CustomOrder.aggregate([
      { $match: { 'finalPayment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      total,
      pendingCount,
      totalRevenue: (revenueAgg[0]?.total || 0) + (revenueAggFinal[0]?.total || 0),
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    },
  });
};

module.exports = {
  createCustomOrder,
  getMyCustomOrders,
  getCustomOrder,
  cancelCustomOrderUser,
  createCustomPayment,
  verifyCustomPayment,
  failCustomPayment,
  getAllCustomOrders,
  setQuote,
  updateCustomOrderStatus,
  getCustomOrderStats,
};
