const express = require('express');
const router = express.Router();
const {
  createPayment, verifyPayment, getMyOrders, getOrder, getAllOrders, updateOrderStatus, getStats,
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/create-payment', protect, createPayment);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.get('/stats', protect, adminOnly, getStats);
router.get('/', protect, adminOnly, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

module.exports = router;
