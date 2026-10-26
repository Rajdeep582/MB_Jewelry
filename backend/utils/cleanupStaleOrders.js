const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const Transaction = require('../models/Transaction');
const logger = require('./logger');
const { HOLD_MINUTES, failOrderAndReleaseStock } = require('./stockHold');
const { MAX_WAIT_MINUTES, checkRazorpayOrder, confirmFromRazorpay, ageMinutes } = require('./paymentReconcile');

const BATCH = 50; // max orders handled per run (each may need one Razorpay lookup)

/**
 * cleanupStaleOrders — resolves payments that were started but never confirmed.
 * Runs every 2 minutes (server.js).
 *
 * BEFORE failing anything it ASKS RAZORPAY (utils/paymentReconcile.js):
 *   captured            → confirm the order automatically (same path as a normal payment)
 *   authorized          → WE capture it (paymentCapture.js), then confirm
 *   in progress / capture not possible yet / Razorpay unreachable
 *                       → keep waiting (stock stays held) up to MAX_WAIT_MINUTES, then fail
 *                         (a payment that still lands later is recovered by the 6-hourly sweep)
 *   no payment / failed → fail; shop orders return their held stock
 *
 * COVERS:
 *   - Shop orders: payment pending for longer than the HOLD_MINUTES stock hold
 *   - Custom-order advance (status 'quoted') and final (status 'shipped') payments idle > maxAgeMinutes
 *
 * Each section has its own try/catch so one failure never blocks the others.
 * @param {number} maxAgeMinutes — idle threshold for custom-order payments (default 30)
 */
async function cleanupStaleOrders(maxAgeMinutes = 30) {
  await cleanupShopOrders();
  await cleanupCustomPhase('advance', 'quoted', maxAgeMinutes);
  await cleanupCustomPhase('final', 'shipped', maxAgeMinutes);
}

// ─── Shop orders ───────────────────────────────────────────────────────────────
async function cleanupShopOrders() {
  try {
    const holdCutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
    const stale = await Order.find({
      'payment.status': 'pending',
      orderStatus: { $nin: ['failed', 'delivered'] },
      createdAt: { $lt: holdCutoff },
    }).select('_id createdAt payment.razorpayOrderId').sort({ createdAt: 1 }).limit(BATCH).lean();

    const tally = { recovered: 0, waiting: 0, failed: 0, released: 0 };
    for (const o of stale) {
      try {
        const rzpId = o.payment?.razorpayOrderId;
        const check = await checkRazorpayOrder(rzpId);

        if (check.state === 'captured' || check.state === 'authorized') {
          // authorized → captured by us first (paymentCapture.js)
          const ok = await confirmFromRazorpay({ orderType: 'Order', orderId: o._id, razorpayOrderId: rzpId, paymentId: check.paymentId });
          if (ok) {
            tally.recovered += 1;
            logger.warn(`Stale cleanup: order ${o._id} was PAID on Razorpay (${check.paymentId}) — confirmed automatically`);
            continue;
          }
          if (check.state === 'captured') continue; // money taken but not confirmable → never fail it (admin alerted)
        }

        const age = ageMinutes(o.createdAt);
        if (['pending', 'authorized', 'unreachable'].includes(check.state) && age < MAX_WAIT_MINUTES) {
          tally.waiting += 1; // keep the hold, look again next run
          continue;
        }

        const reason = check.state === 'authorized'
          ? `Payment authorized but never captured on Razorpay (${check.paymentId}) — check auto-capture`
          : `Payment not completed within ${check.state === 'none' ? HOLD_MINUTES : MAX_WAIT_MINUTES} minutes`;
        const r = await failOrderAndReleaseStock(o._id, reason);
        if (r.failed) tally.failed += 1;
        if (r.released) tally.released += 1;
        await Transaction.updateMany({ order: o._id, orderType: 'Order', status: 'pending' }, { status: 'failed', failReason: reason });
        if (check.state === 'authorized') alertAuthorized('Order', o._id, check.paymentId);
      } catch (e) {
        logger.error(`Stale order ${o._id} cleanup failed: ${e.message}`);
      }
    }
    if (stale.length) {
      logger.info(`Stale order cleanup: recovered ${tally.recovered}, waiting ${tally.waiting}, failed ${tally.failed}, stock returned ${tally.released}`);
    }
  } catch (err) {
    logger.error(`Stale order cleanup failed: ${err.message}`);
  }
}

