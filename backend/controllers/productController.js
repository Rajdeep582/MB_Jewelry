const Product = require('../models/Product');
const Review = require('../models/Review');
const cloudinary = require('../config/cloudinary');

// @desc    Get all products with filters, sort, pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  const {
    search,
    category,
    material,
    type,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    limit = 12,
    featured,
  } = req.query;

  const query = {};

  // Search
  if (search) {
    query.$text = { $search: search };
  }

  // Filters
  if (category) query.category = category;
  if (material) query.material = material;
  if (type) query.type = type;
  if (featured === 'true') query.isFeatured = true;

  // Price range
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Sort
  let sortOption = { createdAt: -1 };
  if (sort === 'price-asc') sortOption = { price: 1 };
  else if (sort === 'price-desc') sortOption = { price: -1 };
  else if (sort === 'popular') sortOption = { sold: -1 };
  else if (sort === 'rating') sortOption = { averageRating: -1 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.json({
    success: true,
    products,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug');

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const ratings = await Review.find({ product: product._id })
    .populate('user', 'name avatar')
    .sort('-createdAt');

  const productObj = product.toJSON();
  productObj.ratings = ratings;

  res.json({ success: true, product: productObj });
};

// @desc    Create product
// @route   POST /api/products
// @access  Admin
const createProduct = async (req, res) => {
  const { name, description, price, discountedPrice, category, material, type, stock, isFeatured, tags, weight, sku } =
    req.body;

  const images = req.files
    ? req.files.map((file) => ({ url: file.path, publicId: file.filename }))
    : [];

  const product = await Product.create({
    name, description, price, discountedPrice, category, material, type,
    stock, isFeatured, tags: tags ? JSON.parse(tags) : [], weight, sku, images,
  });

  const populated = await product.populate('category', 'name slug');
  res.status(201).json({ success: true, product: populated });
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const updates = { ...req.body };
  if (updates.tags && typeof updates.tags === 'string') {
    updates.tags = JSON.parse(updates.tags);
  }

  // Handle new image uploads
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => ({ url: file.path, publicId: file.filename }));

    // Delete old images from Cloudinary if replacing all
    if (req.body.replaceImages === 'true') {
      for (const img of product.images) {
        if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
      }
      updates.images = newImages;
    } else {
      updates.images = [...product.images, ...newImages];
    }
  }

  const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate('category', 'name slug');

  res.json({ success: true, product: updated });
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Admin
const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Delete images from Cloudinary
  for (const img of product.images) {
    if (img.publicId) {
      try { await cloudinary.uploader.destroy(img.publicId); } catch (_) {}
    }
  }

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted successfully' });
};

// @desc    Add/Update rating for a product
// @route   POST /api/products/:id/review
// @access  Private
const addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  await Review.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    { rating, comment },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const allReviews = await Review.find({ product: product._id });
  product.numReviews = allReviews.length;
  product.averageRating = allReviews.length > 0 
    ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
    : 0;

  await product.save();

  res.json({ success: true, message: 'Review submitted', averageRating: product.averageRating });
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, addReview };
