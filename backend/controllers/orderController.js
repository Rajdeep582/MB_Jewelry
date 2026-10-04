const mongoose = require('mongoose');
const crypto = require('node:crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const { verifyRazorpaySignature } = require('../utils/razorpayHelper');

const logger = require('../utils/logger');
const { upsertDeliverySnapshot } = require('../utils/deliverySnapshot');
const { getShippingForPincode, getSupportedZones } = require('../utils/shippingRates');
const { applyLivePrice, getGstRate } = require('../utils/pricingUtils');
const { getPricingMap } = require('../utils/pricingCache');
const { buildOrderSearch } = require('../utils/orderSearch');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute server-side pricing from validated items.
 * NEVER trust the client for prices.
 * shippingCharge comes ONLY from the backend PIN-code mapping (utils/shippingRates.js).
 */
function computePricing(orderItems, shippingCharge) {
  const itemsPrice = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingPrice = shippingCharge;
  // GST is charged ONCE, here: product prices exclude GST. Rate per item (product.gst, default 3%).
  const taxRaw = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity * ((item.gstRate ?? 3) / 100),
    0
  );
  const taxPrice = Math.round(taxRaw * 100) / 100;
  const totalAmount = Math.round((itemsPrice + shippingPrice + taxPrice) * 100) / 100;
  return { itemsPrice, shippingPrice, taxPrice, totalAmount };
}

const REQUIRED_ADDR_FIELDS = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
const ADDRESS_FIELDS = ['fullName', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'country'];
const CLIENT_FINANCIAL_FIELDS = ['shippingPrice', 'shipping', 'shippingCharge', 'taxPrice', 'itemsPrice', 'totalAmount', 'amount', 'pricing'];

/**
 * resolveShippingAddress — pick the delivery address for this checkout.
 *   • shippingAddressId → load the user's SAVED address from the database (trusted copy;
 *     any address object sent alongside it is ignored).
 *   • otherwise         → a new address typed at checkout (only known fields are kept).
 * Returns { address } or { status, message }.
 */
async function loadSavedAddress(userId, addressId) {
  if (!mongoose.isValidObjectId(addressId)) {
    return { status: 400, message: 'Invalid saved address' };
  }
  const owner = await User.findById(userId).select('addresses').lean();
  const saved = owner?.addresses?.find((a) => String(a._id) === String(addressId));
  return saved ? { saved } : { status: 404, message: 'Saved address not found' };
}

async function resolveShippingAddress(userId, body, { requireComplete = true } = {}) {
  let source = body.shippingAddress;
  if (body.shippingAddressId) {
    const found = await loadSavedAddress(userId, body.shippingAddressId);
    if (!found.saved) return found;
    source = found.saved;
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { status: 400, message: 'Shipping address is missing: pincode' };
  }

  const address = {};
  for (const field of ADDRESS_FIELDS) {
    if (source[field] !== undefined && source[field] !== null) address[field] = String(source[field]).trim();
  }
  if (requireComplete) {
    for (const field of REQUIRED_ADDR_FIELDS) {
      if (!address[field]) {
        return { status: 400, message: `Shipping address is missing: ${field}` };
      }
    }
  }
  return { address };
}

/**
 * buildCheckoutQuote — the ONE place an order total is calculated.
 * Used by both the checkout quote (display) and create-payment (charge),
 * so the amount shown to the customer is exactly the amount charged.
 *   PIN code → delivery area → shipping charge → server-side item prices → GST → total
 * Any financial values sent by the client are ignored.
 * Returns { quote } or { status, body } (error response).
 */