// ─── Custom orders (advance / final) ───────────────────────────────────────────
async function cleanupCustomPhase(phase, orderStatus, maxAgeMinutes) {
  const statusPath = `${phase}Payment.status`;
  const rzpPath = `${phase}Payment.razorpayOrderId`;
  try {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    // Only payments that were actually started (Razorpay order exists) and idle since cutoff
    const stale = await CustomOrder.find({
      [statusPath]: 'pending',
      [rzpPath]: { $exists: true, $nin: [null, ''] },
      status: orderStatus,
      updatedAt: { $lt: cutoff },
    }).select(`_id updatedAt ${rzpPath}`).limit(BATCH).lean();

    const expiredMsg = `Payment session expired after ${maxAgeMinutes} minutes`;
    let recovered = 0;
    let failed = 0;
    for (const o of stale) {
      try {
        // Every Razorpay order started for this phase (the customer may have opened checkout twice)
        const txs = await Transaction.find({ order: o._id, orderType: 'CustomOrder', phase, status: 'pending', razorpayOrderId: { $exists: true, $nin: [null, ''] } }).select('razorpayOrderId').lean();
        const ids = [...new Set([o[`${phase}Payment`]?.razorpayOrderId, ...txs.map((t) => t.razorpayOrderId)].filter(Boolean))];

        let waiting = false;
        let authorizedId = null;
        let confirmed = false;
        let captureStuck = false; // money captured but could not be confirmed → never reset the phase
        for (const rzpId of ids) {
          const check = await checkRazorpayOrder(rzpId);
          if (check.state === 'captured' || check.state === 'authorized') {
            // authorized → captured by us first (paymentCapture.js)
            confirmed = await confirmFromRazorpay({ orderType: 'CustomOrder', orderId: o._id, phase, razorpayOrderId: rzpId, paymentId: check.paymentId });
            if (confirmed) {
              recovered += 1;
              logger.warn(`Stale cleanup: custom order ${o._id} ${phase} was PAID on Razorpay (${check.paymentId}) — confirmed automatically`);
              break;
            }
            if (check.state === 'captured') { waiting = true; captureStuck = true; continue; }
          }
          if (check.state === 'authorized') authorizedId = check.paymentId;
          if (['pending', 'authorized', 'unreachable'].includes(check.state)) waiting = true;
        }
        if (confirmed || captureStuck) continue;
        if (waiting && ageMinutes(o.updatedAt) < MAX_WAIT_MINUTES) continue;

        const reason = authorizedId ? `Payment authorized but never captured on Razorpay (${authorizedId}) — check auto-capture` : expiredMsg;
        const res = await CustomOrder.updateOne(
          { _id: o._id, [statusPath]: 'pending' },
          { [statusPath]: 'failed', [`${phase}Payment.failReason`]: reason }
        );
        await Transaction.updateMany({ order: o._id, orderType: 'CustomOrder', phase, status: 'pending' }, { status: 'failed', failReason: reason });
        if (res.modifiedCount) failed += 1;
        if (authorizedId) alertAuthorized('CustomOrder', o._id, authorizedId);
      } catch (e) {
        logger.error(`Stale custom order ${o._id} (${phase}) cleanup failed: ${e.message}`);
      }
    }
    if (stale.length) logger.info(`Stale custom order cleanup (${phase}): recovered ${recovered}, reset ${failed}`);
  } catch (err) {
    logger.error(`Stale custom order (${phase}) cleanup failed: ${err.message}`);
  }
}

/** Authorized-but-not-captured money is auto-refunded by Razorpay after a few days — tell admins. */
function alertAuthorized(kind, id, paymentId) {
  const { sendAdminAlert } = require('./email');
  if (typeof sendAdminAlert !== 'function') return;
  sendAdminAlert(
    `Action needed: payment authorized but not captured (${paymentId})`,
    `<p>Razorpay shows payment <b>${paymentId}</b> for ${kind === 'CustomOrder' ? 'custom order' : 'order'} <b>${id}</b> as <b>authorized</b> but not captured, so the order could not be confirmed.</p>
     <p>Capture it in the Razorpay dashboard (it is then confirmed automatically within 6 hours), and turn on <b>automatic capture</b> in Razorpay settings. Uncaptured payments are refunded by Razorpay automatically after a few days.</p>`
  ).catch((e) => logger.error(`Admin alert email failed: ${e.message}`));
}

module.exports = { cleanupStaleOrders };
