/**
 * paymentReconcile.js — ask Razorpay before giving up on a payment.
 *
 * WHY: the browser confirmation and the webhook can both be lost (tab closed right after paying +
 * a server hiccup). Without this, the stale-order cleanup would mark a PAID order failed and the
 * customer would have to notice and press "Recover". Now:
 *   • cleanupStaleOrders asks Razorpay about every expired unpaid order before failing it
 *   • reconcileRecentPayments (every 6 h) re-checks payments marked failed in the last 48 h
 * A captured payment found this way is confirmed through the SAME code as a normal payment
 * (atomicConfirmOrder / confirmCustomPayment) — idempotent, stock-safe, admin-alerted on stock issues.
 */
const Transaction = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const logger = require('./logger');

const MAX_WAIT_MINUTES = 60;     // payment still in progress / Razorpay unreachable → keep waiting this long
const SWEEP_WINDOW_HOURS = 48;   // reconcileRecentPayments looks back this far
const SWEEP_EVERY_HOURS = 6;     // the same payment is re-checked at most this often
const BATCH = 50;                // max Razorpay lookups per run

/**
 * checkRazorpayOrder — what happened to this Razorpay order?
 * Returns one of:
 *   { state: 'captured', paymentId }   money received
 *   { state: 'authorized', paymentId } approved by the bank but not captured (auto-capture off)
 *   { state: 'pending' }               a payment attempt is still in progress
 *   { state: 'none' }                  no payment, or every attempt failed
 *   { state: 'unreachable' }           Razorpay not configured / API error → decide later
 */
async function checkRazorpayOrder(razorpayOrderId) {
  if (!razorpayOrderId) return { state: 'none' };
  if (!isRazorpayConfigured) return { state: 'unreachable' };
  let payments;
  try {
    const res = await razorpay.orders.fetchPayments(String(razorpayOrderId));
    payments = Array.isArray(res?.items) ? res.items : [];
  } catch (err) {
    logger.warn(`Razorpay lookup failed for ${razorpayOrderId}: ${err?.error?.description || err.message}`);
    return { state: 'unreachable' };
  }
  const captured = payments.find((p) => p.status === 'captured');
  if (captured) return { state: 'captured', paymentId: captured.id };
  const authorized = payments.find((p) => p.status === 'authorized');
  if (authorized) return { state: 'authorized', paymentId: authorized.id };
  if (payments.some((p) => p.status === 'created')) return { state: 'pending' };
  return { state: 'none' };
}

const ageMinutes = (date) => (Date.now() - new Date(date).getTime()) / 60000;

/**
 * confirmFromRazorpay — confirm a shop or custom order whose payment Razorpay says is captured
 * or authorized (an authorized payment is captured first — see paymentCapture.js).
 * Returns true when the order is (now) paid.
 */
async function confirmFromRazorpay({ orderType, orderId, phase, razorpayOrderId, paymentId }) {
  // Amount/order check; an authorized payment is captured here. Not captured → not confirmed.
  const { secureCapture } = require('./paymentCapture');
  const capture = await secureCapture({ razorpayOrderId, paymentId });
  if (capture.state !== 'captured') {
    logger.warn(`Reconcile: ${orderType} ${orderId} payment ${paymentId} not confirmed — ${capture.state}: ${capture.reason || ''}`);
    return false;
  }
  if (orderType === 'CustomOrder') {
    const { confirmCustomPayment } = require('../controllers/customOrderController'); // lazy: no require cycle
    const r = await confirmCustomPayment({
      customOrderId: orderId, phase, razorpayOrderId, razorpayPaymentId: paymentId,
      razorpaySignature: 'razorpay_api_verified', actorId: undefined, via: 'reconcile', anyRazorpayOrder: true,
    });
    return !!r.ok;
  }
  const Order = require('../models/Order');
  const { atomicConfirmOrder } = require('../controllers/orderController');
  const order = await Order.findById(orderId);
  if (!order) return false;
  const r = await atomicConfirmOrder(order, paymentId, 'razorpay_api_verified', razorpayOrderId);
  return !!r.success;
}

/**
 * reconcileRecentPayments — safety sweep: payments marked FAILED in the last 48 h whose Razorpay
 * order turns out to be captured or authorized (paid after a cancel, late UPI, lost confirmation)
 * are recovered — authorized money is captured first.
 */
async function reconcileRecentPayments() {
  if (!isRazorpayConfigured) return { checked: 0, recovered: 0 };
  const since = new Date(Date.now() - SWEEP_WINDOW_HOURS * 3600 * 1000);
  const recheckBefore = new Date(Date.now() - SWEEP_EVERY_HOURS * 3600 * 1000);
  const txs = await Transaction.find({
    type: 'payment',
    status: 'failed',
    razorpayOrderId: { $exists: true, $nin: [null, ''] },
    createdAt: { $gte: since },
    $or: [{ lastReconcileAt: { $exists: false } }, { lastReconcileAt: null }, { lastReconcileAt: { $lt: recheckBefore } }],
  }).sort({ createdAt: -1 }).limit(BATCH).lean();

  let recovered = 0;
  for (const tx of txs) {
    try {
      const check = await checkRazorpayOrder(tx.razorpayOrderId);
      if (check.state === 'unreachable') continue; // try again next sweep
      await Transaction.updateOne({ _id: tx._id }, { $set: { lastReconcileAt: new Date() } });
      if ((check.state !== 'captured' && check.state !== 'authorized') || !tx.order) continue;
      const ok = await confirmFromRazorpay({
        orderType: tx.orderType, orderId: tx.order, phase: tx.phase, razorpayOrderId: tx.razorpayOrderId, paymentId: check.paymentId,
      });
      if (ok) {
        recovered += 1;
        logger.warn(`Reconcile sweep: recovered paid ${tx.orderType} ${tx.order} (razorpay ${tx.razorpayOrderId}, payment ${check.paymentId})`);
      }
    } catch (err) {
      logger.error(`Reconcile sweep failed for transaction ${tx._id}: ${err.message}`);
    }
  }
  if (txs.length) logger.info(`Reconcile sweep: checked ${txs.length}, recovered ${recovered}`);
  return { checked: txs.length, recovered };
}

module.exports = {
  MAX_WAIT_MINUTES, SWEEP_EVERY_HOURS,
  checkRazorpayOrder, confirmFromRazorpay, reconcileRecentPayments, ageMinutes,
};
