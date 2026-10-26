/**
 * paymentCapture.js — never mark an order paid unless Razorpay has really CAPTURED the money.
 *
 * WHY: the checkout signature (and an "authorized" payment) only proves the bank APPROVED the
 * payment. Razorpay auto-captures only payments authorized within the dashboard window
 * (12 min). A payment authorized later stays "authorized" and Razorpay REFUNDS it after a few
 * days — the shop would have shipped jewellery for nothing.
 *
 * secureCapture() is called before every confirmation (browser verify, retry-verify, webhook,
 * stale cleanup, 6-hourly sweep):
 *   1. loads the payment from Razorpay (or uses the signed webhook entity)
 *   2. checks it belongs to OUR Razorpay order and the amount/currency match what we charged
 *   3. captured  → OK
 *      authorized → we capture it ourselves (exact amount), then OK
 *      anything else / Razorpay unreachable → NOT paid (order stays pending; webhook,
 *      retry-verify, cleanup and the sweep finish it later)
 *
 * Returns { state, paymentId?, reason? } where state is one of:
 *   'captured'    money received — safe to confirm
 *   'pending'     payment still in progress, or capture could not be completed yet
 *   'unreachable' Razorpay not configured / API error — decide later
 *   'failed'      payment failed or was refunded — do not confirm
 *   'mismatch'    payment is for another order / wrong amount / wrong currency — do not confirm
 */
const Transaction = require('../models/Transaction');
const { razorpay, isRazorpayConfigured } = require('../config/razorpay');
const logger = require('./logger');

const rzpError = (err) => err?.error?.description || err?.message || String(err);

/** Amount we charged for this Razorpay order (paise), from our own Transaction record. */
async function expectedAmountPaise(razorpayOrderId) {
  const tx = await Transaction.findOne({ razorpayOrderId: String(razorpayOrderId), type: { $ne: 'refund' } })
    .select('amount').lean();
  return tx && Number.isFinite(Number(tx.amount)) ? Math.round(Number(tx.amount) * 100) : null;
}

async function fetchPayment(paymentId) {
  try {
    return await razorpay.payments.fetch(String(paymentId));
  } catch (err) {
    logger.warn(`Razorpay payment lookup failed for ${paymentId}: ${rzpError(err)}`);
    return null;
  }
}

function alertMismatch(payment, razorpayOrderId, reason) {
  logger.error(`PAYMENT MISMATCH: payment=${payment?.id} razorpayOrder=${razorpayOrderId} → ${reason}`);
  const { sendAdminAlert } = require('./email');
  if (typeof sendAdminAlert !== 'function') return;
  sendAdminAlert(
    `Check payment ${payment?.id || ''} — it does not match its order`,
    `<p>Payment <b>${payment?.id || '-'}</b> was NOT accepted for Razorpay order <b>${razorpayOrderId}</b>.</p>
     <p><b>Reason:</b> ${reason}</p>
     <p>No order was confirmed. Check this payment in the Razorpay dashboard and refund it if needed.</p>`
  ).catch((e) => logger.error(`Admin alert email failed: ${e.message}`));
}

/**
 * secureCapture — see file header.
 * @param {object}  o
 * @param {string}  o.razorpayOrderId  OUR Razorpay order id for this order/phase
 * @param {string} [o.paymentId]       Razorpay payment id (browser / reconcile)
 * @param {object} [o.payment]         payment entity from a signature-verified webhook (skips the lookup)
 */
async function secureCapture({ razorpayOrderId, paymentId, payment: given }) {
  if (!razorpayOrderId || (!paymentId && !given)) return { state: 'failed', reason: 'Missing payment details' };
  if (!isRazorpayConfigured) return { state: 'unreachable', reason: 'Payment gateway not configured' };

  let payment = given || (await fetchPayment(paymentId));
  if (!payment) return { state: 'unreachable', paymentId, reason: 'Could not reach Razorpay' };
  const id = payment.id || paymentId;

  // 1. Belongs to this order, exact amount, INR
  if (String(payment.order_id) !== String(razorpayOrderId)) {
    alertMismatch(payment, razorpayOrderId, `payment belongs to Razorpay order ${payment.order_id}`);
    return { state: 'mismatch', paymentId: id, reason: 'Payment does not belong to this order' };
  }
  const expected = await expectedAmountPaise(razorpayOrderId);
  if (expected === null) {
    alertMismatch(payment, razorpayOrderId, 'no payment record found for this Razorpay order');
    return { state: 'mismatch', paymentId: id, reason: 'No payment record for this order' };
  }
  if (Number(payment.amount) !== expected || String(payment.currency || '').toUpperCase() !== 'INR') {
    alertMismatch(payment, razorpayOrderId, `amount ${payment.amount} ${payment.currency} ≠ expected ${expected} INR (paise)`);
    return { state: 'mismatch', paymentId: id, reason: 'Payment amount does not match the order' };
  }

  // 2. Money status
  if (payment.status === 'captured') return { state: 'captured', paymentId: id };

  if (payment.status === 'authorized') {
    try {
      const captured = await razorpay.payments.capture(id, expected, 'INR');
      if (captured?.status === 'captured') {
        logger.warn(`Payment ${id} was only authorized — captured by the server (₹${expected / 100})`);
        return { state: 'captured', paymentId: id };
      }
    } catch (err) {
      // Razorpay auto-capture (or a parallel call) may have captured it a moment earlier
      logger.warn(`Server capture of ${id} failed: ${rzpError(err)} — re-checking`);
    }
    const fresh = await fetchPayment(id);
    if (fresh?.status === 'captured' && Number(fresh.amount) === expected) return { state: 'captured', paymentId: id };
    logger.error(`Payment ${id} is authorized but could not be captured yet (status ${fresh?.status || 'unknown'})`);
    return { state: 'pending', paymentId: id, reason: 'Payment approved by the bank, capture pending' };
  }

  if (payment.status === 'failed') return { state: 'failed', paymentId: id, reason: payment.error_description || 'Payment failed' };
  if (payment.status === 'refunded') return { state: 'failed', paymentId: id, reason: 'Payment was refunded' };
  return { state: 'pending', paymentId: id, reason: `Payment status: ${payment.status || 'unknown'}` };
}

module.exports = { secureCapture, expectedAmountPaise };
