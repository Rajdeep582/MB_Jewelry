/**
 * Order Routes — /api/orders
 *
 * Payment Flow (3-phase, userOnly + paymentLimiter):
 *   POST /create-payment   — create Razorpay order; returns razorpayOrderId for frontend checkout
 *   POST /verify-payment   — verify Razorpay signature after payment; sets payment.status = 'paid'
 *   POST /fail-payment     — mark payment as failed (called on Razorpay modal dismiss / timeout)
 *   POST /:id/retry-verify — re-attempt verification for an existing unverified payment (userOnly)
 *
 * IMPORTANT: payment.status = 'paid' is ONLY set by verifyPayment (Razorpay signature verified).
 * The webhook handler (webhookRoutes.js) also sets it independently as a safety net.
 * No admin endpoint may set payment.status directly.
 *
 * User Routes (protect + userOnly):
 *   GET  /my-orders     — paginated list of the authenticated user's orders
 *
 * Admin Routes (protect + adminOnly):
 *   GET  /stats          — aggregate order stats
 *   GET  /delivery-stats — delivery-focused aggregate stats
 *   GET  /               — list all orders with filters
 *   PUT  /:id/status     — advance order lifecycle status (does NOT accept paymentStatus in body)
 *
 * Shared:
 *   GET  /:id            — get single order (ownership enforced inside controller for non-admins)
 *
 * NOTE: static paths (/stats, /delivery-stats, /my-orders) are registered BEFORE /:id
 * so Express doesn't treat "stats" as an order ID.
 */
const express = require('express');
const router = express.Router();
const {
  createPayment,
  verifyPayment,
  retryVerifyPayment,
  failPayment,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  getStats,
  getDeliveryStats,
} = require('../controllers/orderController');
const { protect, adminOnly, userOnly } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Payment flow (3-phase) — users only
router.post('/create-payment',   paymentLimiter, protect, userOnly, createPayment);
router.post('/verify-payment',   paymentLimiter, protect, userOnly, verifyPayment);
router.post('/fail-payment',     protect, userOnly, failPayment);

// Recovery — users only
router.post('/:id/retry-verify', protect, userOnly, retryVerifyPayment);

// User routes
router.get('/my-orders', protect, userOnly, getMyOrders);

// Admin routes — static paths MUST come before /:id param route
router.get('/stats',          protect, adminOnly, getStats);
router.get('/delivery-stats', protect, adminOnly, getDeliveryStats);
router.get('/',               protect, adminOnly, getAllOrders);
router.get('/:id',            protect, getOrder);
router.put('/:id/status',     protect, adminOnly, updateOrderStatus);

module.exports = router;
