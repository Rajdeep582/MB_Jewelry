const mongoose = require('mongoose');
const crypto = require('node:crypto');
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

/**
 * Core atomic commit: decrement stock, confirm order, update transaction.
 * Shared by verifyPayment, handleWebhook, and retryVerifyPayment.
 */
async function atomicConfirmOrder(pendingOrder, razorpayPaymentId, razorpaySignature, razorpayOrderId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Decrement stock for each item
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

    // 2. Confirm the order
    const confirmedOrder = await Order.findByIdAndUpdate(
      pendingOrder._id,
      {
        orderStatus: 'confirmed',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.razorpaySignature': razorpaySignature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        $push: {
          trackingHistory: {
            status: 'confirmed',
            comment: 'Payment verified successfully online.',
            timestamp: new Date(),
          },
        },
      },
      { new: true, session }
    );

    // 3. Update Transaction to success
    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId) },
      {
        order: pendingOrder._id,
        orderType: 'Order',
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
        gatewayResponse: { razorpayOrderId, razorpayPaymentId },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    logger.info(`Order confirmed atomically: order=${pendingOrder._id}, payment=${razorpayPaymentId}`);
    return { success: true, order: confirmedOrder };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Mark order & transaction as failed so user can retry
    await Order.findByIdAndUpdate(pendingOrder._id, {
      'payment.status': 'failed',
      'payment.failReason': err.message,
    });
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'failed', failReason: err.message }
    );

    logger.error(`atomicConfirmOrder rollback: order=${pendingOrder._id}, ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Phase 1: Create Payment ─────────────────────────────────────────────────
// @route   POST /api/orders/create-payment
// @access  Private
const createPayment = async (req, res) => {
  const { items, shippingAddress, method = 'razorpay' } = req.body;

  // --- Guard: COD is no longer supported ---
  if (method === 'cod') {
    return res.status(400).json({ success: false, message: 'Cash on Delivery is no longer available. Please use online payment.' });
  }

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

  // --- Razorpay Flow ---
  // --- Guard early: Razorpay not configured ---
  if (!isRazorpayConfigured) {
    return res.status(503).json({
      success: false,
      message: 'Payment gateway is not configured. Please add Razorpay keys to .env',
    });
  }

  // --- Atomic intent record creation ---
  const session = await mongoose.startSession();
  session.startTransaction();

  let pendingOrder;
  let transaction;

  try {
    [pendingOrder] = await Order.create(
      [{
        user: req.user._id,
        items: orderItems,
        shippingAddress,
        payment: { status: 'pending', method: 'razorpay' },
        itemsPrice: pricing.itemsPrice,
        shippingPrice: pricing.shippingPrice,
        taxPrice: pricing.taxPrice,
        totalAmount: pricing.totalAmount,
        orderStatus: 'confirmed',
        // Seed initial tracking history so admin always has a full audit trail
        trackingHistory: [{
          status: 'confirmed',
          comment: 'Order created. Awaiting payment confirmation.',
          timestamp: new Date(),
        }],
      }],
      { session }
    );

    [transaction] = await Transaction.create(
      [{
        order: pendingOrder._id,
        orderType: 'Order',
        user: req.user._id,
        amount: pricing.totalAmount,
        currency: 'INR',
        status: 'pending',
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Failed to create payment intent records: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment. Please try again.',
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

  // --- Verify HMAC signature ---
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    logger.warn(`Signature verification FAILED for razorpayOrder=${razorpayOrderId}, user=${req.user._id}`);
    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId) },
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

  // --- Idempotency: already confirmed? ---
  if (pendingOrder.payment.status === 'paid') {
    logger.warn(`Duplicate verify-payment attempt for order=${pendingOrderId}`);
    return res.json({ success: true, message: 'Order already confirmed', order: pendingOrder });
  }

  const result = await atomicConfirmOrder(pendingOrder, razorpayPaymentId, razorpaySignature, razorpayOrderId);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: `Payment confirmation failed: ${result.error}. If money was deducted, it will be auto-refunded within 5–7 business days.`,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Payment verified. Order placed successfully!',
    order: result.order,
  });
};

// ─── Retry Verify Payment (Recovery path for failed network / browser crash) ──
// @route   POST /api/orders/:id/retry-verify
// @access  Private
const retryVerifyPayment = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Ownership check
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized for this order' });
  }

  // Idempotency
  if (order.payment.status === 'paid') {
    return res.json({ success: true, message: 'Order is already confirmed', order });
  }

  const razorpayOrderId = order.payment.razorpayOrderId;
  if (!razorpayOrderId) {
    return res.status(400).json({
      success: false,
      message: 'No Razorpay order ID found for this order. Payment may not have been initiated.',
    });
  }

  if (!isRazorpayConfigured) {
    return res.status(503).json({ success: false, message: 'Payment gateway not configured.' });
  }

  // Fetch the Razorpay order to check actual payment status
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
  } catch (err) {
    logger.error(`retry-verify: Razorpay fetch failed for order=${id}: ${err.message}`);
    return res.status(502).json({ success: false, message: 'Could not verify payment status. Please try again.' });
  }

  if (rzpOrder.status !== 'paid') {
    return res.status(402).json({
      success: false,
      message: 'Payment was not captured by Razorpay. You may try paying again from the Checkout page.',
    });
  }

  // Fetch the captured payment details from Razorpay
  let payments;
  try {
    payments = await razorpay.orders.fetchPayments(razorpayOrderId);
  } catch (err) {
    logger.error(`retry-verify: fetchPayments failed for razorpayOrder=${razorpayOrderId}: ${err.message}`);
    return res.status(502).json({ success: false, message: 'Could not retrieve payment details. Support team has been notified.' });
  }

  const capturedPayment = payments?.items?.find((p) => p.status === 'captured');
  if (!capturedPayment) {
    return res.status(402).json({ success: false, message: 'No captured payment found.' });
  }

  logger.info(`retry-verify: Payment confirmed via Razorpay API for order=${id}, payment=${capturedPayment.id}`);

  const result = await atomicConfirmOrder(order, capturedPayment.id, capturedPayment.id, razorpayOrderId);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: `Recovery failed: ${result.error}. Please contact support with your order ID.`,
    });
  }

  return res.json({
    success: true,
    message: 'Payment recovered successfully! Your order is now confirmed.',
    order: result.order,
  });
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

  const failSession = await mongoose.startSession();
  failSession.startTransaction();

  try {
    await Order.findByIdAndUpdate(
      pendingOrderId,
      { orderStatus: 'failed', 'payment.status': 'failed', 'payment.failReason': failReason },
      { session: failSession }
    );

    await Transaction.findOneAndUpdate(
      { order: String(pendingOrderId), status: 'pending' },
      { status: 'failed', failReason },
      { session: failSession }
    );

    await failSession.commitTransaction();
    failSession.endSession();
  } catch (err) {
    await failSession.abortTransaction();
    failSession.endSession();
    logger.error(`Failed to record payment failure for order=${pendingOrderId}: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to record payment failure. Please retry.' });
  }

  logger.info(`Payment failed/cancelled: order=${pendingOrderId}, reason="${failReason}"`);

  res.json({ success: true, message: 'Payment failure recorded' });
};