async function buildCheckoutQuote(userId, body, { requireCompleteAddress = true } = {}) {
  const { items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { status: 400, body: { success: false, message: 'Cart is empty' } };
  }

  // 1. Delivery address (saved address from DB, or validated new address)
  const addr = await resolveShippingAddress(userId, body, { requireComplete: requireCompleteAddress });
  if (addr.message) {
    return { status: addr.status, body: { success: false, message: addr.message } };
  }

  // 2. PIN code → delivery area → shipping charge (backend mapping only)
  const shipping = getShippingForPincode(addr.address.pincode);
  if (!shipping.ok) {
    return {
      status: 400,
      body: {
        success: false,
        code: shipping.code,
        message: shipping.message,
        pincode: shipping.pincode,
        supportedZones: getSupportedZones(),
      },
    };
  }
  addr.address.pincode = shipping.pincode;

  // 3. Items + prices from the database
  const { orderItems, errors } = await validateAndBuildItems(items);
  if (errors.length > 0) {
    return { status: 400, body: { success: false, message: errors[0], errors } };
  }

  // 4. Totals
  const pricing = computePricing(orderItems, shipping.charge);
  if (!Number.isFinite(pricing.totalAmount) || pricing.totalAmount <= 0
      || pricing.shippingPrice !== shipping.charge) {
    logger.error(`Checkout quote produced an invalid total: ${JSON.stringify(pricing)}`);
    return { status: 400, body: { success: false, message: 'Could not calculate the order total. Please try again.' } };
  }

  return {
    quote: {
      orderItems,
      shippingAddress: addr.address,
      delivery: { pincode: shipping.pincode, area: shipping.area, charge: shipping.charge },
      pricing,
    },
  };
}

/**
 * Validate cart items against the DB and build orderItems array.
 * Returns { orderItems, errors } — errors array is non-empty on failure.
 */
async function validateAndBuildItems(items) {
  const orderItems = [];
  const errors = [];

  // Pre-fetch every referenced product in ONE query (avoids N+1: was 1 findById per item).
  const validIds = items
    .map((i) => i?.productId)
    .filter((id) => id && mongoose.isValidObjectId(id));
  const [products, pricingMap] = await Promise.all([
    Product.find({ _id: { $in: validIds } }).lean(),
    getPricingMap(),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Same product on several lines → stock must cover the combined quantity
  const qtyByProduct = new Map();
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (item?.productId && Number.isInteger(qty) && qty > 0) {
      qtyByProduct.set(String(item.productId), (qtyByProduct.get(String(item.productId)) || 0) + qty);
    }
  }

  for (const item of items) {
    if (!item || !item.productId || !mongoose.isValidObjectId(item.productId)) {
      errors.push(`Invalid product ID: ${item?.productId}`);
      continue;
    }
    const qty = Number(item.quantity);
    if (!qty || qty < 1 || !Number.isInteger(qty)) {
      errors.push(`Invalid quantity for product ${item.productId}`);
      continue;
    }

    const product = productMap.get(String(item.productId));
    if (!product) {
      errors.push(`Product not found: ${item.productId}`);
      continue;
    }
    const totalQty = qtyByProduct.get(String(item.productId)) || qty;
    if (product.stock < totalQty) {
      errors.push(`Insufficient stock for "${product.name}" (available: ${product.stock})`);
      continue;
    }

    // Same live price (and live discount) the shop pages show — what is shown is what is charged
    const live = applyLivePrice(product, pricingMap);
    const price = live.discountedPrice ?? live.price;
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`"${product.name}" is not available for online purchase right now (price on request)`);
      continue;
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url || '',
      price,
      quantity: qty,
      gstRate: getGstRate(product, pricingMap),
    });
  }

  return { orderItems, errors };
}

/**
 * Core atomic commit: decrement stock, confirm order, update transaction.
 * Shared by verifyPayment, handleWebhook, and retryVerifyPayment.
 *
 * IDEMPOTENT + RACE-SAFE: browser verify, the Razorpay webhook and retry-verify can all fire
 * for the same payment at the same moment. The order is CLAIMED first with a conditional
 * update (payment.status != 'paid'); only one caller can win. A loser (claim returns null,
 * or a WriteConflict from the parallel transaction) re-reads the order and reports success
 * if it is now paid — it never overwrites a confirmed order with 'failed' and never
 * decrements stock twice.
 */
