const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');

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
  const image = req.file
    ? { url: req.file.path, publicId: req.file.filename }
    : { url: '', publicId: '' };

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
    // Delete old image
    if (category.image?.publicId) {
      try { await cloudinary.uploader.destroy(category.image.publicId); } catch (_) {}
    }
    updates.image = { url: req.file.path, publicId: req.file.filename };
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
    try { await cloudinary.uploader.destroy(category.image.publicId); } catch (_) {}
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