// ─── Webhook Helpers ──────────────────────────────────────────────────────────

async function processWebhookCaptured(payment) {
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const pendingOrder = await Order.findOne({ 'payment.razorpayOrderId': String(razorpayOrderId) });
  if (!pendingOrder) {
    logger.warn(`Webhook: No order found for razorpayOrder=${razorpayOrderId}`);
    return;
  }

  if (pendingOrder.payment.status === 'paid') {
    logger.info(`Webhook: Order ${pendingOrder._id} already confirmed — skipping`);
    return;
  }

  const result = await atomicConfirmOrder(pendingOrder, razorpayPaymentId, '', razorpayOrderId);
  if (result.success) {
    logger.info(`Webhook: Order ${pendingOrder._id} confirmed via payment.captured event`);
  } else {
    logger.error(`Webhook: atomicConfirmOrder failed: ${result.error}`);
  }
}

async function processWebhookFailed(payment) {
  const razorpayOrderId = payment.order_id;
  const failReason = payment.error_description || 'Payment failed (Razorpay event)';

  const pendingOrder = await Order.findOne({ 'payment.razorpayOrderId': String(razorpayOrderId) });
  if (!pendingOrder) return;

  if (pendingOrder.payment.status === 'paid') return;

  await Order.findByIdAndUpdate(pendingOrder._id, {
    orderStatus: 'cancelled',
    'payment.status': 'failed',
    'payment.failReason': failReason,
  });
  await Transaction.findOneAndUpdate(
    { razorpayOrderId: String(razorpayOrderId) },
    { status: 'failed', failReason }
  );

  logger.info(`Webhook: Order ${pendingOrder._id} marked failed via payment.failed event`);
}

