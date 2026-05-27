/**
 * Product Routes — /api/products
 *
 * Public:
 *   GET /public/gst-rates      — returns GST % per material/purity from GlobalPricing
 *                                (used by frontend to display tax-inclusive price breakdowns)
 *   GET /reviews/featured      — returns a curated set of top-rated verified-purchase reviews
 *   GET /                      — list products with filters, sort, pagination, live pricing applied
 *   GET /:id                   — get single product with live price applied
 *   POST /:id/review           — submit product review (protect, any authenticated role)
 *
 * Admin (protect + adminOnly):
 *   POST   /        — create product with images (uploadProductImages)
 *   PUT    /:id     — update product with optional image changes (uploadProductImages)
 *   DELETE /:id     — delete product and its Cloudinary images
 *
 * NOTE: /public/gst-rates and /reviews/featured are registered before /:id
 * to prevent Express treating "public" or "reviews" as a product ID.
 */
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
