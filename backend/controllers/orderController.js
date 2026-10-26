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
const { assignInvoiceNumber } = require('../utils/invoiceNumber');
const { holdStock, withTransaction, failOrderAndReleaseStock, takeStockForConfirmedOrder, qtyByProduct } = require('../utils/stockHold');
const { sendAdminAlert } = require('../utils/email');
const { secureCapture } = require('../utils/paymentCapture');
const { checkRazorpayOrder } = require('../utils/paymentReconcile');

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
      errors.push(product.stock > 0
        ? `Only ${product.stock} of "${product.name}" available right now`
        : `"${product.name}" is sold out or reserved by another customer right now. Please check again in about 15 minutes.`);
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
 * Core atomic commit: confirm order, settle stock, update transaction.
 * Shared by verifyPayment, handleWebhook, and retryVerifyPayment.
 *
 * IDEMPOTENT + RACE-SAFE: browser verify, the Razorpay webhook and retry-verify can all fire
 * for the same payment at the same moment. The order is CLAIMED first with a conditional
 * update (payment.status != 'paid'); only one caller can win. Write conflicts (e.g. with a
 * parallel cancel/expiry releasing the stock hold) are retried by withTransaction.
 *
 * STOCK (utils/stockHold.js): stock was already reserved at create-payment, so normally nothing
 * is decremented here. If the hold had been released (payment arrived after cancel/expiry) the
 * stock is taken again when available; if it is gone the order is STILL confirmed (the money is
 * real) and flagged `stockIssue` + admins are emailed. A captured payment is never marked failed.
 */
