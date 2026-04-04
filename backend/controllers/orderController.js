const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const { verifyRazorpaySignature } = require('../utils/razorpayHelper');
const logger = require('../utils/logger');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute server-side pricing from validated items.
 * NEVER trust the client for prices.
 */
function computePricing(orderItems) {
  const itemsPrice = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingPrice = itemsPrice > 999 ? 0 : 99;
  const taxPrice = Math.round(itemsPrice * 0.03 * 100) / 100; // 3% GST
  const totalAmount = Math.round((itemsPrice + shippingPrice + taxPrice) * 100) / 100;
  return { itemsPrice, shippingPrice, taxPrice, totalAmount };
}

/**
 * Validate cart items against the DB and build orderItems array.
 * Returns { orderItems, errors } — errors array is non-empty on failure.
 */
async function validateAndBuildItems(items) {
  const orderItems = [];
  const errors = [];

  for (const item of items) {
    if (!item.productId || !mongoose.isValidObjectId(item.productId)) {
      errors.push(`Invalid product ID: ${item.productId}`);
      continue;
    }
    const qty = Number(item.quantity);
    if (!qty || qty < 1 || !Number.isInteger(qty)) {
      errors.push(`Invalid quantity for product ${item.productId}`);
      continue;
    }

    const product = await Product.findById(item.productId).lean();
    if (!product) {
      errors.push(`Product not found: ${item.productId}`);
      continue;
    }
    if (product.stock < qty) {
      errors.push(`Insufficient stock for "${product.name}" (available: ${product.stock})`);
      continue;
    }

    const price = product.discountedPrice ?? product.price;
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url || '',
      price,
      quantity: qty,
    });
  }

  return { orderItems, errors };
}

// ─── Phase 1: Create Payment ─────────────────────────────────────────────────
// @route   POST /api/orders/create-payment
// @access  Private
const createPayment = async (req, res) => {
  const { items, shippingAddress } = req.body;

  // --- Guard: empty cart ---
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  // --- Validate shipping address fields ---
  const requiredAddrFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
  for (const field of requiredAddrFields) {
    if (!shippingAddress?.[field]) {
      return res.status(400).json({ success: false, message: `Shipping address is missing: ${field}` });
    }
  }

  // --- Validate items against DB (server-side prices) ---
  const { orderItems, errors } = await validateAndBuildItems(items);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  // --- Compute server-side pricing ---
  const pricing = computePricing(orderItems);

  // --- Create pending Order in DB FIRST ---
  // This is the "intent record". It exists even if the user closes the tab.
  const pendingOrder = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    payment: {
      status: 'pending',
      method: 'razorpay',
    },
    itemsPrice: pricing.itemsPrice,
    shippingPrice: pricing.shippingPrice,
    taxPrice: pricing.taxPrice,
    totalAmount: pricing.totalAmount,
    orderStatus: 'processing',
  });

  // --- Create pending Transaction record (audit trail begins here) ---
  const transaction = await Transaction.create({
    order: pendingOrder._id,
    user: req.user._id,
    amount: pricing.totalAmount,
    currency: 'INR',
    status: 'pending',
  });

  // --- Guard: Razorpay not configured ---
  if (!isRazorpayConfigured) {
    // Clean up intent records before throwing
    await Order.deleteOne({ _id: pendingOrder._id });
    await Transaction.deleteOne({ _id: transaction._id });
    return res.status(503).json({
      success: false,
      message: 'Payment gateway is not configured. Please add Razorpay keys to .env',
    });
  }

  // --- Create Razorpay order (amount in paise) ---
  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: Math.round(pricing.totalAmount * 100),
      currency: 'INR',
      receipt: `receipt_${pendingOrder._id}`,
      notes: {
        userId: req.user._id.toString(),
        pendingOrderId: pendingOrder._id.toString(),
      },
    });
  } catch (err) {
    // Razorpay failed — clean up intent records
    await Order.deleteOne({ _id: pendingOrder._id });
    await Transaction.deleteOne({ _id: transaction._id });
    logger.error(`Razorpay order creation failed: ${err.message}`);
    return res.status(502).json({
      success: false,
      message: 'Payment gateway error. Please try again.',
    });
  }

  // --- Link Razorpay order ID to our pending records ---
  await Order.findByIdAndUpdate(pendingOrder._id, {
    'payment.razorpayOrderId': razorpayOrder.id,
  });
  await Transaction.findByIdAndUpdate(transaction._id, {
    razorpayOrderId: razorpayOrder.id,
  });

  logger.info(`Payment initiated: pendingOrder=${pendingOrder._id}, razorpayOrder=${razorpayOrder.id}`);

  res.json({
    success: true,
    razorpayOrderId: razorpayOrder.id,
    pendingOrderId: pendingOrder._id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    pricing,
  });
};

