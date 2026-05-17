const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const Transaction = require('../models/Transaction');
const logger = require('./logger');

/**
 * Mark orders/payments stuck in pending for longer than maxAgeMinutes as failed.
 * Covers: regular Orders, CustomOrder advance payments, CustomOrder final payments.
 * Safe to run repeatedly.
 */
async function cleanupStaleOrders(maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const expiredMsg = `Payment session expired after ${maxAgeMinutes} minutes`;

  // Regular Orders
  try {
    const staleOrders = await Order.find({
      'payment.status': 'pending',
      orderStatus: { $ne: 'failed' },
      createdAt: { $lt: cutoff },
    }).select('_id').lean();

    if (staleOrders.length > 0) {
      const staleIds = staleOrders.map((o) => o._id);
      const orderResult = await Order.updateMany(
        { _id: { $in: staleIds } },
        { orderStatus: 'failed', 'payment.status': 'failed', 'payment.failReason': expiredMsg }
      );
      const txResult = await Transaction.updateMany(
        { order: { $in: staleIds }, orderType: 'Order', status: 'pending' },
        { status: 'failed', failReason: expiredMsg }
      );
      logger.info(
        `Stale order cleanup: failed ${orderResult.modifiedCount} orders, ` +
        `updated ${txResult.modifiedCount} transactions`
      );
    }
  } catch (err) {
    logger.error(`Stale order cleanup failed: ${err.message}`);
  }

  // Custom Orders - advance payment
  try {
    const staleAdvance = await CustomOrder.find({
      'advancePayment.status': 'pending',
      status: 'quoted',
      createdAt: { $lt: cutoff },
    }).select('_id').lean();

    if (staleAdvance.length > 0) {
      const ids = staleAdvance.map((o) => o._id);
      await CustomOrder.updateMany(
        { _id: { $in: ids } },
        { 'advancePayment.status': 'failed', 'advancePayment.failReason': expiredMsg }
      );
      await Transaction.updateMany(
        { order: { $in: ids }, orderType: 'CustomOrder', phase: 'advance', status: 'pending' },
        { status: 'failed', failReason: expiredMsg }
      );
      logger.info(`Stale custom order cleanup: reset ${staleAdvance.length} stale advance payments`);
    }
  } catch (err) {
    logger.error(`Stale custom order (advance) cleanup failed: ${err.message}`);
  }

  // Custom Orders - final payment
  try {
    const staleFinal = await CustomOrder.find({
      'finalPayment.status': 'pending',
      status: 'shipped',
      createdAt: { $lt: cutoff },
    }).select('_id').lean();

    if (staleFinal.length > 0) {
      const ids = staleFinal.map((o) => o._id);
      await CustomOrder.updateMany(
        { _id: { $in: ids } },
        { 'finalPayment.status': 'failed', 'finalPayment.failReason': expiredMsg }
      );
      await Transaction.updateMany(
        { order: { $in: ids }, orderType: 'CustomOrder', phase: 'final', status: 'pending' },
        { status: 'failed', failReason: expiredMsg }
      );
      logger.info(`Stale custom order cleanup: reset ${staleFinal.length} stale final payments`);
    }
  } catch (err) {
    logger.error(`Stale custom order (final) cleanup failed: ${err.message}`);
  }
}

module.exports = { cleanupStaleOrders };
