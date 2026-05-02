const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');

// Helper: build public-facing URL from an uploaded file (works for both Cloudinary and local disk)
const buildFileUrl = (file, folder = 'categories') => {
  if (!file) return { url: '', publicId: '' };
  // Cloudinary sets file.path to the HTTPS CDN URL
  if (file.path?.startsWith('http')) {
    return { url: file.path, publicId: file.filename };
  }
  // Local disk storage: file.path is an absolute OS path — build a proper HTTP URL
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    url: `${backendUrl}/uploads/${folder}/${file.filename}`,
    publicId: file.filename,
  };
};

// @desc    Get all active categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, categories });
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
const getCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, category });
};

// @desc    Create category
// @route   POST /api/categories
// @access  Admin
const createCategory = async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? buildFileUrl(req.file, 'categories') : { url: '', publicId: '' };

  const category = await Category.create({ name, description, image });
  res.status(201).json({ success: true, category });
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Admin
const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const updates = { ...req.body };

  if (req.file) {
    // Delete old image from Cloudinary (no-op for local storage)
    if (category.image?.publicId) {
      try { await cloudinary.uploader.destroy(category.image.publicId); } catch (err) { console.error('Cloudinary delete failed:', err.message); }
    }
    updates.image = buildFileUrl(req.file, 'categories');
  }

  const updated = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });

  res.json({ success: true, category: updated });
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Admin
const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  if (category.image?.publicId) {
    try { await cloudinary.uploader.destroy(category.image.publicId); } catch (err) { console.error('Cloudinary delete failed:', err.message); }
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