// ─── Razorpay Webhook Handler ─────────────────────────────────────────────────
// @route   POST /api/webhook/razorpay
// @access  Public (signature-verified)
const handleWebhook = async (req, res) => {
  // 1. Always acknowledge immediately — Razorpay will retry on non-200
  res.status(200).json({ received: true });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    // 2. Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // raw buffer from express.raw()
      .digest('hex');

    if (expectedSig !== signature) {
      logger.warn('Webhook signature mismatch. Rejecting event.');
      return;
    }
  } else {
    logger.warn('RAZORPAY_WEBHOOK_SECRET is not set — skipping webhook signature verification');
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    logger.error('Failed to parse webhook body');
    return;
  }

  const eventType = event.event;
  logger.info(`Razorpay webhook received: ${eventType}`);

  if (eventType === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (payment) await processWebhookCaptured(payment);
    return;
  }

  if (eventType === 'payment.failed') {
    const payment = event.payload?.payment?.entity;
    if (payment) await processWebhookFailed(payment);
  }
};

// ─── Get User's Orders ───────────────────────────────────────────────────────
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    $or: [
      { 'payment.status': 'paid' },
      { 'payment.status': 'pending' },
      { 'payment.status': 'failed', 'payment.razorpayOrderId': { $exists: true, $ne: '' } },
    ],
  })
    .select('-payment.razorpaySignature -payment.razorpaySignature')
    .populate('items.product', 'name images price')
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
    .populate('items.product', 'name images price')
    .populate('trackingHistory.updatedBy', 'name role')  // include admin name in timeline
    .populate('user', 'name email phone');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, order });
};

// ─── Get All Orders (Admin) ──────────────────────────────────────────────────
// @route   GET /api/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  const { page = 1, limit = 20, status, paymentStatus = 'all' } = req.query;

  const query = {};

  if (status === 'needs_attention') {
    // Only flag orders that genuinely need admin intervention:
    // Payment failed but order is still actionable (not already resolved as 'failed', 'returned_refunded', or legacy 'cancelled')
    query.$or = [
      { 'payment.status': 'failed', orderStatus: { $nin: ['failed', 'returned_refunded', 'cancelled'] } },
    ];
  } else {
    if (status) query.orderStatus = String(status);

    if (paymentStatus === 'paid') {
      query['payment.status'] = 'paid';
    } else if (paymentStatus === 'pending') {
      query['payment.status'] = 'pending';
    } else if (paymentStatus === 'failed') {
      query['payment.status'] = 'failed';
    }
  }

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

// ─── Delivery Lifecycle State Machine ────────────────────────────────────────
//
// Valid forward transitions only:
//   processing → confirmed
//   confirmed  → ready_to_ship | cancelled
//   ready_to_ship → shipped | cancelled
//   shipped    → delivered
//   delivered  → (terminal — no further transitions)
//   cancelled  → (terminal)
//
const DELIVERY_TRANSITIONS = {
  confirmed:         ['ready_to_ship', 'failed'],
  ready_to_ship:     ['shipped', 'failed'],
  shipped:           ['delivered', 'failed', 'returned_refunded'],
  delivered:         ['returned_refunded'],
  returned_refunded: [],
  failed:            ['returned_refunded'],
};

// ─── Transition Helper ────────────────────────────────────────────────────────
function applyOrderTransition(order, status, paymentStatus, estimatedDelivery) {
  // ── Dispatch: auto-generate deliveryId + set internal tracking ref ───────────
  if (status === 'shipped' || status === 'delivered') {
    if (!order.deliveryId) {
      order.deliveryId = crypto.randomUUID();
      logger.info(`deliveryId generated for order ${order._id}: ${order.deliveryId}`);
    }
    order.trackingNumber = order.deliveryId || order.trackingNumber;
    order.dispatchedAt   = order.dispatchedAt || new Date();
  }

  // ── Apply status + optional fields ──────────────────────────────────────────
  order.orderStatus = status;
  if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);

  // ── Handle Payment State Updates ───────────────────────────────────────────
  if (paymentStatus && ['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
    order.payment.status = paymentStatus;
    if (paymentStatus === 'paid' && !order.payment.paidAt) {
      order.payment.paidAt = new Date();
    }
  }

  if (status === 'delivered') order.deliveredAt = new Date();
}

