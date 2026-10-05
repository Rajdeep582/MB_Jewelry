/**
 * invoiceNumber.js — GST-style invoice numbers: consecutive, unique per financial year,
 * at most 16 characters (CGST Rule 46(b)). Format: MBJ/26-27/00001.
 *
 * One series covers shop orders and custom orders. A number is issued once per order,
 * after payment is confirmed (custom orders: after the final balance is paid), and the
 * invoice date is the payment date.
 *
 * Assignment never blocks or fails a payment: callers ignore errors, and
 * backfillInvoiceNumbers() (run on startup) numbers anything that was missed.
 */
const Counter = require('../models/Counter');
const logger = require('./logger');

const PREFIX = 'MBJ';
const CLAIM_TTL_MS = 60 * 1000; // a claim older than this is considered abandoned (crash mid-assignment)

/** Indian financial year (April–March) of a date, in IST → "26-27". */
function financialYear(date = new Date()) {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1; // April = month 3
  const two = (n) => String(n % 100).padStart(2, '0');
  return `${two(start)}-${two(start + 1)}`;
}

/** Atomically take the next number in the financial year of `date`. */
async function nextInvoiceNumber(date = new Date()) {
  const fy = financialYear(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice-${fy}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `${PREFIX}/${fy}/${String(counter.seq).padStart(5, '0')}`;
}

/**
 * assignInvoiceNumber — give a paid order its invoice number exactly once.
 * A short-lived claim on the order guarantees only one caller takes a number from the
 * counter (so parallel verify + webhook calls cannot burn numbers and leave gaps).
 * @returns {Promise<{invoiceNumber: string, invoiceDate: Date} | null>}
 */
async function assignInvoiceNumber(Model, id, paidAt) {
  try {
    const now = new Date();
    const claimed = await Model.findOneAndUpdate(
      {
        _id: id,
        $and: [
          { $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }, { invoiceNumber: '' }] },
          { $or: [{ invoiceClaimAt: { $exists: false } }, { invoiceClaimAt: null }, { invoiceClaimAt: { $lt: new Date(now - CLAIM_TTL_MS) } }] },
        ],
      },
      { $set: { invoiceClaimAt: now } },
      { new: true, projection: { _id: 1 } }
    );
    if (!claimed) {
      const existing = await Model.findById(id).select('invoiceNumber invoiceDate').lean();
      return existing?.invoiceNumber ? { invoiceNumber: existing.invoiceNumber, invoiceDate: existing.invoiceDate } : null;
    }
    const invoiceDate = paidAt ? new Date(paidAt) : now;
    const invoiceNumber = await nextInvoiceNumber(invoiceDate);
    await Model.updateOne({ _id: id }, { $set: { invoiceNumber, invoiceDate }, $unset: { invoiceClaimAt: 1 } });
    logger.info(`Invoice ${invoiceNumber} issued for ${Model.modelName} ${id}`);
    return { invoiceNumber, invoiceDate };
  } catch (err) {
    logger.error(`assignInvoiceNumber failed for ${Model.modelName} ${id}: ${err.message}`);
    return null;
  }
}

/** Number every fully-paid order that has no invoice yet, oldest payment first. Idempotent. */
async function backfillInvoiceNumbers() {
  const Order = require('../models/Order');
  const CustomOrder = require('../models/CustomOrder');
  const noNumber = { $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }, { invoiceNumber: '' }] };

  const orders = await Order.find({ 'payment.status': 'paid', ...noNumber }).select('payment.paidAt createdAt').lean();
  const customs = await CustomOrder.find({ 'finalPayment.status': 'paid', ...noNumber }).select('finalPayment.paidAt createdAt').lean();

  const queue = [
    ...orders.map((o) => ({ Model: Order, id: o._id, paidAt: o.payment?.paidAt || o.createdAt })),
    ...customs.map((o) => ({ Model: CustomOrder, id: o._id, paidAt: o.finalPayment?.paidAt || o.createdAt })),
  ].sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));

  let issued = 0;
  for (const job of queue) {
    if (await assignInvoiceNumber(job.Model, job.id, job.paidAt)) issued += 1;
  }
  if (issued) logger.info(`Invoice backfill: issued ${issued} invoice number(s)`);
  return issued;
}

module.exports = { financialYear, nextInvoiceNumber, assignInvoiceNumber, backfillInvoiceNumbers };