async function atomicConfirmOrder(pendingOrder, razorpayPaymentId, razorpaySignature, razorpayOrderId) {
  const alreadyPaid = async () => {
    const fresh = await Order.findById(pendingOrder._id);
    return fresh?.payment?.status === 'paid' ? fresh : null;
  };

  let outcome;
  try {
    outcome = await withTransaction(async (session) => {
      // 1. Claim + confirm the order (only if not already paid)
      // Never re-open an order that was paid, refunded or cancelled by admin
      const confirmedOrder = await Order.findOneAndUpdate(
        { _id: pendingOrder._id, 'payment.status': { $nin: ['paid', 'refunded'] }, orderStatus: { $ne: 'cancelled' } },
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
      if (!confirmedOrder) return { claimed: false };

      // 2. Stock — already held at create-payment; re-take only if the hold was released
      const { stockIssue } = await takeStockForConfirmedOrder(confirmedOrder, session);
      if (stockIssue) {
        await Order.updateOne(
          { _id: confirmedOrder._id },
          {
            $set: { stockIssue },
            $push: { trackingHistory: { status: 'confirmed', comment: `⚠ ${stockIssue}. Restock the item or refund the customer.`, timestamp: new Date() } },
          },
          { session }
        );
        confirmedOrder.stockIssue = stockIssue;
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
      return { claimed: true, order: confirmedOrder, stockIssue };
    });
  } catch (err) {
    // A parallel caller (webhook / second verify) may have confirmed it — that is success.
    const paid = await alreadyPaid();
    if (paid) return { success: true, order: paid, alreadyPaid: true };
    // Unexpected DB failure. The payment is real, so the order is NOT marked failed: it stays
    // retryable (webhook / retry-verify); the reason is noted for support.
    await Order.updateOne(
      { _id: pendingOrder._id, 'payment.status': { $ne: 'paid' } },
      { 'payment.failReason': `Confirmation error: ${err.message}` }
    ).catch(() => {});
    logger.error(`atomicConfirmOrder failed: order=${pendingOrder._id}, ${err.message}`);
    return { success: false, error: err.message };
  }

  if (!outcome.claimed) {
    const paid = await alreadyPaid();
    if (paid) return { success: true, order: paid, alreadyPaid: true };
    return { success: false, error: 'Order not found' };
  }

  const confirmedOrder = outcome.order;
  logger.info(`Order confirmed atomically: order=${pendingOrder._id}, payment=${razorpayPaymentId}`);

  if (outcome.stockIssue) {
    sendAdminAlert(
      `Action needed: paid order without stock (${confirmedOrder.orderId || confirmedOrder._id})`,
      `<p>A payment was received after the stock hold had expired, and the item is no longer in stock.</p>
       <p><b>Order:</b> ${confirmedOrder.orderId || confirmedOrder._id}<br/>
       <b>Razorpay payment:</b> ${razorpayPaymentId}<br/>
       <b>Amount:</b> ₹${confirmedOrder.totalAmount}<br/>
       <b>Problem:</b> ${outcome.stockIssue}</p>
       <p>Please restock the item or refund the customer from the Razorpay dashboard.</p>`
    ).catch((e) => logger.error(`Admin alert email failed: ${e.message}`));
  }

  // Tax invoice number — after the commit so it can never hold up or undo a confirmed payment
  const invoice = await assignInvoiceNumber(Order, confirmedOrder._id, confirmedOrder.payment?.paidAt);
  if (invoice) Object.assign(confirmedOrder, invoice);
  return { success: true, order: confirmedOrder };
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

  // --- Atomic intent record creation + STOCK HOLD (utils/stockHold.js) ---
  // Stock is taken now, in the same transaction as the order: a second customer trying to buy
  // the last piece is stopped here, before any money moves. Returned on cancel/fail/expiry.
  // withTransaction retries write conflicts (several customers grabbing the same piece at once);
  // after a retry the loser sees stock 0 and gets OUT_OF_STOCK.
  let pendingOrder;
  let transaction;

  try {
    ({ pendingOrder, transaction } = await withTransaction(async (session) => {
      await holdStock(orderItems, session);

      const [order] = await Order.create(
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
          stockHeldAt: new Date(),
        }],
        { session }
      );

      const [tx] = await Transaction.create(
        [{
          order: order._id,
          orderType: 'Order',
          user: req.user._id,
          amount: pricing.totalAmount,
          currency: 'INR',
          status: 'pending',
        }],
        { session }
      );
      return { pendingOrder: order, transaction: tx };
    }));
  } catch (err) {
    if (err.code === 'OUT_OF_STOCK') {
      return res.status(409).json({ success: false, code: 'OUT_OF_STOCK', message: err.message });
    }
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
    // Razorpay failed — give the held stock back, then clean up intent records
    await failOrderAndReleaseStock(pendingOrder._id, 'Payment gateway error').catch((e) => logger.error(`Stock release failed: ${e.message}`));
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

/**
 * replyNotCaptured — the signature is valid but Razorpay has not captured the money (yet).
 *   pending / unreachable → 202: the order stays pending (stock still held); the webhook,
 *     retry-verify and the stale-order cleanup confirm it as soon as the capture completes.
 *   failed / mismatch     → 400: nothing is confirmed.
 */
function replyNotCaptured(res, capture, order) {
  logger.warn(`verify-payment: order=${order._id} payment=${capture.paymentId || '-'} not confirmed — ${capture.state}: ${capture.reason || ''}`);
  if (capture.state === 'pending' || capture.state === 'unreachable') {
    const view = order.toObject ? order.toObject() : { ...order };
    if (view.payment) delete view.payment.razorpaySignature;
    return res.status(202).json({
      success: true,
      pending: true,
      message: 'Payment received — we are confirming it with your bank. Your order will be confirmed automatically in a few minutes.',
      order: view,
    });
  }
  return res.status(400).json({
    success: false,
    message: capture.state === 'mismatch'
      ? 'This payment could not be matched to your order. Please contact support — any amount taken will be refunded.'
      : 'Payment was not completed. No money has been taken. Please try again.',
  });
}

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
  if (pendingOrder.orderStatus === 'cancelled') {
    return res.status(400).json({ success: false, message: 'This order was cancelled. Please contact support.' });
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

  // --- Money check: confirm only a payment Razorpay has CAPTURED (authorized → we capture it) ---
  const capture = await secureCapture({ razorpayOrderId, paymentId: razorpayPaymentId });
  if (capture.state !== 'captured') {
    return replyNotCaptured(res, capture, pendingOrder);
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
  if (order.orderStatus === 'cancelled') {
    return res.status(400).json({ success: false, message: 'This order was cancelled. Please contact support.' });
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

  // Ask Razorpay what happened to this order's payment(s)
  const check = await checkRazorpayOrder(razorpayOrderId);
  if (check.state === 'unreachable') {
    return res.status(502).json({ success: false, message: 'Could not verify payment status. Please try again.' });
  }
  if (check.state !== 'captured' && check.state !== 'authorized') {
    return res.status(402).json({
      success: false,
      message: 'Payment was not captured by Razorpay. You may try paying again from the Checkout page.',
    });
  }

  // Captured → amount/order checks; authorized → we capture it now
  const capture = await secureCapture({ razorpayOrderId, paymentId: check.paymentId });
  if (capture.state !== 'captured') {
    const status = capture.state === 'mismatch' || capture.state === 'failed' ? 402 : 502;
    return res.status(status).json({
      success: false,
      message: status === 402
        ? 'This payment could not be confirmed for this order. Please contact support with your order ID.'
        : 'Your bank approved the payment and we are still confirming it. Please try again in a few minutes.',
    });
  }
  const capturedPayment = { id: capture.paymentId };

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

  // Skip if already paid / refunded / cancelled (race condition guard)
  if (['paid', 'refunded'].includes(order.payment.status) || order.orderStatus === 'cancelled') {
    return res.json({ success: true, message: 'Order is already paid' });
  }

  const failReason = String(typeof reason === 'string' && reason ? reason : 'Payment cancelled by user').slice(0, 300);

  try {
    // Marks the order failed (never a paid one) and returns its held stock exactly once
    await failOrderAndReleaseStock(pendingOrderId, failReason);
    await Transaction.findOneAndUpdate(
      { order: new mongoose.Types.ObjectId(pendingOrderId), status: 'pending' },
      { status: 'failed', failReason }
    );
  } catch (err) {
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
  if (!result.ok) throw new Error(`custom order ${target.customOrderId} reconcile failed: ${result.error}`);
  logger.info(`Webhook: custom order ${target.customOrderId} ${target.phase} payment reconciled`);
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

  // Amount / order / currency check; an 'authorized' payment is captured here
  const capture = await secureCapture({ razorpayOrderId, payment });
  if (capture.state === 'mismatch' || capture.state === 'failed') {
    logger.warn(`Webhook: payment ${razorpayPaymentId} not confirmed — ${capture.state}: ${capture.reason || ''}`);
    return; // 200: nothing to retry
  }
  if (capture.state !== 'captured') {
    throw new Error(`payment ${razorpayPaymentId} not captured yet (${capture.state})`); // 500 → Razorpay retries
  }

  const pendingOrder = await Order.findOne({ 'payment.razorpayOrderId': String(razorpayOrderId) });
  if (!pendingOrder) {
    // Not a shop order — maybe a custom-order advance/final payment
    const handled = await reconcileCustomOrderPayment(payment);
    if (!handled) logger.warn(`Webhook: No order found for razorpayOrder=${razorpayOrderId}`);
    return;
  }

  if (pendingOrder.payment.status === 'paid' || pendingOrder.payment.status === 'refunded' || pendingOrder.orderStatus === 'cancelled') {
    logger.info(`Webhook: Order ${pendingOrder._id} already ${pendingOrder.orderStatus === 'cancelled' ? 'cancelled' : 'confirmed'} — skipping`);
    return;
  }

  const result = await atomicConfirmOrder(pendingOrder, razorpayPaymentId, '', razorpayOrderId);
  if (!result.success) throw new Error(`order ${pendingOrder._id} confirm failed: ${result.error}`);
  logger.info(`Webhook: Order ${pendingOrder._id} confirmed via payment.${payment.status === 'authorized' ? 'authorized' : 'captured'} event`);
}

async function processWebhookFailed(payment) {
  const razorpayOrderId = payment.order_id;
  const failReason = payment.error_description || 'Payment failed (Razorpay event)';

  const pendingOrder = await Order.findOne({ 'payment.razorpayOrderId': String(razorpayOrderId) });
  if (!pendingOrder) {
    await failCustomOrderPayment(razorpayOrderId, failReason);
    return;
  }

  if (['paid', 'refunded'].includes(pendingOrder.payment.status) || pendingOrder.orderStatus === 'cancelled') return;

  // Conditional: a later 'captured' event for the same Razorpay order may already have won.
  // Also returns the held stock (once).
  const { failed } = await failOrderAndReleaseStock(pendingOrder._id, failReason);
  if (!failed) return;
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
 * REPLY AFTER PROCESSING (not before):
 *   The event is fully processed (order confirmed / failed, stock settled) BEFORE we answer.
 *     200 → processed (or nothing to do)      → Razorpay stops sending it
 *     500 → processing failed (DB hiccup, restart mid-request…) → Razorpay RETRIES the same
 *           event automatically (for up to 24 h), so a paid order is never lost.
 *   Retries are safe: every handler is idempotent (an already-paid order is left as is).
 *   Processing is a few DB writes — far inside Razorpay's response timeout.
 *
 * SIGNATURE VERIFICATION (HMAC-SHA256 over the raw body, timing-safe compare):
 *   bad / missing signature → 400 (forged or wrong secret; nothing is processed)
 *   RAZORPAY_WEBHOOK_SECRET not set → 503 (Razorpay keeps retrying until it is configured)
 *
 * EVENTS HANDLED:
 *   payment.captured   → amount check → atomicConfirmOrder / custom-order confirm
 *   payment.authorized → amount check → WE capture it → confirm (optional event; see paymentCapture.js)
 *   payment.failed   → order failed + held stock returned
 *   All others       → 200, ignored
 */
const handleWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('RAZORPAY_WEBHOOK_SECRET not set — webhook event not processed (Razorpay will retry)');
    return res.status(503).json({ received: false });
  }

  // 1. Verify webhook signature — timing-safe HMAC comparison
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const expectedBuf = Buffer.from(crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex'), 'hex');
  const receivedBuf = Buffer.from(signature, 'hex');
  const sigValid = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
  if (!sigValid) {
    logger.warn('Webhook signature mismatch — request rejected (possible forgery or wrong secret).');
    return res.status(400).json({ received: false });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    logger.error('Failed to parse webhook body');
    return res.status(400).json({ received: false });
  }

  const eventType = event.event;
  const payment = event.payload?.payment?.entity;
  logger.info(`Razorpay webhook received: ${eventType}`);

  // 2. Process FIRST, then answer
  try {
    if ((eventType === 'payment.captured' || eventType === 'payment.authorized') && payment) await processWebhookCaptured(payment);
    else if (eventType === 'payment.failed' && payment) await processWebhookFailed(payment);
  } catch (err) {
    logger.error(`Webhook ${eventType} processing failed (Razorpay will retry): ${err.message}`);
    return res.status(500).json({ received: false });
  }

  return res.status(200).json({ received: true });
};

// ─── Get User's Orders ───────────────────────────────────────────────────────
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    $or: [
      { 'payment.status': 'paid' },
      { 'payment.status': 'refunded' },
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
      // Default: exclude in-flight pending-payment orders — only show paid orders
      // (incl. cancelled ones whose payment was later refunded manually).
      // Pending orders are transient records created during Razorpay checkout flow.
      filter['payment.status'] = { $in: ['paid', 'refunded'] };
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

// ─── Admin: Cancel a paid order (final) ───────────────────────────────────────
// @route   POST /api/orders/:id/cancel
// @access  Admin
// Body: { reason (required, 5–500 chars), confirmText: 'CANCEL' }
// Rare, admin-only. The shop has no online refunds: money is returned manually by the client and
// recorded later with POST /:id/refund. Cancelling is FINAL (no restore): the customer buys again.
//   • paid orders that are Confirmed / Ready to ship / Shipped only (never Delivered)
//   • stock goes back to the shop (not for "stock issue" orders — that stock was never taken)
//   • removed from active / delivery lists and revenue; payment shows "Refund pending"
const CANCELLABLE_STATUSES = ['confirmed', 'ready_to_ship', 'shipped'];

const cancelOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Please write the reason for cancelling (5–500 characters).' });
  }
  if (req.body.confirmText !== 'CANCEL') {
    return res.status(400).json({ success: false, message: 'Type CANCEL to confirm.' });
  }

  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.orderStatus === 'cancelled') return res.status(409).json({ success: false, message: 'Order is already cancelled.' });
  if (!CANCELLABLE_STATUSES.includes(order.orderStatus) || order.payment?.status !== 'paid') {
    return res.status(400).json({ success: false, message: `Only paid orders that are not yet delivered can be cancelled (current: ${order.orderStatus}).` });
  }

  const now = new Date();
  const returnStock = !order.stockIssue; // "stock issue" orders never took stock
  const updated = await withTransaction(async (session) => {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: { $in: CANCELLABLE_STATUSES }, 'payment.status': 'paid' },
      {
        $set: {
          orderStatus: 'cancelled',
          cancellation: {
            cancelledAt: now,
            cancelledBy: req.user._id,
            cancelledByName: req.user.name || '',
            reason,
            previousStatus: order.orderStatus,
            stockReturned: returnStock,
            refundStatus: 'pending',
          },
        },
        $push: { trackingHistory: { status: 'cancelled', comment: `Order cancelled by admin. Reason: ${reason}`, updatedBy: req.user._id, timestamp: now } },
      },
      { new: true, session }
    );
    if (!claimed) return null;
    if (returnStock) {
      for (const [productId, qty] of qtyByProduct(claimed.items)) {
        await Product.updateOne({ _id: productId }, { $inc: { stock: qty } }, { session });
        await Product.updateOne({ _id: productId, sold: { $gte: qty } }, { $inc: { sold: -qty } }, { session });
      }
    }
    return claimed;
  });
  if (!updated) {
    return res.status(409).json({ success: false, message: 'This order was just updated by someone else. Refresh and try again.' });
  }

  // Off the delivery dashboard
  const Delivery = require('../models/Delivery');
  await Delivery.deleteOne({ sourceId: updated._id, sourceType: 'order' }).catch((e) => logger.error(`Delivery record cleanup failed: ${e.message}`));

  logger.warn(`Order ${updated.orderId || updated._id} CANCELLED by admin ${req.user._id}: ${reason}`);
  res.json({ success: true, order: updated, message: 'Order cancelled. Refund is now pending — mark it refunded once the money is sent.' });
};

// ─── Admin: Record the manual refund of a cancelled order ─────────────────────
// @route   POST /api/orders/:id/refund
// @access  Admin
// Body: { note (required, 5–500), reference? (UTR, ≤100), amount? (default = order total), confirmText: 'REFUNDED' }
// Records money already sent back by the client (bank transfer / UPI / Razorpay dashboard).
// Stored on the order (cancellation.*) AND as a 'refund' Transaction. Final.
const markOrderRefunded = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (note.length < 5 || note.length > 500) {
    return res.status(400).json({ success: false, message: 'Please write a refund note (5–500 characters): how and when the money was sent.' });
  }
  const reference = typeof req.body.reference === 'string' ? req.body.reference.trim().slice(0, 100) : '';
  if (req.body.confirmText !== 'REFUNDED') {
    return res.status(400).json({ success: false, message: 'Type REFUNDED to confirm.' });
  }

  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.orderStatus !== 'cancelled') return res.status(400).json({ success: false, message: 'Only cancelled orders can be marked as refunded.' });
  if (order.cancellation?.refundStatus === 'refunded') return res.status(409).json({ success: false, message: 'Refund is already recorded for this order.' });

  let amount = order.totalAmount;
  if (req.body.amount !== undefined && req.body.amount !== '' && req.body.amount !== null) {
    amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > order.totalAmount) {
      return res.status(400).json({ success: false, message: `Refund amount must be between ₹1 and the order total ₹${order.totalAmount}.` });
    }
    amount = Math.round(amount * 100) / 100;
  }

  const now = new Date();
  const updated = await withTransaction(async (session) => {
    const refPart = reference ? ` (ref ${reference})` : '';
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: 'cancelled', 'cancellation.refundStatus': 'pending' },
      {
        $set: {
          'payment.status': 'refunded',
          'cancellation.refundStatus': 'refunded',
          'cancellation.refundAmount': amount,
          'cancellation.refundReference': reference,
          'cancellation.refundNote': note,
          'cancellation.refundedAt': now,
          'cancellation.refundedBy': req.user._id,
          'cancellation.refundedByName': req.user.name || '',
        },
        $push: { trackingHistory: { status: 'cancelled', comment: `Refund of ₹${amount} sent manually${refPart}. ${note}`, updatedBy: req.user._id, timestamp: now } },
      },
      { new: true, session }
    );
    if (!claimed) return null;
    await Transaction.create(
      [{
        order: claimed._id,
        orderType: 'Order',
        user: claimed.user,
        type: 'refund',
        amount,
        currency: 'INR',
        status: 'refunded',
        failReason: '',
        razorpayOrderId: claimed.payment?.razorpayOrderId,
        gatewayResponse: { razorpayOrderId: claimed.payment?.razorpayOrderId || '', razorpayPaymentId: claimed.payment?.razorpayPaymentId || '' },
      }],
      { session }
    );
    return claimed;
  });
  if (!updated) {
    return res.status(409).json({ success: false, message: 'This order was just updated by someone else. Refresh and try again.' });
  }

  logger.warn(`Order ${updated.orderId || updated._id} REFUND ₹${amount} recorded by admin ${req.user._id}`);
  res.json({ success: true, order: updated, message: 'Refund recorded.' });
};

// ─── Admin Stats ─────────────────────────────────────────────────────────────
// @route   GET /api/orders/stats
// @access  Admin
const getStats = async (req, res) => {
  // Only count orders with successful payment — exclude transient pending-payment records
  const validOrderQuery = { 'payment.status': 'paid', orderStatus: { $nin: ['failed', 'cancelled'] } };

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
  atomicConfirmOrder, // used by utils/paymentReconcile.js (auto-recovery of lost confirmations)
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
  cancelOrder,
  markOrderRefunded,
  getStats,
  getDeliveryStats,
  // internal helper shared with adminController.adminConfirmDelivery
  commitOrderStatus,
};
