const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const logger = require('./logger');

/**
 * Mark orders stuck in payment.status=pending for longer than `maxAgeMinutes`
 * as cancelled/failed. This handles abandoned checkouts where the user never
 * opened the Razorpay modal or closed the browser before the SDK loaded.
 *
 * Safe to run repeatedly — guards against overwriting confirmed orders.
 *
 * @param {number} maxAgeMinutes  Orders older than this are cleaned up (default 30)
 */
async function cleanupStaleOrders(maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  try {
    // Find stale pending orders (not paid, not already cancelled, old enough)
    const staleOrders = await Order.find({
      'payment.status': 'pending',
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $lt: cutoff },
    }).select('_id payment.razorpayOrderId').lean();

    if (staleOrders.length === 0) return;

    const staleIds = staleOrders.map((o) => o._id);

    // Bulk-update the orders
    const orderResult = await Order.updateMany(
      { _id: { $in: staleIds } },
      {
        orderStatus: 'cancelled',
        'payment.status': 'failed',
        'payment.failReason': `Payment session expired after ${maxAgeMinutes} minutes`,
      }
    );

    // Bulk-update their pending transactions
    const txResult = await Transaction.updateMany(
      {
        order: { $in: staleIds },
        orderType: 'Order',
        status: 'pending',
      },
      {
        status: 'failed',
        failReason: `Payment session expired after ${maxAgeMinutes} minutes`,
      }
    );

    logger.info(
      `Stale order cleanup: cancelled ${orderResult.modifiedCount} orders, ` +
      `updated ${txResult.modifiedCount} transactions`
    );
  } catch (err) {
    // Never crash the server on cleanup failure
    logger.error(`Stale order cleanup failed: ${err.message}`);
  }
}

module.exports = { cleanupStaleOrders };
