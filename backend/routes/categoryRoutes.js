/**
 * Category Routes — /api/categories
 *
 * GET    /        — list all categories (public)
 * GET    /:id     — get category by ID (public)
 * POST   /        — create category with optional image (protect + adminOnly, uploadCategoryImage)
 * PUT    /:id     — update category with optional image (protect + adminOnly, uploadCategoryImage)
 * DELETE /:id     — delete category (protect + adminOnly)
 */
const express = require('express');
const router = express.Router();
const {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory,
} = require('../controllers/categoryController');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadCategoryImage } = require('../middleware/upload');

router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', protect, adminOnly, uploadCategoryImage, createCategory);
router.put('/:id', protect, adminOnly, uploadCategoryImage, updateCategory);
router.delete('/:id', protect, adminOnly, deleteCategory);

module.exports = router;