// ─── Phase 2: Verify Payment (Atomic Commit) ─────────────────────────────────
// @route   POST /api/orders/verify-payment
// @access  Private
const verifyPayment = async (req, res) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    pendingOrderId,
  } = req.body;

  // --- Input validation ---
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !pendingOrderId) {
    return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
  }
  if (!mongoose.isValidObjectId(pendingOrderId)) {
    return res.status(400).json({ success: false, message: 'Invalid pending order ID' });
  }

  // --- Verify HMAC signature (cryptographic check — must happen before DB writes) ---
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    // Log suspicious activity
    logger.warn(`Signature verification FAILED for razorpayOrder=${razorpayOrderId}, user=${req.user._id}`);
    // Mark transaction as failed
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'failed', failReason: 'Signature verification failed' }
    );
    return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
  }

  // --- Load the pending order ---
  const pendingOrder = await Order.findById(pendingOrderId);
  if (!pendingOrder) {
    return res.status(404).json({ success: false, message: 'Pending order not found' });
  }

  // --- Ownership check ---
  if (pendingOrder.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized for this order' });
  }

  // --- Idempotency check: already confirmed? ---
  if (pendingOrder.payment.status === 'paid') {
    logger.warn(`Duplicate verify-payment attempt for order=${pendingOrderId}`);
    return res.json({ success: true, message: 'Order already confirmed', order: pendingOrder });
  }

  // --- MongoDB Session: atomic commit BEGIN ──────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Decrement stock for each item (within session)
    for (const item of pendingOrder.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw new Error(`Product ${item.product} no longer exists`);
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}" (available: ${product.stock})`);
      }
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity, sold: item.quantity } },
        { session }
      );
    }

    // 2. Confirm the order (within session)
    const confirmedOrder = await Order.findByIdAndUpdate(
      pendingOrderId,
      {
        orderStatus: 'confirmed',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.razorpaySignature': razorpaySignature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
      },
      { new: true, session }
    );

    // 3. Update Transaction to success (within session)
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      {
        order: pendingOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
        gatewayResponse: { razorpayOrderId, razorpayPaymentId },
      },
      { session }
    );

    // 4. Commit — all writes become durable atomically
    await session.commitTransaction();
    session.endSession();

    logger.info(`Payment confirmed: order=${pendingOrderId}, razorpayPayment=${razorpayPaymentId}`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified. Order placed successfully!',
      order: confirmedOrder,
    });
  } catch (err) {
    // ─── ROLLBACK ───────────────────────────────────────────────────────────
    // All writes within the session (stock changes, order update, transaction) are discarded.
    await session.abortTransaction();
    session.endSession();

    logger.error(`Payment verification transaction rolled back: ${err.message}`, {
      pendingOrderId,
      razorpayOrderId,
      userId: req.user._id,
    });

    // Mark the order and transaction as failed so the user can retry
    await Order.findByIdAndUpdate(pendingOrderId, {
      'payment.status': 'failed',
      'payment.failReason': err.message,
    });
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'failed', failReason: err.message }
    );

    return res.status(500).json({
      success: false,
      message: `Payment confirmation failed: ${err.message}. If money was deducted, it will be auto-refunded within 5–7 business days.`,
    });
  }
};

