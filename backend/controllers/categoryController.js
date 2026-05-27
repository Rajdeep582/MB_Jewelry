const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const invalidId = (res) => res.status(400).json({ success: false, message: 'Invalid category ID' });

// Helper: build public-facing URL from an uploaded file (works for both Cloudinary and local disk)
const buildFileUrl = (file, folder = 'categories') => {
  if (!file) return { url: '', publicId: '' };
  if (file.path?.startsWith('http')) {
    return { url: file.path, publicId: file.filename };
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    url: `${backendUrl}/uploads/${folder}/${file.filename}`,
    publicId: file.filename,
  };
};

/**
 * getCategories
 * @route  GET /api/categories
 * @access Public
 *
 * Returns all active categories sorted alphabetically by name.
 * Only isActive=true categories are shown to the public.
 */
const getCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, categories });
};

/**
 * getCategory
 * @route  GET /api/categories/:id
 * @access Public
 *
 * Returns a single category by ID. Returns regardless of isActive status
 * (admin may need to view inactive categories too).
 */
const getCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, category });
};

/**
 * createCategory
 * @route  POST /api/categories
 * @access Admin
 *
 * Creates a new category. Optionally accepts an image upload via multipart.
 * Image URL is built via buildFileUrl — supports both Cloudinary (http URL)
 * and local disk (constructs URL from BACKEND_URL + /uploads/categories/).
 */
const createCategory = async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? buildFileUrl(req.file, 'categories') : { url: '', publicId: '' };
  const category = await Category.create({ name, description, image });
  res.status(201).json({ success: true, category });
};

/**
 * updateCategory
 * @route  PUT /api/categories/:id
 * @access Admin
 *
 * Updates a category's fields. If a new image is uploaded:
 *   1. Deletes the old image from Cloudinary (if it has a publicId)
 *   2. Replaces image with new buildFileUrl result
 * Non-image fields are spread from req.body into the update.
 */
const updateCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const updates = { ...req.body };

  if (req.file) {
    if (category.image?.publicId) {
      try { await cloudinary.uploader.destroy(category.image.publicId); } catch (err) { logger.warn(`Cloudinary delete failed: ${err.message}`); }
    }
    updates.image = buildFileUrl(req.file, 'categories');
  }

  const updated = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });

  res.json({ success: true, category: updated });
};

/**
 * deleteCategory
 * @route  DELETE /api/categories/:id
 * @access Admin
 *
 * Hard-deletes a category and its Cloudinary image (if present).
 * NOTE: does not cascade-delete products in this category.
 * Products will retain their category reference (dangling ref) — handle upstream.
 */
const deleteCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  if (category.image?.publicId) {
    try { await cloudinary.uploader.destroy(category.image.publicId); } catch (err) { logger.warn(`Cloudinary delete failed: ${err.message}`); }
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
