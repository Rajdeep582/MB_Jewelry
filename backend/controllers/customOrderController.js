const mongoose = require('mongoose');
const crypto   = require('node:crypto');
const CustomOrder = require('../models/CustomOrder');
const Transaction  = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const { verifyRazorpaySignature }        = require('../utils/razorpayHelper');
const { ORDER_STATUSES } = require('../utils/constants');

const logger = require('../utils/logger');
const GlobalPricing = require('../models/GlobalPricing');
const { upsertDeliverySnapshot } = require('../utils/deliverySnapshot');
const { buildOrderSearch } = require('../utils/orderSearch');

// Fields a customer must never receive (internal notes + payment signatures)
const CUSTOMER_HIDDEN = '-advancePayment.razorpaySignature -finalPayment.razorpaySignature -adminNotes';
const RAZORPAY_MAX_INR = 50000000; // ₹5 crore per-transaction limit
const PAYMENT_PHASES = ['advance', 'final'];

// Custom-order purity labels differ from GlobalPricing labels
const PURITY_ALIASES = { Hallmark: 'Hallmarked' };

/**
 * getCustomGstRate — GST fraction for a custom order: exact material+purity rate,
 * else any rate set for the material, else 18% (legacy fallback).
 */
async function getCustomGstRate(material, purity) {
  const p = PURITY_ALIASES[purity] || purity;
  const entry = await GlobalPricing.findOne({ material, purity: p }).lean()
    || await GlobalPricing.findOne({ material }).lean();
  return entry ? entry.gst / 100 : 0.18;
}

