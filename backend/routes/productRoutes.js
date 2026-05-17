const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, addReview, getFeaturedReviews,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadProductImages } = require('../middleware/upload');
const GlobalPricing = require('../models/GlobalPricing');

// Public: returns GST rates per material/purity (no sensitive pricing data)
router.get('/public/gst-rates', async (req, res) => {
  try {
    const pricing = await GlobalPricing.find({}).select('material purity gst').lean();
    res.json({ success: true, rates: pricing });
  } catch {
    res.json({ success: true, rates: [] });
  }
});

router.get('/reviews/featured', getFeaturedReviews);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', protect, adminOnly, uploadProductImages, createProduct);
router.put('/:id', protect, adminOnly, uploadProductImages, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);
router.post('/:id/review', protect, addReview);

module.exports = router;