// ─── Update Order Status (Admin) ─────────────────────────────────────────────
// @route   PUT /api/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res) => {
  const { status, comment, estimatedDelivery, paymentStatus } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  const validStatuses = Object.keys(DELIVERY_TRANSITIONS);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  const current = order.orderStatus;
  const currentPaymentStatus = order.payment.status;

  // ── Idempotency: already in the target state ──
  if (current === status && (!paymentStatus || paymentStatus === currentPaymentStatus) && !comment) {
    logger.info(`Order ${order._id} already in status "${status}" — idempotent response`);
    return res.json({ success: true, order, message: 'Order is already up to date' });
  }

  // ── State machine: validate transition ────────────────────────────────────
  const allowed = DELIVERY_TRANSITIONS[current] || [];
  if (current !== status && !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid transition: "${current}" → "${status}". Allowed next states: [${allowed.join(', ') || 'none'}]` });
  }

  // ── Pre-Delivery Validation ────────────────────────────────────────────────
  if (status === 'delivered' && order.payment.status !== 'paid' && paymentStatus !== 'paid') {
    return res.status(400).json({ success: false, message: 'Payment needs to be done before marking as delivered.' });
  }

  applyOrderTransition(order, status, paymentStatus, estimatedDelivery);

  order.trackingHistory.push({
    status,
    comment: comment || '',
    updatedBy: req.user._id,
    timestamp: new Date(),
  });

  await order.save();

  logger.info(`Order ${order._id} transitioned "${current}" → "${status}" by admin ${req.user._id}` + (order.deliveryId ? ` | deliveryId=${order.deliveryId}` : ''));

  res.json({ success: true, order });
};

// ─── Admin Stats ─────────────────────────────────────────────────────────────
// @route   GET /api/orders/stats
// @access  Admin
const getStats = async (req, res) => {
  const validOrderQuery = { orderStatus: { $nin: ['failed', 'returned_refunded'] } };

  const [totalOrders, revenueAgg, statusCounts, recentOrders, pendingCount] = await Promise.all([
    Order.countDocuments(validOrderQuery),

    Order.aggregate([
      { $match: validOrderQuery },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),

    Order.aggregate([
      { $match: validOrderQuery },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),

    Order.find(validOrderQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .select('totalAmount orderStatus createdAt user items')
      .lean(),

    // Pending count for "needs attention" badge
    Order.countDocuments({
      'payment.status': 'failed',
      orderStatus: { $nin: ['failed', 'returned_refunded', 'cancelled'] },
    }),
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      recentOrders,
      needsAttention: pendingCount,
    },
  });
};

// ─── Delivery Stats (Admin) — unified Order + CustomOrder ─────────────────────
// @route   GET /api/orders/delivery-stats
// @access  Admin
// Single query set covering both regular orders and custom orders.
const getDeliveryStats = async (req, res) => {
  const CustomOrder = require('../models/CustomOrder');
  const now = new Date();

  // Custom order delivery statuses mapped to the same pipeline stages:
  // final_payment_paid → "confirmed" (in production, fully paid, pending dispatch)
  // ready_to_ship → ready_to_ship
  // shipped → shipped
  // delivered → delivered
  const CUSTOM_DELIVERY_STATUSES = ['final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'];

  const [
    orderCounts, orderOverdue,
    customCounts, customOverdue,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: { $in: ['confirmed', 'ready_to_ship', 'shipped', 'delivered'] } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ orderStatus: 'shipped', estimatedDelivery: { $lt: now } }),
    CustomOrder.aggregate([
      { $match: { status: { $in: CUSTOM_DELIVERY_STATUSES } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CustomOrder.countDocuments({ status: 'shipped', estimatedDelivery: { $lt: now } }),
  ]);

  const oc = orderCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
  const cc = customCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});

  // Merge: CustomOrder.final_payment_paid maps to "confirmed" bucket
  const confirmed     = (oc.confirmed     || 0) + (cc.final_payment_paid || 0);
  const ready_to_ship = (oc.ready_to_ship || 0) + (cc.ready_to_ship     || 0);
  const shipped       = (oc.shipped       || 0) + (cc.shipped            || 0);
  const delivered     = (oc.delivered     || 0) + (cc.delivered          || 0);
  const overdue       = orderOverdue + customOverdue;

  res.json({
    success: true,
    stats: {
      confirmed,
      ready_to_ship,
      shipped,
      delivered,
      overdue,
      pipeline: confirmed + ready_to_ship + shipped,
    },
  });
};

module.exports = {
  createPayment,
  verifyPayment,
  retryVerifyPayment,
  failPayment,
  handleWebhook,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  getStats,
  getDeliveryStats,
};