// ─── Phase 3: Fail Payment (user dismissed / payment failed on client) ───────
// @route   POST /api/orders/fail-payment
// @access  Private
const failPayment = async (req, res) => {
  const { pendingOrderId, reason } = req.body;

  if (!pendingOrderId || !mongoose.isValidObjectId(pendingOrderId)) {
    return res.status(400).json({ success: false, message: 'Invalid pending order ID' });
  }

  const order = await Order.findById(pendingOrderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Ownership check
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  // Skip if already paid (race condition guard)
  if (order.payment.status === 'paid') {
    return res.json({ success: true, message: 'Order is already paid' });
  }

  const failReason = reason || 'Payment cancelled by user';

  await Order.findByIdAndUpdate(pendingOrderId, {
    orderStatus: 'cancelled',
    'payment.status': 'failed',
    'payment.failReason': failReason,
  });

  // Update transaction audit trail
  await Transaction.findOneAndUpdate(
    { order: pendingOrderId, status: 'pending' },
    { status: 'failed', failReason }
  );

  logger.info(`Payment failed/cancelled: order=${pendingOrderId}, reason="${failReason}"`);

  res.json({ success: true, message: 'Payment failure recorded' });
};

// ─── Get User's Orders ───────────────────────────────────────────────────────
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  // Only show orders that were paid or are in progress (exclude failed/cancelled with no payment)
  const orders = await Order.find({
    user: req.user._id,
    $or: [
      { 'payment.status': 'paid' },
      { 'payment.status': 'pending', orderStatus: { $ne: 'cancelled' } },
    ],
  })
    .select('-payment.razorpaySignature -trackingHistory') // don't expose signature
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, orders });
};

// ─── Get Single Order ────────────────────────────────────────────────────────
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const order = await Order.findById(req.params.id)
    .select('-payment.razorpaySignature')
    .populate('items.product', 'name images price');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Only allow owner or admin
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, order });
};

// ─── Get All Orders (Admin) ──────────────────────────────────────────────────
// @route   GET /api/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  const { page = 1, limit = 20, status, paymentStatus } = req.query;

  const query = {};
  if (status) query.orderStatus = status;
  if (paymentStatus) query['payment.status'] = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .select('-payment.razorpaySignature')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    orders,
    total,
    pages: Math.ceil(total / Number(limit)),
    page: Number(page),
  });
};

// ─── Update Order Status (Admin) ─────────────────────────────────────────────
// @route   PUT /api/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res) => {
  const { status, trackingNumber, trackingUrl, courierPartner, comment } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const validStatuses = ['processing', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Prevent regressing status (e.g. delivered → processing)
  const statusOrder = validStatuses;
  const currentIdx = statusOrder.indexOf(order.orderStatus);
  const newIdx = statusOrder.indexOf(status);
  if (newIdx < currentIdx && status !== 'cancelled') {
    return res.status(400).json({
      success: false,
      message: `Cannot revert status from "${order.orderStatus}" to "${status}"`,
    });
  }

  order.orderStatus = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (trackingUrl) order.trackingUrl = trackingUrl;
  if (courierPartner) order.courierPartner = courierPartner;
  if (status === 'delivered') order.deliveredAt = new Date();

  // Append tracking history
  order.trackingHistory.push({
    status,
    comment: comment || '',
    updatedBy: req.user._id,
  });

  await order.save();

  logger.info(`Order ${order._id} status updated to "${status}" by admin ${req.user._id}`);

  res.json({ success: true, order });
};

// ─── Admin Stats ─────────────────────────────────────────────────────────────
// @route   GET /api/orders/stats
// @access  Admin
const getStats = async (req, res) => {
  const [totalOrders, revenueAgg, statusCounts, recentOrders] = await Promise.all([
    Order.countDocuments({ 'payment.status': 'paid' }),

    Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),

    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),

    Order.find({ 'payment.status': 'paid' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .select('totalAmount orderStatus createdAt user items')
      .lean(),
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      recentOrders,
    },
  });
};

module.exports = {
  createPayment,
  verifyPayment,
  failPayment,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  getStats,
};
