const express = require('express');
const router  = express.Router();

const {
  createCustomOrder,
  getMyCustomOrders,
  getCustomOrder,
  createCustomPayment,
  verifyCustomPayment,
  failCustomPayment,
  getAllCustomOrders,
  setQuote,
  updateCustomOrderStatus,
  getCustomOrderStats,
} = require('../controllers/customOrderController');

const { protect, adminOnly }         = require('../middleware/auth');
const { uploadCustomOrderImages }    = require('../middleware/upload');

// ── User Routes ───────────────────────────────────────────────────────────────
router.post('/', protect, uploadCustomOrderImages, createCustomOrder);
router.get('/my-orders',   protect, getMyCustomOrders);
router.post('/create-payment', protect, createCustomPayment);
router.post('/verify-payment', protect, verifyCustomPayment);
router.post('/fail-payment',   protect, failCustomPayment);

// ── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/stats', protect, adminOnly, getCustomOrderStats);
router.get('/',      protect, adminOnly, getAllCustomOrders);
router.put('/:id/quote',  protect, adminOnly, setQuote);
router.put('/:id/status', protect, adminOnly, updateCustomOrderStatus);

// ── Shared (owner or admin) ───────────────────────────────────────────────────
router.get('/:id', protect, getCustomOrder);

module.exports = router;
