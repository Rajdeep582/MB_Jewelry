/**
 * Custom Order Routes — /api/custom-orders
 *
 * User Routes (protect + userOnly):
 *   POST /                   — submit new custom order with reference images (uploadCustomOrderImages)
 *   GET  /my-orders          — list user's own custom orders
 *   POST /create-payment     — create Razorpay order for advance or final payment phase
 *   POST /verify-payment     — verify Razorpay payment after user checkout
 *   POST /fail-payment       — mark a payment phase as failed (called on Razorpay modal dismiss)
 *   PUT  /:id/cancel         — user cancels their own order (allowed in pending/quoted states only)
 *
 * Admin Routes (protect + adminOnly):
 *   GET  /stats              — aggregate stats for all custom orders
 *   GET  /                   — list all custom orders with filters
 *   PUT  /:id/quote          — admin sets quote amount, advances status to 'quoted'
 *   PUT  /:id/status         — admin advances order through lifecycle states
 *
 * Shared (protect, owner or admin):
 *   GET  /:id                — get single custom order (ownership enforced inside controller)
 *
 * Payment lifecycle:
 *   Advance phase: status=quoted → user pays 70% → status=advance_paid
 *   Final phase:   status=shipped → user pays 30% → status=delivered
 *   Both phases route through create-payment → verify-payment (same endpoints, `phase` param distinguishes).
 */
const express = require('express');
const router  = express.Router();

const {
  createCustomOrder,
  getMyCustomOrders,
  getCustomOrder,
  cancelCustomOrderUser,
  createCustomPayment,
  verifyCustomPayment,
  failCustomPayment,
  getAllCustomOrders,
  setQuote,
  updateCustomOrderStatus,
  getCustomOrderStats,
} = require('../controllers/customOrderController');

const { protect, adminOnly, userOnly } = require('../middleware/auth');
const { uploadCustomOrderImages }      = require('../middleware/upload');

// ── User Routes ───────────────────────────────────────────────────────────────
router.post('/', protect, userOnly, uploadCustomOrderImages, createCustomOrder);
router.get('/my-orders',       protect, userOnly, getMyCustomOrders);
router.post('/create-payment', protect, userOnly, createCustomPayment);
router.post('/verify-payment', protect, userOnly, verifyCustomPayment);
router.post('/fail-payment',   protect, userOnly, failCustomPayment);
router.put('/:id/cancel',      protect, userOnly, cancelCustomOrderUser);

// ── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/stats', protect, adminOnly, getCustomOrderStats);
router.get('/',      protect, adminOnly, getAllCustomOrders);
router.put('/:id/quote',  protect, adminOnly, setQuote);
router.put('/:id/status', protect, adminOnly, updateCustomOrderStatus);

// ── Shared (owner or admin) ───────────────────────────────────────────────────
router.get('/:id', protect, getCustomOrder);

module.exports = router;
