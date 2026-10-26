/**
 * stockHold.js — reserve stock when a customer STARTS paying, not after.
 *
 * WHY: with stock = 1, two customers could both reach Razorpay; both pay, only one order can be
 * fulfilled, and the other customer has been charged. Holding the stock at create-payment means
 * the second customer is stopped BEFORE any money moves.
 *
 * LIFECYCLE (Order fields stockHeldAt / stockReleasedAt):
 *   create-payment → holdStock() decrements stock inside the same transaction that creates the order
 *   payment success → atomicConfirmOrder() keeps the hold (no second decrement), counts the sale
 *   cancel / fail / 15-min expiry → failOrderAndReleaseStock() gives the stock back exactly once
 *   payment that arrives AFTER release → stock is taken again if still available, otherwise the paid
 *     order is flagged stockIssue and admins are emailed (never silently charged)
 */
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const logger = require('./logger');

const HOLD_MINUTES = 15; // a pending payment keeps its stock this long (Razorpay checkout times out at 10)

/** Sum quantities per product (the same product may appear on several lines). */
function qtyByProduct(items) {
  const map = new Map();
  for (const it of items) {
    const id = String(it.product);
    map.set(id, (map.get(id) || 0) + Number(it.quantity || 0));
  }
  return map;
}

class OutOfStockError extends Error {
  constructor(productName) {
    super(`"${productName}" has just been sold out or is reserved by another customer. Please check again in about ${HOLD_MINUTES} minutes.`);
    this.code = 'OUT_OF_STOCK';
  }
}

/**
 * holdStock — atomically take stock for every line, inside `session`.
 * Each decrement is conditional on stock >= qty, so two parallel checkouts can never both take the
 * last piece. Throws OutOfStockError (the caller aborts the transaction → nothing is held).
 */
async function holdStock(items, session) {
  for (const [productId, qty] of qtyByProduct(items)) {
    const res = await Product.updateOne(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { session }
    );
    if (res.modifiedCount !== 1) {
      const p = await Product.findById(productId).select('name').session(session).lean();
      throw new OutOfStockError(p?.name || 'An item in your cart');
    }
  }
}

/** Run a transaction, retrying on transient write conflicts (two writers on the same order). */
async function withTransaction(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await fn(session); });
      return result;
    } catch (err) {
      lastErr = err;
      const transient = err?.hasErrorLabel?.('TransientTransactionError') || err?.code === 112 || /WriteConflict/i.test(err?.message || '');
      if (!transient) throw err;
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    } finally {
      await session.endSession();
    }
  }
  throw lastErr;
}

/**
 * failOrderAndReleaseStock — mark an unpaid order failed and return its held stock (exactly once).
 * Never touches a paid order. Safe to call repeatedly / in parallel (browser cancel + webhook + cleanup).
 * Returns { failed: boolean, released: boolean }.
 */
async function failOrderAndReleaseStock(orderId, failReason) {
  return withTransaction(async (session) => {
    // Only unpaid orders (pending / already failed) — never paid, refunded or cancelled ones
    const order = await Order.findOneAndUpdate(
      { _id: orderId, 'payment.status': { $in: ['pending', 'failed'] }, orderStatus: { $ne: 'cancelled' } },
      { $set: { orderStatus: 'failed', 'payment.status': 'failed', 'payment.failReason': String(failReason || '').slice(0, 300) } },
      { new: true, session }
    );
    if (!order) return { failed: false, released: false };

    if (!order.stockHeldAt || order.stockReleasedAt) return { failed: true, released: false };

    const claimed = await Order.updateOne(
      { _id: orderId, stockReleasedAt: null, 'payment.status': { $in: ['pending', 'failed'] } },
      { $set: { stockReleasedAt: new Date() } },
      { session }
    );
    if (claimed.modifiedCount !== 1) return { failed: true, released: false };

    for (const [productId, qty] of qtyByProduct(order.items)) {
      await Product.updateOne({ _id: productId }, { $inc: { stock: qty } }, { session });
    }
    return { failed: true, released: true };
  });
}

/**
 * takeStockForConfirmedOrder — inside the confirm transaction, after the order was claimed as paid.
 *   held & not released → nothing to take (already reserved); count the sale
 *   otherwise (legacy order or released hold) → take stock now if available
 * Returns { stockIssue: string|null } — a paid order is NEVER failed because of stock.
 */
async function takeStockForConfirmedOrder(order, session) {
  const lines = qtyByProduct(order.items);
  const reserved = order.stockHeldAt && !order.stockReleasedAt;
  const short = [];

  for (const [productId, qty] of lines) {
    if (reserved) {
      await Product.updateOne({ _id: productId }, { $inc: { sold: qty } }, { session });
      continue;
    }
    const res = await Product.updateOne(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty, sold: qty } },
      { session }
    );
    if (res.modifiedCount !== 1) {
      const p = await Product.findById(productId).select('name stock').session(session).lean();
      short.push(p ? `${p.name} (needed ${qty}, in stock ${p.stock})` : `product ${productId} (deleted)`);
    }
  }
  if (short.length === 0) return { stockIssue: null };
  logger.error(`PAID BUT OUT OF STOCK: order=${order._id} → ${short.join('; ')}`);
  return { stockIssue: `Paid but out of stock: ${short.join('; ')}` };
}

module.exports = { HOLD_MINUTES, OutOfStockError, holdStock, withTransaction, failOrderAndReleaseStock, takeStockForConfirmedOrder, qtyByProduct };