async function atomicConfirmOrder(pendingOrder, razorpayPaymentId, razorpaySignature, razorpayOrderId) {
  const alreadyPaid = async () => {
    const fresh = await Order.findById(pendingOrder._id);
    return fresh?.payment?.status === 'paid' ? fresh : null;
  };

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Claim + confirm the order (only if not already paid)
    const confirmedOrder = await Order.findOneAndUpdate(
      { _id: pendingOrder._id, 'payment.status': { $ne: 'paid' } },
      {
        orderStatus: 'confirmed',
        'payment.razorpayPaymentId': razorpayPaymentId,
        'payment.razorpaySignature': razorpaySignature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        'payment.failReason': '',
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
    if (!confirmedOrder) {
      await session.abortTransaction();
      session.endSession();
      const paid = await alreadyPaid();
      if (paid) return { success: true, order: paid, alreadyPaid: true };
      return { success: false, error: 'Order not found' };
    }

    // 2. Decrement stock atomically — single findOneAndUpdate with stock >= quantity guard
    //    Prevents TOCTOU race condition where two concurrent payments both pass the read check
    for (const item of pendingOrder.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, sold: item.quantity } },
        { new: true, session }
      );
      if (!updated) {
        const p = await Product.findById(item.product).session(session).lean();
        if (!p) throw new Error(`Product ${item.product} no longer exists`);
        throw new Error(`Insufficient stock for "${p.name}" (available: ${p.stock})`);
      }
    }

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
    await session.abortTransaction().catch(() => {});
    session.endSession();

    // A parallel caller (webhook / second verify) may have confirmed it — that is success.
    const paid = await alreadyPaid();
    if (paid) {
      logger.info(`atomicConfirmOrder: order=${pendingOrder._id} already confirmed by a parallel call`);
      return { success: true, order: paid, alreadyPaid: true };
    }

    // Genuine failure (e.g. stock ran out after payment) — record it, never touching a paid order
    await Order.findOneAndUpdate(
      { _id: pendingOrder._id, 'payment.status': { $ne: 'paid' } },
      { 'payment.status': 'failed', 'payment.failReason': err.message }
    );
    await Transaction.findOneAndUpdate(
      { razorpayOrderId: String(razorpayOrderId), status: { $ne: 'success' } },
      { status: 'failed', failReason: err.message }
    );

    // The winning transaction may have committed while we were writing the failure
    const paidLate = await alreadyPaid();
    if (paidLate) return { success: true, order: paidLate, alreadyPaid: true };

    logger.error(`atomicConfirmOrder rollback: order=${pendingOrder._id}, ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Phase 1: Create Payment ─────────────────────────────────────────────────
// @route   POST /api/orders/create-payment
// @access  Private
const createPayment = async (req, res) => {
  const { method = 'razorpay' } = req.body;

  // --- Guard: COD is no longer supported ---
  if (method === 'cod') {
    return res.status(400).json({ success: false, message: 'Cash on Delivery is no longer available. Please use online payment.' });
  }

  // Client-supplied money values are never used — log them for monitoring.
  const sentFinancials = CLIENT_FINANCIAL_FIELDS.filter((f) => req.body[f] !== undefined);
  if (sentFinancials.length > 0) {
    logger.warn(`create-payment: ignoring client-supplied financial fields [${sentFinancials.join(', ')}] from user=${req.user._id}`);
  }

  // --- Address → PIN code → shipping, DB prices, GST, total (all server-side) ---
  const result = await buildCheckoutQuote(req.user._id, req.body);
  if (!result.quote) {
    return res.status(result.status).json(result.body);
  }
  const { orderItems, shippingAddress, delivery, pricing } = result.quote;

  // --- Consistency check: the total the customer saw must equal the server total ---
  if (req.body.expectedTotal !== undefined) {
    const expected = Number(req.body.expectedTotal);
    if (!Number.isFinite(expected) || Math.round(expected * 100) !== Math.round(pricing.totalAmount * 100)) {
      logger.warn(`create-payment: expectedTotal mismatch user=${req.user._id} expected=${req.body.expectedTotal} server=${pricing.totalAmount}`);
      return res.status(409).json({
        success: false,
        code: 'PRICE_CHANGED',
        message: 'Your order total has changed. Please review the updated amount before paying.',
        pricing,
        delivery,
      });
    }
  }

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
        orderStatus: 'pending_payment',
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
    delivery,
  });
};

// ─── Checkout Quote (display only — same calculation as create-payment) ──────
// @route   POST /api/orders/quote
// @access  Private (users)
// Body: { items: [{ productId, quantity }], shippingAddressId? , shippingAddress?: { pincode, ... } }
// ─── Public: serviceable delivery areas ───────────────────────────────────────
// @route   GET /api/orders/shipping-zones
// @access  Public — display only (product page PIN checker). Checkout/payment still price on the server.
const getShippingZones = (req, res) => {
  res.json({ success: true, zones: getSupportedZones() });
};

const getCheckoutQuote = async (req, res) => {
  const result = await buildCheckoutQuote(req.user._id, req.body, { requireCompleteAddress: false });
  if (!result.quote) {
    return res.status(result.status).json(result.body);
  }
  const { orderItems, delivery, pricing } = result.quote;
  return res.json({
    success: true,
    delivery,
    pricing,
    items: orderItems.map((i) => ({ product: i.product, name: i.name, price: i.price, quantity: i.quantity })),
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

  // --- Load the pending order first (ownership + idempotency before signature work) ---
  const pendingOrder = await Order.findById(pendingOrderId);
  if (!pendingOrder) {
    return res.status(404).json({ success: false, message: 'Pending order not found' });
  }

  // --- Ownership check ---
  if (pendingOrder.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized for this order' });
  }

  // --- Idempotency: already confirmed? (short-circuit before signature verification) ---
  if (pendingOrder.payment.status === 'paid') {
    logger.warn(`Duplicate verify-payment attempt for order=${pendingOrderId}`);
    return res.json({ success: true, message: 'Order already confirmed', order: pendingOrder });
  }

  // --- Cross-validate razorpayOrderId against stored value (prevents payment swap attack) ---
  if (pendingOrder.payment.razorpayOrderId !== razorpayOrderId) {
    logger.warn(`razorpayOrderId mismatch for order=${pendingOrderId}: submitted=${razorpayOrderId}, stored=${pendingOrder.payment.razorpayOrderId}`);
    return res.status(400).json({ success: false, message: 'Payment ID mismatch for this order.' });
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

  const result = await atomicConfirmOrder(pendingOrder, razorpayPaymentId, razorpaySignature, razorpayOrderId);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: `Payment confirmation failed: ${result.error}. Please contact support if amount was deducted.`,
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

  // Signature not available in retry path — mark as API-verified
  const result = await atomicConfirmOrder(order, capturedPayment.id, 'razorpay_api_verified', razorpayOrderId);

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
    // Conditional: never flip an order that was confirmed in the meantime (webhook/verify race)
    await Order.findOneAndUpdate(
      { _id: pendingOrderId, 'payment.status': { $ne: 'paid' } },
      { orderStatus: 'failed', 'payment.status': 'failed', 'payment.failReason': failReason },
      { session: failSession }
    );

    await Transaction.findOneAndUpdate(
      { order: new mongoose.Types.ObjectId(pendingOrderId), status: 'pending' },
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

/**
 * Find which custom order + phase a Razorpay order belongs to. Our own pending Transaction
 * record is the source of truth (it survives a second checkout attempt overwriting the
 * Razorpay order id stored on the custom order).
 */
async function findCustomPaymentTarget(razorpayOrderId) {
  const tx = await Transaction.findOne({ razorpayOrderId: String(razorpayOrderId), orderType: 'CustomOrder' }).lean();
  if (!tx?.order || !['advance', 'final'].includes(tx.phase)) return null;
  return { customOrderId: tx.order, phase: tx.phase };
}

/** payment.captured for a custom order → same confirm path as the browser verify. */
async function reconcileCustomOrderPayment(payment) {
  const target = await findCustomPaymentTarget(payment.order_id);
  if (!target) return false;
  const { confirmCustomPayment } = require('./customOrderController'); // lazy: avoids a require cycle
  const result = await confirmCustomPayment({
    ...target,
    razorpayOrderId: payment.order_id,
    razorpayPaymentId: payment.id,
    razorpaySignature: '',
    actorId: undefined,
    via: 'webhook',
    anyRazorpayOrder: true,
  });
  if (result.ok) logger.info(`Webhook: custom order ${target.customOrderId} ${target.phase} payment reconciled`);
  else logger.error(`Webhook: custom order ${target.customOrderId} reconcile failed: ${result.error}`);
  return true;
}

/** payment.failed for a custom order → mark that phase failed unless it was already paid. */
async function failCustomOrderPayment(razorpayOrderId, failReason) {
  const target = await findCustomPaymentTarget(razorpayOrderId);
  if (!target) return;
  const CustomOrder = require('../models/CustomOrder');
  const statusPath = `${target.phase}Payment.status`;
  await CustomOrder.updateOne(
    { _id: target.customOrderId, [statusPath]: { $ne: 'paid' }, [`${target.phase}Payment.razorpayOrderId`]: String(razorpayOrderId) },
    { [statusPath]: 'failed', [`${target.phase}Payment.failReason`]: failReason }
  );
  await Transaction.updateOne(
    { razorpayOrderId: String(razorpayOrderId), status: 'pending' },
    { status: 'failed', failReason }
  );
}

async function processWebhookCaptured(payment) {
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const pendingOrder = await Order.findOne({ 'payment.razorpayOrderId': String(razorpayOrderId) });
  if (!pendingOrder) {
    // Not a shop order — maybe a custom-order advance/final payment
    const handled = await reconcileCustomOrderPayment(payment);
    if (!handled) logger.warn(`Webhook: No order found for razorpayOrder=${razorpayOrderId}`);
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
  if (!pendingOrder) {
    await failCustomOrderPayment(razorpayOrderId, failReason);
    return;
  }

  if (pendingOrder.payment.status === 'paid') return;

  // Conditional: a later 'captured' event for the same Razorpay order may already have won
  const flipped = await Order.findOneAndUpdate(
    { _id: pendingOrder._id, 'payment.status': { $ne: 'paid' } },
    { orderStatus: 'failed', 'payment.status': 'failed', 'payment.failReason': failReason }
  );
  if (!flipped) return;
  await Transaction.findOneAndUpdate(
    { razorpayOrderId: String(razorpayOrderId), status: { $ne: 'success' } },
    { status: 'failed', failReason }
  );

  logger.info(`Webhook: Order ${pendingOrder._id} marked failed via payment.failed event`);
}

// ─── Razorpay Webhook Handler ─────────────────────────────────────────────────
/**
 * handleWebhook
 * @route  POST /api/webhook/razorpay
 * @access Public — BUT only Razorpay can pass signature verification
 *
 * SIGNATURE VERIFICATION (HMAC-SHA256):
 *   Razorpay signs the raw request body with RAZORPAY_WEBHOOK_SECRET.
 *   We recompute HMAC-SHA256 over the raw body and compare using
 *   crypto.timingSafeEqual — NOT ===.
 *
 *   WHY timingSafeEqual, not ===:
 *     JavaScript === short-circuits on first mismatching character.
 *     Response time therefore leaks how many bytes of the signature matched.
 *     An attacker sending thousands of crafted requests can measure timing
 *     to deduce the correct signature byte-by-byte (timing side-channel attack).
 *     timingSafeEqual always compares all bytes in constant time — no leak.
 *
 *   BUFFER LENGTH GUARD:
 *     timingSafeEqual throws if buffers differ in length. We check length first
 *     and short-circuit with a safe rejection — no timing information leaked
 *     because a length mismatch is structurally invalid, not a partial match.
 *
 * RESPONSE ORDER:
 *   200 is sent BEFORE processing — Razorpay considers any non-200 a failure
 *   and retries. Processing happens asynchronously after ACK.
 *
 * EVENTS HANDLED:
 *   payment.captured → atomicConfirmOrder (marks order paid, sends confirmation)
 *   payment.failed   → marks order + transaction as failed
 *   All others       → silently ignored (logged)
 *
 * IDEMPOTENCY:
 *   processWebhookCaptured checks if order is already confirmed before writing.
 *   Safe to receive duplicate events (Razorpay retries on timeout).
 */
const handleWebhook = async (req, res) => {
  // 1. Always acknowledge immediately — Razorpay retries on non-200
  res.status(200).json({ received: true });

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook event');
    return;
  }

  // 2. Verify webhook signature — timing-safe HMAC comparison
  const signature = req.headers['x-razorpay-signature'] || '';
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body) // raw Buffer from express.raw() — must not be parsed
    .digest('hex');

  // Length check first: timingSafeEqual throws on unequal-length buffers.
  // A length mismatch is always invalid — reject immediately (no timing leak).
  const expectedBuf  = Buffer.from(expectedSig, 'hex');
  const receivedBuf  = Buffer.from(signature,   'hex');
  const sigValid =
    expectedBuf.length === receivedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!sigValid) {
    logger.warn('Webhook signature mismatch — request rejected (possible forgery or wrong secret).');
    return;
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
    .select('-payment.razorpaySignature')
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
    .populate('user', 'name email phone')
    .lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const ownerId = order.user?._id ?? order.user;
  if (ownerId?.toString() !== req.user._id.toString() && req.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, order });
};

// ─── Get All Orders (Admin) ──────────────────────────────────────────────────
// @route   GET /api/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  const { status, paymentStatus = 'all', search } = req.query;
  const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  const filter = {};

  if (status === 'needs_attention') {
    // Only flag orders that genuinely need admin intervention:
    // Payment failed but order is still actionable (not already marked failed)
    filter.$or = [
      { 'payment.status': 'failed', orderStatus: { $ne: 'failed' } },
    ];
  } else {
    if (status) filter.orderStatus = String(status);

    if (paymentStatus === 'paid') {
      filter['payment.status'] = 'paid';
    } else if (paymentStatus === 'pending') {
      filter['payment.status'] = 'pending';
    } else if (paymentStatus === 'failed') {
      filter['payment.status'] = 'failed';
    } else {
      // Default: exclude in-flight pending-payment orders — only show confirmed (paid) orders.
      // Pending orders are transient records created during Razorpay checkout flow.
      filter['payment.status'] = 'paid';
    }
  }

  // Support lookup: order ID, tracking number (MB-XXXXXXXX), customer name/email/phone,
  // product name, PIN code, city or Razorpay payment/order ID — searched across ALL pages.
  const searchOr = await buildOrderSearch(search, {
    idField: 'orderId',
    extra: (rx) => [{ 'items.name': rx }],
  });
  const query = searchOr ? { $and: [filter, { $or: searchOr }] } : filter;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .select('-payment.razorpaySignature')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    orders,
    total,
    pages: Math.ceil(total / limitNum),
    page: pageNum,
  });
};

// ─── Delivery Lifecycle State Machine ────────────────────────────────────────
//
// Valid forward transitions only:
//   pending_payment → (no admin transition — becomes 'confirmed' via webhook, or 'failed' via cleanup)
//   confirmed   → ready_to_ship
//   ready_to_ship → shipped
//   shipped     → delivered
//   delivered   → (terminal)
//   failed      → (terminal — internal only, set by payment failure/cleanup)
//
const DELIVERY_TRANSITIONS = {
  confirmed:     ['ready_to_ship'],
  ready_to_ship: ['shipped'],
  shipped:       ['delivered'],
  delivered:     [],   // terminal
  failed:        [],   // terminal — payment failure, no admin transition
};

// ─── Transition Helper ────────────────────────────────────────────────────────
/**
 * applyOrderTransition(order, status, estimatedDelivery)
 *
 * Mutates `order` in-place for a status change. Caller must call order.save().
 *
 * WHAT IT DOES:
 *   - Sets order.orderStatus to `status`
 *   - On shipped/delivered: generates deliveryId (UUID) + sets dispatchedAt
 *   - On delivered: sets deliveredAt timestamp
 *   - Optionally updates estimatedDelivery
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   - Does NOT touch order.payment.status
 *   - payment.status is only ever set by the Razorpay webhook handler
 *     (POST /api/payments/verify). No admin UI call can mark an order "paid"
 *     without a real Razorpay transaction. This is a security constraint.
 *
 * CALLER: updateOrderStatus (admin PUT /api/orders/:id/status)
 */
function applyOrderTransition(order, status, estimatedDelivery) {
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

  if (status === 'delivered') order.deliveredAt = new Date();
}

// ─── Update Order Status (Admin) ─────────────────────────────────────────────
/**
 * updateOrderStatus
 * @route  PUT /api/orders/:id/status
 * @access Admin only
 *
 * Advances an order through the state machine: DELIVERY_TRANSITIONS defines
 * all valid moves (e.g. confirmed → ready_to_ship → shipped → delivered).
 *
 * ACCEPTED BODY FIELDS:
 *   status            {string}  required — target status
 *   comment           {string}  optional — appended to trackingHistory
 *   estimatedDelivery {string}  optional — ISO date, only meaningful on shipped
 *
 * REJECTED BODY FIELDS (silently ignored for security):
 *   paymentStatus — admin cannot set payment.status via this endpoint.
 *                   Only the Razorpay webhook (POST /api/payments/verify) may
 *                   mark an order as "paid". This prevents fraudulent records.
 *
 * PRE-CONDITIONS FOR "delivered":
 *   1. DP must have confirmed delivery first (order.dpConfirmedAt must exist).
 *      Set by POST /api/delivery/orders/:id/confirm (delivery partner action).
 *   2. order.payment.status must already be "paid" (set by Razorpay webhook).
 *      Admin cannot pass paymentStatus in this same request to bypass this.
 *
 * SIDE EFFECTS:
 *   - Appends entry to order.trackingHistory
 *   - On shipped/delivered: upserts a snapshot into the Delivery collection
 *   - On delivered: records deliveredByPartnerId/Name from dpConfirmedBy
 */
const updateOrderStatus = async (req, res) => {
  const { status, comment, estimatedDelivery } = req.body;
  // NOTE: paymentStatus intentionally not destructured — see JSDoc above.

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

  // ── Same-status guard ─────────────────────────────────────────────────────
  if (current === status) {
    // Exception: allow estimatedDelivery-only update when order is shipped
    if (status === 'shipped' && estimatedDelivery) {
      order.estimatedDelivery = new Date(estimatedDelivery);
      await order.save();
      await writeOrderSnapshot(order); // keep the Delivery record's ETA in sync
      logger.info(`Order ${order._id} estimatedDelivery updated (status unchanged: shipped)`);
      return res.json({ success: true, order, message: 'Estimated delivery date updated' });
    }
    return res.status(400).json({ success: false, message: `Order is already in "${status}" status. Cannot update to the same status.` });
  }

  // ── State machine: validate transition ────────────────────────────────────
  const allowed = DELIVERY_TRANSITIONS[current] || [];
  if (current !== status && !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid transition: "${current}" → "${status}". Allowed next states: [${allowed.join(', ') || 'none'}]` });
  }

  // ── Pre-Delivery Validation ────────────────────────────────────────────────
  if (status === 'delivered' && !order.dpConfirmedAt) {
    return res.status(400).json({ success: false, message: 'Delivery partner must confirm delivery first before admin can mark as delivered.' });
  }
  if (status === 'delivered' && order.payment.status !== 'paid') {
    return res.status(400).json({ success: false, message: 'Payment must be confirmed (via Razorpay webhook) before marking as delivered.' });
  }

  await commitOrderStatus(order, status, { comment, estimatedDelivery, adminId: req.user._id });

  res.json({ success: true, order });
};

