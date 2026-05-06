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
const { protect, adminOnly } = require('../middleware/auth');

// Payment flow (3-phase)
router.post('/create-payment', protect, createPayment);
router.post('/verify-payment', protect, verifyPayment);
router.post('/fail-payment', protect, failPayment);       // Called when user dismisses modal / payment fails

// Recovery: re-check Razorpay API and confirm order if payment was actually captured
router.post('/:id/retry-verify', protect, retryVerifyPayment);

// User routes
router.get('/my-orders', protect, getMyOrders);

// Admin routes — static paths MUST come before /:id param route
router.get('/stats',          protect, adminOnly, getStats);
router.get('/delivery-stats', protect, adminOnly, getDeliveryStats);
router.get('/',               protect, adminOnly, getAllOrders);
router.get('/:id',            protect, getOrder);
router.put('/:id/status',     protect, adminOnly, updateOrderStatus);

module.exports = router;
