/**
 * invoiceNumber.js — GST-style invoice numbers: consecutive, unique per financial year,
 * at most 16 characters (CGST Rule 46(b)). Format: MBJ/26-27/00001.
 *
 * One series covers shop orders and custom orders. A number is issued once per order,
 * after payment is confirmed (custom orders: after the final balance is paid), and the
 * invoice date is the payment date.
 *
 * Custom-order ADVANCE (70%): a receipt voucher (CGST Rule 50) gets its own series,
 * MBRV/26-27/00001, issued when the advance is paid. The tax invoice for the full value
 * still follows on the final payment (it lists the advance as already received).
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

/**
 * Document series. Each has its own consecutive counter per financial year.
 *   invoice        — tax invoice: shop orders on payment, custom orders on the final balance
 *   advanceReceipt — receipt voucher (CGST Rule 50) for the 70% custom-order advance,
 *                    format MBRV/26-27/00001 (≤ 16 characters)
 */
const SERIES = {
  invoice:        { prefix: PREFIX, counter: 'invoice', numberField: 'invoiceNumber', dateField: 'invoiceDate', claimField: 'invoiceClaimAt', label: 'Invoice' },
  advanceReceipt: { prefix: 'MBRV', counter: 'receipt', numberField: 'advanceReceiptNumber', dateField: 'advanceReceiptDate', claimField: 'advanceReceiptClaimAt', label: 'Advance receipt' },
};

/** Atomically take the next number of a series in the financial year of `date`. */
async function nextSeriesNumber(series, date = new Date()) {
  const fy = financialYear(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `${series.counter}-${fy}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `${series.prefix}/${fy}/${String(counter.seq).padStart(5, '0')}`;
}

/**
 * assignNumber — give a document its number exactly once.
 * A short-lived claim on the record guarantees only one caller takes a number from the
 * counter (so parallel verify + webhook calls cannot burn numbers and leave gaps).
 * @returns {Promise<{number: string, date: Date} | null>}
 */
async function assignNumber(series, Model, id, paidAt) {
  const { numberField: nf, dateField: df, claimField: cf } = series;
  try {
    const now = new Date();
    const claimed = await Model.findOneAndUpdate(
      {
        _id: id,
        $and: [
          { $or: [{ [nf]: { $exists: false } }, { [nf]: null }, { [nf]: '' }] },
          { $or: [{ [cf]: { $exists: false } }, { [cf]: null }, { [cf]: { $lt: new Date(now - CLAIM_TTL_MS) } }] },
        ],
      },
      { $set: { [cf]: now } },
      { new: true, projection: { _id: 1 } }
    );
    if (!claimed) {
      const existing = await Model.findById(id).select(`${nf} ${df}`).lean();
      return existing?.[nf] ? { number: existing[nf], date: existing[df] } : null;
    }
    const date = paidAt ? new Date(paidAt) : now;
    const number = await nextSeriesNumber(series, date);
    await Model.updateOne({ _id: id }, { $set: { [nf]: number, [df]: date }, $unset: { [cf]: 1 } });
    logger.info(`${series.label} ${number} issued for ${Model.modelName} ${id}`);
    return { number, date };
  } catch (err) {
    logger.error(`${series.label} numbering failed for ${Model.modelName} ${id}: ${err.message}`);
    return null;
  }
}

/** Atomically take the next invoice number in the financial year of `date`. */
function nextInvoiceNumber(date = new Date()) {
  return nextSeriesNumber(SERIES.invoice, date);
}

/**
 * assignInvoiceNumber — give a paid order its tax invoice number exactly once.
 * @returns {Promise<{invoiceNumber: string, invoiceDate: Date} | null>}
 */
async function assignInvoiceNumber(Model, id, paidAt) {
  const r = await assignNumber(SERIES.invoice, Model, id, paidAt);
  return r ? { invoiceNumber: r.number, invoiceDate: r.date } : null;
}

/**
 * assignAdvanceReceiptNumber — receipt voucher number for a paid custom-order advance (once).
 * @returns {Promise<{advanceReceiptNumber: string, advanceReceiptDate: Date} | null>}
 */
async function assignAdvanceReceiptNumber(CustomOrder, id, paidAt) {
  const r = await assignNumber(SERIES.advanceReceipt, CustomOrder, id, paidAt);
  return r ? { advanceReceiptNumber: r.number, advanceReceiptDate: r.date } : null;
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

  // Receipt vouchers for paid custom-order advances (oldest first)
  const noReceipt = { $or: [{ advanceReceiptNumber: { $exists: false } }, { advanceReceiptNumber: null }, { advanceReceiptNumber: '' }] };
  const advances = await CustomOrder.find({ 'advancePayment.status': 'paid', ...noReceipt })
    .select('advancePayment.paidAt createdAt').sort({ 'advancePayment.paidAt': 1 }).lean();
  let receipts = 0;
  for (const o of advances) {
    if (await assignAdvanceReceiptNumber(CustomOrder, o._id, o.advancePayment?.paidAt || o.createdAt)) receipts += 1;
  }
  if (receipts) logger.info(`Receipt backfill: issued ${receipts} advance receipt number(s)`);
  return issued;
}

module.exports = { financialYear, nextInvoiceNumber, assignInvoiceNumber, assignAdvanceReceiptNumber, backfillInvoiceNumbers };