/**
 * commitOrderStatus — the ONE place a regular order's status is written after validation.
 * Used by updateOrderStatus and adminController.adminConfirmDelivery so both produce the same
 * deliveryId, timestamps, tracking history entry, partner attribution and Delivery snapshot.
 * Caller must have validated the transition.
 */
async function commitOrderStatus(order, status, { comment = '', estimatedDelivery, adminId } = {}) {
  const previous = order.orderStatus;

  // Claim the transition atomically: two admin tabs / double-clicks cannot both apply it
  // (prevents duplicate history entries and double "delivered" writes).
  const claimed = await Order.updateOne({ _id: order._id, orderStatus: previous }, { $set: { orderStatus: status } });
  if (claimed.modifiedCount === 0) {
    const err = new Error('This order was just updated by someone else. Refresh and try again.');
    err.statusCode = 409;
    throw err;
  }

  applyOrderTransition(order, status, estimatedDelivery);

  // ── Store delivery partner ID when marked delivered ────────────────────────
  // The partner who physically confirmed delivery takes precedence over the assigned one.
  if (status === 'delivered' && !order.deliveredByPartnerId) {
    const agentRef = order.dpConfirmedBy || order.deliveryAgent;
    if (agentRef) {
      const DeliveryPartner = require('../models/DeliveryPartner');
      const dp = await DeliveryPartner.findById(agentRef).select('partnerId name').lean();
      if (dp?.partnerId) order.deliveredByPartnerId   = dp.partnerId;
      if (dp?.name)      order.deliveredByPartnerName = dp.name;
    }
  }

  order.trackingHistory.push({
    status,
    comment: comment || '',
    updatedBy: adminId,
    timestamp: new Date(),
  });

  await order.save();

  logger.info(`Order ${order._id} transitioned "${previous}" → "${status}" by admin ${adminId}` + (order.deliveryId ? ` | deliveryId=${order.deliveryId}` : ''));

  if (status === 'shipped' || status === 'delivered') await writeOrderSnapshot(order);
  return order;
}

