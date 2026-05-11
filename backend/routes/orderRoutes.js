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

// Payment flow (3-phase) — users only
router.post('/create-payment',   protect, userOnly, createPayment);
router.post('/verify-payment',   protect, userOnly, verifyPayment);
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