/** Fresh copy of a custom order that is safe to send to its customer. */
const customerView = (id) => CustomOrder.findById(id).select(CUSTOMER_HIDDEN);

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
  const ownerId = order.user?._id ?? order.user;
  if (ownerId?.toString() !== req.user._id.toString() && req.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  // Hide internal admin notes from non-admins
  if (req.userType !== 'admin') {
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

  res.json({ success: true, message: 'Order cancelled successfully', order: await customerView(order._id) });
};

// ─── Phase 1: Create Payment Intent ───────────────────────────────────────────

// Helper to determine the payment amount and validate order state
function getCustomOrderPaymentAmounts(order, phase) {
  let amountToPay = 0;
  let errorMsg = null;

  if (order[`${phase}Payment`]?.status === 'paid') {
    return { amountToPay: 0, errorMsg: `The ${phase === 'advance' ? 'advance' : 'final'} payment has already been received.` };
  }

  if (phase === 'advance') {
    if (order.status === 'quoted') {
      amountToPay = order.advanceAmount;
    } else {
      errorMsg = `Cannot pay advance. Order is in "${order.status}" status.`;
    }
  } else if (phase === 'final') {
    if (order.status === 'shipped') {
      amountToPay = order.finalAmount;
    } else {
      errorMsg = `Cannot pay final balance. Order is in "${order.status}" status.`;
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
    const _shGstRate  = await getCustomGstRate(order.material, order.purity);
    const taxAmount     = Math.round(order.quoteAmount * _shGstRate);
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
/**
 * confirmCustomPayment — record a captured advance/final payment on a custom order.
 * Shared by verifyCustomPayment (browser callback) and the Razorpay webhook, so a payment is
 * reconciled even if the customer closes the tab.
 *
 * IDEMPOTENT + RACE-SAFE: the write is conditional on "<phase>Payment.status != paid" AND the
 * stored Razorpay order id, inside a transaction. Parallel calls (double click, webhook + verify)
 * → one wins, the others see "already paid" and report success. A failure never flips a
 * captured payment to 'failed'.
 * Returns { ok, alreadyPaid?, error? }.
 */
async function confirmCustomPayment({ customOrderId, phase, razorpayOrderId, razorpayPaymentId, razorpaySignature, actorId, via, anyRazorpayOrder = false }) {
  const statusPath = `${phase}Payment.status`;
  const isPaid = async () => {
    const o = await CustomOrder.findById(customOrderId).select(statusPath).lean();
    return o?.[`${phase}Payment`]?.status === 'paid';
  };

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // anyRazorpayOrder: webhook path where our own Transaction record proves this Razorpay
    // order belongs to this custom order/phase (customer may have opened checkout twice).
    const current = await CustomOrder.findOne({
      _id: customOrderId,
      [statusPath]: { $ne: 'paid' },
      ...(anyRazorpayOrder ? {} : { [`${phase}Payment.razorpayOrderId`]: String(razorpayOrderId) }),
    }).session(session);

    if (!current) {
      await session.abortTransaction();
      session.endSession();
      if (await isPaid()) return { ok: true, alreadyPaid: true };
      return { ok: false, error: 'Payment does not match this order' };
    }

    // Advance moves the order into production; a customer who cancelled and then paid
    // is reinstated (money was captured). Final payment leaves the status ('shipped').
    let nextStatus = current.status;
    let comment = phase === 'advance' ? 'Advance payment (70%) received.' : 'Final balance (30%) received.';
    if (phase === 'advance' && ['pending', 'quoted', 'cancelled'].includes(current.status)) {
      if (current.status === 'cancelled') comment += ' Order reinstated — payment arrived after cancellation.';
      nextStatus = 'advance_paid';
    }

    const updated = await CustomOrder.findOneAndUpdate(
      { _id: customOrderId, status: current.status, [statusPath]: { $ne: 'paid' } },
      {
        $set: {
          status: nextStatus,
          [`${phase}Payment.razorpayOrderId`]:   String(razorpayOrderId),
          [`${phase}Payment.razorpayPaymentId`]: razorpayPaymentId,
          [`${phase}Payment.razorpaySignature`]: razorpaySignature,
          [statusPath]:                          'paid',
          [`${phase}Payment.paidAt`]:            new Date(),
          [`${phase}Payment.failReason`]:        '',
        },
        $push: { trackingHistory: { status: nextStatus, comment, updatedBy: actorId, timestamp: new Date() } },
      },
      { new: true, session }
    );
    if (!updated) throw new Error('Custom order changed during payment confirmation');

    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId), status: { $ne: 'success' } },
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

    await session.commitTransaction();
    session.endSession();
    logger.info(`Custom order payment (${phase}) confirmed via ${via}: order=${customOrderId}`);
    return { ok: true };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    if (await isPaid()) return { ok: true, alreadyPaid: true }; // a parallel call won
    // Signature/capture is genuine — keep the payment retryable, just note why it failed
    await CustomOrder.updateOne(
      { _id: customOrderId, [statusPath]: { $ne: 'paid' } },
      { [`${phase}Payment.failReason`]: `Confirmation error: ${err.message}` }
    );
    logger.error(`Custom order payment confirm failed (${phase}) order=${customOrderId}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * verifyCustomPayment
 * @route  POST /api/custom-orders/verify-payment
 * @access Private (authenticated user)
 *
 * Confirms a Razorpay payment for a custom order (advance or final phase).
 *
 * CHECK ORDER — fail-fast, cheapest first, signature last:
 *   1. Input presence + ObjectId format (no DB)
 *   2. Load order → 404 if not found
 *   3. Ownership → 403 if not requester's order
 *   4. Cross-validate razorpayOrderId against stored value → 400 on mismatch
 *      Prevents payment-swap attack: user reusing another payment's ID on this order.
 *   5. Idempotency → 200 if already paid (no double-write)
 *   6. Razorpay HMAC signature verification → 400 on mismatch
 *
 * WHY SIGNATURE IS LAST (not first):
 *   Checking signature before ownership leaks order existence via timing:
 *   a valid signature from the user's own payment passes crypto, then hits the DB —
 *   the response time difference between 404 and 403 reveals whether the target
 *   customOrderId exists. Loading the order first and checking ownership collapses
 *   both into a consistent code path before signature crypto runs.
 *
 * TRANSACTION + RACE SAFETY: delegated to confirmCustomPayment (shared with the webhook).
 *
 * SIGNATURE HELPER:
 *   verifyRazorpaySignature (utils/razorpayHelper.js) uses crypto.timingSafeEqual
 *   internally — not vulnerable to timing side-channel on the signature bytes.
 */
const verifyCustomPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, customOrderId, phase } = req.body;

  // 1. Input presence + format
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !customOrderId || !phase) {
    return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
  }
  if (!mongoose.isValidObjectId(customOrderId)) {
    return res.status(400).json({ success: false, message: 'Invalid custom order ID' });
  }
  if (!PAYMENT_PHASES.includes(phase)) {
    return res.status(400).json({ success: false, message: 'Invalid payment phase' });
  }

  // 2. Load order
  const order = await CustomOrder.findById(customOrderId).select('user advancePayment finalPayment').lean();
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  // 3. Ownership — must be the requesting user's order
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  // 4. Cross-validate razorpayOrderId against stored value (prevents payment-swap attack)
  const storedRzpId = order[`${phase}Payment`]?.razorpayOrderId;
  if (storedRzpId !== razorpayOrderId) {
    logger.warn(`razorpayOrderId mismatch for custom order=${customOrderId} phase=${phase}: submitted=${razorpayOrderId}, stored=${storedRzpId}`);
    return res.status(400).json({ success: false, message: 'Payment ID mismatch for this order.' });
  }

  // 5. Idempotency — return success if already confirmed, no double-write
  if (order[`${phase}Payment`]?.status === 'paid') {
    return res.json({
      success: true,
      message: phase === 'advance' ? 'Advance already paid' : 'Final already paid',
      order: await customerView(customOrderId),
    });
  }

  // 6. Razorpay HMAC signature verification (crypto — most expensive check, runs last)
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId), status: { $ne: 'success' } },
      { status: 'failed', failReason: 'Signature mismatch' }
    );
    return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
  }

  const result = await confirmCustomPayment({
    customOrderId, phase, razorpayOrderId, razorpayPaymentId, razorpaySignature,
    actorId: req.user._id, via: 'verify',
  });

  if (!result.ok) {
    return res.status(500).json({
      success: false,
      message: 'Payment received but confirmation is delayed. Please refresh in a minute or contact support — you will not be charged again.',
    });
  }

  return res.json({
    success: true,
    message: `Payment verified. ${phase === 'advance' ? 'Advance paid successfully!' : 'Final balance paid!'}`,
    order: await customerView(customOrderId),
  });
};

// ─── Phase 3: Fail Payment ────────────────────────────────────────────────────
// @route   POST /api/custom-orders/fail-payment
// @access  Private
const failCustomPayment = async (req, res) => {
  const { customOrderId, reason, phase } = req.body;

  if (!customOrderId || !mongoose.isValidObjectId(customOrderId) || !PAYMENT_PHASES.includes(phase)) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const order = await CustomOrder.findById(customOrderId);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });
  if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorised' });

  // Already paid (e.g. webhook/verify won the race) → nothing to record
  if (order[`${phase}Payment`]?.status === 'paid') {
    return res.json({ success: true, message: 'Payment already received' });
  }

  const failReason = String(reason || 'Payment cancelled by user').slice(0, 300);
  const statusPath = `${phase}Payment.status`;

  const failSession = await mongoose.startSession();
  failSession.startTransaction();
  try {
    // Order status is NOT changed (advance → stays 'quoted', final → stays 'shipped');
    // only the payment flag is reset, and never if it became 'paid' meanwhile.
    await CustomOrder.updateOne(
      { _id: customOrderId, [statusPath]: { $ne: 'paid' } },
      { [statusPath]: 'failed', [`${phase}Payment.failReason`]: failReason },
      { session: failSession }
    );
    await Transaction.findOneAndUpdate(
      {
        order: new mongoose.Types.ObjectId(customOrderId),
        phase,
        status: 'pending',
        ...(order[`${phase}Payment`]?.razorpayOrderId ? { razorpayOrderId: order[`${phase}Payment`].razorpayOrderId } : {}),
      },
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
  const { status, search } = req.query;
  const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (status) {
    // 'confirmed' (alias 'in_production') covers both advance_paid and confirmed —
    // both display as "Confirmed & In Production" in the UI
    if (['confirmed', 'in_production'].includes(String(status))) {
      filter.status = { $in: ['advance_paid', 'confirmed'] };
    } else {
      filter.status = String(status);
    }
  }

  // Support lookup across all pages: CUS-… id, tracking number, customer, phone, PIN, item type
  const searchOr = await buildOrderSearch(search, {
    idField: 'customOrderId',
    paymentPaths: [
      'advancePayment.razorpayPaymentId', 'advancePayment.razorpayOrderId',
      'finalPayment.razorpayPaymentId', 'finalPayment.razorpayOrderId',
    ],
    extra: (rx) => [{ type: rx }, { description: rx }],
  });
  const query = searchOr ? { $and: [filter, { $or: searchOr }] } : filter;

  const [orders, total] = await Promise.all([
    CustomOrder.find(query)
      .select('-advancePayment.razorpaySignature -finalPayment.razorpaySignature')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    CustomOrder.countDocuments(query),
  ]);

  res.json({
    success: true,
    orders,
    total,
    pages: Math.ceil(total / limitNum),
    page:  pageNum,
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
  const numQuote = Number(quoteAmount);
  if (!Number.isFinite(numQuote) || numQuote < 10) {
    return res.status(400).json({ success: false, message: 'quoteAmount must be a number of at least ₹10' });
  }

  const order = await CustomOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Custom order not found' });

  // Cannot re-quote once a quote has been set (quotedAt is set on first quote)
  if (order.quotedAt) {
    return res.status(409).json({
      success: false,
      message: 'Quote is already set and locked. No changes allowed after the initial quote.',
    });
  }

  // Can only set quote if not delivered or cancelled
  if (['delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot set quote on order with status "${order.status}"`,
    });
  }

  order.quoteAmount   = numQuote;
  // GST from GlobalPricing for this material/purity (purity labels mapped), fallback 18%
  const _gstRate = await getCustomGstRate(order.material, order.purity);
  order.taxAmount     = Math.round(order.quoteAmount * _gstRate);
  order.totalAmount   = order.quoteAmount + order.taxAmount;

  if (order.advancePayment?.status === 'paid') {
    // If advance is already paid, keep the existing advanceAmount
    // and absorb any difference in the finalAmount.
    const computedFinal = order.totalAmount - order.advanceAmount;
    if (computedFinal < 0) {
      return res.status(400).json({
        success: false,
        message: `Re-quote invalid: new total (₹${order.totalAmount}) is less than advance already paid (₹${order.advanceAmount})`,
      });
    }
    order.finalAmount = computedFinal;
  } else {
    order.advanceAmount = Math.round(order.totalAmount * 0.7);
    order.finalAmount   = order.totalAmount - order.advanceAmount;
  }

  // Both instalments must be payable online (Razorpay: ≥ ₹1 and ≤ ₹5 crore each)
  if (order.finalAmount < 1 || order.advanceAmount > RAZORPAY_MAX_INR || order.finalAmount > RAZORPAY_MAX_INR) {
    return res.status(400).json({
      success: false,
      message: 'Quote out of range: each instalment must be between ₹1 and ₹5 crore for online payment.',
    });
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
    comment:   quoteNote || `Quote set: ₹${order.quoteAmount} (+${Math.round(_gstRate * 100)}% GST). Advance: ₹${order.advanceAmount}`,
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

  const currentIdx = validStatuses.indexOf(current);
  const newIdx     = validStatuses.indexOf(status);

  // ── Terminal guard: no update after delivered ──
  if (current === 'delivered') {
    return { error: 'Order has been delivered and cannot be updated further.' };
  }

  // ── Same-status guard ──
  if (newIdx === currentIdx) {
    return { error: `Order is already in "${status}" status. Cannot update to the same status.` };
  }

  // ── Regression guard ──
  if (newIdx < currentIdx && status !== 'cancelled') {
    return { error: `Cannot revert status from "${current}" to "${status}"` };
  }

  // ── Guard: cannot cancel after advance payment is received ──
  if (status === 'cancelled' && order.advancePayment?.status === 'paid') {
    return { error: 'Cannot cancel order after advance payment has been received.' };
  }

  // ── Guard: payment-driven states are set by payments / the quote form, not by hand ──
  if (status === 'quoted') {
    return { error: 'Use "Set Quote" to quote an order.' };
  }
  if (status === 'advance_paid') {
    return { error: 'Advance-paid status is set automatically when the customer pays.' };
  }

  // ── Guard: production / dispatch only after the advance is received ──
  if (['confirmed', 'ready_to_ship', 'shipped'].includes(status) && order.advancePayment?.status !== 'paid') {
    return { error: `Cannot mark as ${status.replaceAll('_', ' ')}. Advance payment (70%) has not been received yet.` };
  }

  // ── Guard: delivered only from shipped, after the DP confirmed AND the balance is paid ──
  if (status === 'delivered') {
    if (current !== 'shipped') {
      return { error: 'Order must be shipped before it can be marked as delivered.' };
    }
    if (!order.dpConfirmedAt) {
      return { error: 'Delivery partner must confirm delivery first before admin can mark as delivered.' };
    }
    if (order.finalPayment?.status !== 'paid') {
      return { error: 'Cannot mark as delivered. Final payment (30%) has not been received yet.' };
    }
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

  // ── Same-status guard ─────────────────────────────────────────────────────
  if (current === status) {
    // Exception: allow estimatedDelivery-only update when shipped
    if (status === 'shipped' && estimatedDelivery) {
      order.estimatedDelivery = new Date(estimatedDelivery);
      await order.save();
      await writeCustomOrderSnapshot(order); // keep the Delivery record's ETA in sync
      return res.json({ success: true, order, message: 'Estimated delivery date updated' });
    }
    return res.status(400).json({ success: false, message: `Order is already in "${status}" status. Cannot update to the same status.` });
  }

  // Delegate validation and field updates to helper
  const transition = applyCustomOrderTransition(order, status);
  if (transition.error) {
    return res.status(400).json({ success: false, message: transition.error });
  }

  await commitCustomOrderStatus(order, status, { comment, estimatedDelivery, adminId: req.user._id });

  res.json({ success: true, order });
};

/**
 * commitCustomOrderStatus — the ONE place a custom order's status is written after validation
 * (shared with adminController.adminConfirmDelivery). Claims the transition atomically so two
 * admins / double-clicks cannot both apply it, then writes history + Delivery snapshot.
 */
async function commitCustomOrderStatus(order, status, { comment = '', estimatedDelivery, adminId } = {}) {
  const current = order.status;
  const claimed = await CustomOrder.updateOne({ _id: order._id, status: current }, { $set: { status } });
  if (claimed.modifiedCount === 0) {
    const err = new Error('This order was just updated by someone else. Refresh and try again.');
    err.statusCode = 409;
    throw err;
  }

  // ── Apply fields ──
  order.status = status;
  if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
  if (status === 'delivered') {
    order.deliveredAt = new Date();
    order.estimatedDelivery = undefined; // clear — actual date now known
    // The partner who physically confirmed delivery takes precedence over the assigned one
    const agentRef = order.dpConfirmedBy || order.deliveryAgent;
    if (agentRef && !order.deliveredByPartnerId) {
      const DeliveryPartner = require('../models/DeliveryPartner');
      const dp = await DeliveryPartner.findById(agentRef).select('partnerId name').lean();
      if (dp?.partnerId) order.deliveredByPartnerId   = dp.partnerId;
      if (dp?.name)      order.deliveredByPartnerName = dp.name;
    }
  }

  order.trackingHistory.push({
    status,
    comment:   comment || '',
    updatedBy: adminId,
  });

  await order.save();
  logger.info(
    `Custom order ${order._id} "${current}" → "${status}" by admin ${adminId}` +
    (order.deliveryId ? ` | deliveryId=${order.deliveryId}` : '')
  );

  if (status === 'shipped' || status === 'delivered') await writeCustomOrderSnapshot(order);
  return order;
}

/** writeCustomOrderSnapshot — persist the custom order's delivery state to the Delivery collection. */
async function writeCustomOrderSnapshot(order) {
  const u = order.user?.name ? order.user : await require('../models/User').findById(order.user).select('name email').lean();
  const puritySuffix = order.purity && order.purity !== 'None' ? ` (${order.purity})` : '';
  await upsertDeliverySnapshot({
    sourceType:          'custom_order',
    sourceId:            order._id,
    orderId:             order.customOrderId || '',
    deliveryId:          order.deliveryId    || '',
    customerName:        u?.name  || '',
    customerEmail:       u?.email || '',
    shippingAddress:     order.shippingAddress,
    itemsSummary:        `Custom ${order.type} — ${order.material}${puritySuffix}`,
    totalAmount:         order.totalAmount || order.quoteAmount || 0,
    status:              order.status,
    dispatchedAt:        order.dispatchedAt,
    estimatedDelivery:   order.estimatedDelivery,
    deliveredAt:         order.deliveredAt,
    deliveryAgent:       order.deliveryAgent,
    deliveredByPartnerId:   order.deliveredByPartnerId   || '',
    deliveredByPartnerName: order.deliveredByPartnerName || '',
    trackingHistory:     order.trackingHistory,
  });
}

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
      // Merge advance_paid into confirmed — both display as "In Production" in admin UI
      statusCounts: statusCounts.reduce((acc, s) => {
        const key = s._id === 'advance_paid' ? 'confirmed' : s._id;
        acc[key] = (acc[key] || 0) + s.count;
        return acc;
      }, {}),
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
  // internal helpers shared with the webhook (orderController) and adminController
  confirmCustomPayment,
  commitCustomOrderStatus,
};