/** writeOrderSnapshot — persist the order's current delivery state to the Delivery collection. */
async function writeOrderSnapshot(order) {
  const populatedUser = order.user?.name ? order.user : await User.findById(order.user).select('name email').lean();
  const itemsSummary = (order.items || []).map(i => i.name).join(', ');
  await upsertDeliverySnapshot({
    sourceType:          'order',
    sourceId:            order._id,
    orderId:             order.orderId || '',
    deliveryId:          order.deliveryId || '',
    customerName:        populatedUser?.name  || '',
    customerEmail:       populatedUser?.email || '',
    shippingAddress:     order.shippingAddress,
    itemsSummary,
    totalAmount:         order.totalAmount || 0,
    status:              order.orderStatus,
    dispatchedAt:        order.dispatchedAt,
    estimatedDelivery:   order.estimatedDelivery,
    deliveredAt:         order.deliveredAt,
    deliveryAgent:       order.deliveryAgent,
    deliveredByPartnerId:   order.deliveredByPartnerId   || '',
    deliveredByPartnerName: order.deliveredByPartnerName || '',
    trackingHistory:        order.trackingHistory,
  });
}

// ─── Admin Stats ─────────────────────────────────────────────────────────────
// @route   GET /api/orders/stats
// @access  Admin
const getStats = async (req, res) => {
  // Only count orders with successful payment — exclude transient pending-payment records
  const validOrderQuery = { 'payment.status': 'paid', orderStatus: { $ne: 'failed' } };

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
      orderStatus: { $ne: 'failed' },
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
  const CUSTOM_DELIVERY_STATUSES = ['advance_paid', 'confirmed', 'ready_to_ship', 'shipped', 'delivered'];

  const [
    orderCounts, orderOverdue,
    customCounts, customOverdue,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { 'payment.status': 'paid', orderStatus: { $in: ['confirmed', 'ready_to_ship', 'shipped', 'delivered'] } } },
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

  const confirmed     = (oc.confirmed     || 0) + (cc.confirmed || 0) + (cc.advance_paid || 0);
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
  getCheckoutQuote,
  getShippingZones,
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
  // internal helper shared with adminController.adminConfirmDelivery
  commitOrderStatus,
};
