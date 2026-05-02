const Product = require('../models/Product');
const Review = require('../models/Review');
const cloudinary = require('../config/cloudinary');


// Helper: build public-facing image URL (Cloudinary or local disk)
const buildImageUrl = (file, folder = 'products') => {
  if (file.path && file.path.startsWith('http')) {
    return { url: file.path, publicId: file.filename };
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    url: `${backendUrl}/uploads/${folder}/${file.filename}`,
    publicId: file.filename,
  };
};

// @desc    Get all products with filters, sort, pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  const {
    search,
    category,
    material,
    type,
    purity,
    isHallmarked,
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
    query.$text = { $search: String(search) };
  }

  // Filters
  if (category) query.category = String(category);
  if (material) query.material = String(material);
  if (type) query.type = String(type);
  if (featured === 'true') query.isFeatured = true;
  
  // Jewelry filters
  if (purity) {
    // Allows comma-separated purities (e.g., '22K,18K')
    const purities = String(purity).split(',').map((p) => String(p).trim());
    query.purity = { $in: purities };
  }
  if (isHallmarked === 'true') query.isHallmarked = true;

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
  const { name, description, price, discountedPrice, category, material, type,
    stock, isFeatured, tags, weight, sku, purity, isHallmarked } = req.body;

  const images = req.files && req.files.length > 0
    ? req.files.map((file) => buildImageUrl(file, 'products'))
    : [];

  // Normalize empty string fields
  const finalDiscountedPrice = discountedPrice && discountedPrice !== '' ? Number(discountedPrice) : null;

  const product = await Product.create({
    name, description,
    price: Number(price),
    discountedPrice: finalDiscountedPrice,
    category, material, type,
    stock: Number(stock),
    isFeatured: isFeatured === 'true' || isFeatured === true,
    tags: tags ? JSON.parse(tags) : [],
    weight: weight || '',
    sku: sku || undefined,
    purity: purity || 'None',
    isHallmarked: isHallmarked === 'true' || isHallmarked === true,
    images,
  });

  const populated = await product.populate('category', 'name slug');
  res.status(201).json({ success: true, product: populated });
};

// Helper to parse and typecast product updates
function parseProductUpdates(body) {
  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.price !== undefined) updates.price = Number(body.price);
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.category !== undefined) updates.category = body.category;
  if (body.material !== undefined) updates.material = body.material;
  if (body.type !== undefined) updates.type = body.type;
  if (body.weight !== undefined) updates.weight = body.weight;
  if (body.sku !== undefined) updates.sku = body.sku || undefined;
  if (body.purity !== undefined) updates.purity = body.purity;
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured === 'true' || body.isFeatured === true;
  if (body.isHallmarked !== undefined) updates.isHallmarked = body.isHallmarked === 'true' || body.isHallmarked === true;
  
  if (body.discountedPrice !== undefined) {
    updates.discountedPrice = (body.discountedPrice !== '' && body.discountedPrice !== null)
      ? Number(body.discountedPrice) : null;
  }
  if (body.tags !== undefined) {
    updates.tags = typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;
  }
  return updates;
}

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const updates = parseProductUpdates(req.body);

  // Handle new image uploads
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => buildImageUrl(file, 'products'));

    // Delete old images from Cloudinary if replacing all
    if (req.body.replaceImages === 'true') {
      for (const img of product.images) {
        if (img.publicId) {
          try { await cloudinary.uploader.destroy(img.publicId); } catch (err) { console.error('Cloudinary delete failed:', err.message); }
        }
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
      try { await cloudinary.uploader.destroy(img.publicId); } catch (err) { console.error('Cloudinary delete failed:', err.message); }
    }
  }

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted successfully' });
};

// @desc    Add/Update rating for a product
// @route   POST /api/products/:id/review
// @access  Private
const addReview = async (req, res) => {
  const { rating, comment, title } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }
  if (!comment || comment.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Review comment must be at least 10 characters' });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Check for verified purchase (has a delivered order with this product)
  const Order = require('../models/Order');
  const verifiedOrder = await Order.findOne({
    user: req.user._id,
    orderStatus: 'delivered',
    'payment.status': 'paid',
    'items.product': product._id,
  });
  const isVerifiedPurchase = !!verifiedOrder;

  await Review.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    { rating: Number(rating), comment: comment.trim(), title: title?.trim() || '', isVerifiedPurchase },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Recompute aggregate rating
  const allReviews = await Review.find({ product: product._id });
  product.numReviews = allReviews.length;
  product.averageRating =
    allReviews.length > 0
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
      : 0;

  await product.save();

  res.json({
    success: true,
    message: 'Review submitted',
    averageRating: product.averageRating,
    numReviews: product.numReviews,
    isVerifiedPurchase,
  });
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, addReview };
