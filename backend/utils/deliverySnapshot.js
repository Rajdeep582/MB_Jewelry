/**
 * deliverySnapshot.js
 * Upserts a Delivery record when an order is shipped or delivered.
 * Call this from updateOrderStatus and updateCustomOrderStatus controllers.
 */
const Delivery = require('../models/Delivery');
const logger   = require('./logger');

/**
 * @param {Object} opts
 * @param {'order'|'custom_order'} opts.sourceType
 * @param {ObjectId|string} opts.sourceId       - Order / CustomOrder _id
 * @param {string} opts.orderId                 - human-readable id (ORD-XXXX / CUS-XXXX)
 * @param {string} opts.deliveryId              - UUID for MB-XXXXXX tracking
 * @param {string} opts.customerName
 * @param {string} opts.customerEmail
 * @param {Object} opts.shippingAddress
 * @param {string} opts.itemsSummary
 * @param {number} opts.totalAmount
 * @param {string} opts.status                  - 'shipped' | 'delivered'
 * @param {Date}   opts.dispatchedAt
 * @param {Date}   [opts.estimatedDelivery]
 * @param {Date}   [opts.deliveredAt]
 * @param {ObjectId|string} [opts.deliveryAgent]
 * @param {string} [opts.deliveredByPartnerId]
 * @param {Array}  opts.trackingHistory
 */
async function upsertDeliverySnapshot(opts) {
  try {
    const filter = { sourceId: opts.sourceId, sourceType: opts.sourceType };
    const update = {
      $set: {
        orderId:              opts.orderId              || '',
        deliveryId:           opts.deliveryId           || '',
        customerName:         opts.customerName         || '',
        customerEmail:        opts.customerEmail        || '',
        shippingAddress:      opts.shippingAddress      || {},
        itemsSummary:         opts.itemsSummary         || '',
        totalAmount:          opts.totalAmount          || 0,
        status:               opts.status,
        dispatchedAt:         opts.dispatchedAt         || null,
        estimatedDelivery:    opts.estimatedDelivery    || null,
        deliveredAt:          opts.deliveredAt          || null,
        deliveryAgent:        opts.deliveryAgent        || null,
        deliveredByPartnerId:   opts.deliveredByPartnerId   || '',
        deliveredByPartnerName: opts.deliveredByPartnerName || '',
        trackingHistory:      opts.trackingHistory      || [],
      },
    };
    await Delivery.findOneAndUpdate(filter, update, { upsert: true, new: true });
    logger.info(`Delivery snapshot upserted: ${opts.sourceType} ${opts.sourceId} → ${opts.status}`);
  } catch (err) {
    // Non-fatal — log but don't crash the main request
    logger.error(`deliverySnapshot upsert failed: ${err.message}`);
  }
}

module.exports = { upsertDeliverySnapshot };
