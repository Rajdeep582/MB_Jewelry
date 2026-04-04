const express = require('express');
const router = express.Router();
const {
  createPayment,
  verifyPayment,
  failPayment,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  getStats,
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

// Payment flow (3-phase)
router.post('/create-payment', protect, createPayment);
router.post('/verify-payment', protect, verifyPayment);
router.post('/fail-payment', protect, failPayment);      // Called when user dismisses modal / payment fails

// User routes
router.get('/my-orders', protect, getMyOrders);
router.get('/stats', protect, adminOnly, getStats);

// Admin routes
router.get('/', protect, adminOnly, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

module.exports = router;
