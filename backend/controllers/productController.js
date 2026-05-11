const Product = require('../models/Product');
const GlobalPricing = require('../models/GlobalPricing');
const Review = require('../models/Review');
const cloudinary = require('../config/cloudinary');
const { calcDynamicPrice, buildGlobalPricingMap, applyLivePrice, resolvePricingEntry } = require('../utils/pricingUtils');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const invalidProductId = (res) => res.status(400).json({ success: false, message: 'Invalid product ID' });

// Helper: build public-facing image URL (Cloudinary or local disk)
const buildImageUrl = (file, folder = 'products') => {
  if (file.path?.startsWith('http')) {
    return { url: file.path, publicId: file.filename };
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    url: `${backendUrl}/uploads/${folder}/${file.filename}`,
    publicId: file.filename,
  };
};

// Helper: build query filter object from request query params
function buildProductQuery(params) {
  const { search, category, material, purity, minPrice, maxPrice, featured } = params;
  const query = {};

  if (search) query.$text = { $search: String(search) };
  if (category) query.category = String(category);
  if (material) query.material = String(material);
  if (featured === 'true') query.isFeatured = true;

  if (purity) {
    const purities = String(purity).split(',').map((p) => String(p).trim());
    query.purity = { $in: purities };
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  return query;
}

// Helper: resolve sort option from query param
function buildSortOption(sort) {
  const sortMap = {
    'price-asc':  { price: 1 },
    'price-desc': { price: -1 },
    'popular':    { sold: -1 },
    'rating':     { averageRating: -1 },
  };
  return sortMap[sort] || { createdAt: -1 };
}

// @desc    Get all products with filters, sort, pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  const { sort, page = 1, limit = 12 } = req.query;

  const query = buildProductQuery(req.query);
  const sortOption = buildSortOption(sort);

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total, pricingEntries] = await Promise.all([
    Product.find(query)
      .populate('category', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query),
    GlobalPricing.find({}).lean(),
  ]);

  const pricingMap = buildGlobalPricingMap(pricingEntries);
  const enriched = products.map((p) => applyLivePrice(p, pricingMap));

  res.json({
    success: true,
    products: enriched,
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
  if (!mongoose.isValidObjectId(req.params.id)) return invalidProductId(res);
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug');

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const [ratings, pricingEntries] = await Promise.all([
    Review.find({ product: product._id }).populate('user', 'name avatar').sort('-createdAt'),
    GlobalPricing.find({}).lean(),
  ]);

  const pricingMap = buildGlobalPricingMap(pricingEntries);
  const productObj = applyLivePrice(product.toJSON(), pricingMap);
  productObj.ratings = ratings;

  res.json({ success: true, product: productObj });
};

// Helper: resolve dynamic price from GlobalPricing with gram/kg unit fallback.
// Accepts optional per-product makingCharges and gst; falls back to global defaults.
async function resolvePrice(material, purity, unit, weightValue, makingCharges, gst) {
  const wv = Number(weightValue);
  if (!wv || wv <= 0) {
    return { price: null, error: 'Weight value must be a positive number' };
  }

  const pricingEntries = await GlobalPricing.find({
    material: String(material),
    purity: String(purity),
  }).lean();

  if (pricingEntries.length === 0) {
    return {
      price: null,
      error: `No global pricing set for ${material} / ${purity}. Set it in Pricing & Discounts first.`,
    };
  }

  const miniMap = {};
  for (const entry of pricingEntries) {
    miniMap[`${entry.material}|${entry.purity}|${entry.unit}`] = entry;
  }
  const { pricing, effectiveWeight } = resolvePricingEntry(miniMap, String(material), String(purity), String(unit), wv);

  if (!pricing) {
    return {
      price: null,
      error: `No global pricing set for ${material} / ${purity} / ${unit}. Set it in Pricing & Discounts first.`,
    };
  }

  const mc = makingCharges != null ? Number(makingCharges) : pricing.makingCharges;
  const g = gst != null ? Number(gst) : pricing.gst;

  return { price: calcDynamicPrice(effectiveWeight, pricing.livePrice, mc, g), error: null };
}

// Helper: recalculate price if pricing-critical fields changed
async function recalcPriceIfNeeded(product, updates) {
  const pricingChanged = updates.weightValue !== undefined ||
    updates.material !== undefined ||
    updates.purity !== undefined ||
    updates.unit !== undefined;
  if (!pricingChanged) return null;

  const wv = updates.weightValue ?? product.weightValue;
  if (!wv || wv <= 0) return null;

  const mat = updates.material ?? product.material;
  const pur = updates.purity ?? product.purity;
  const u = updates.unit ?? product.unit;
  const mc = updates.makingCharges ?? product.makingCharges ?? 12;
  const g = updates.gst ?? product.gst ?? 3;
  return resolvePrice(mat, pur, u, wv, mc, g);
}

// Helper: apply image updates to the updates object
async function applyImageUpdates(product, updates, req) {
  if (!req.files || req.files.length === 0) return;
  const newImages = req.files.map((file) => buildImageUrl(file, 'products'));
  if (req.body.replaceImages === 'true') {
    for (const img of product.images) {
      if (img.publicId) {
        try { await cloudinary.uploader.destroy(img.publicId); } catch (err) { logger.warn(`Cloudinary delete failed: ${err.message}`); }
      }
    }
    updates.images = newImages;
  } else {
    updates.images = [...product.images, ...newImages];
  }
}

// @desc    Create product
// @route   POST /api/products
// @access  Admin
const createProduct = async (req, res) => {
  const { name, description, category, material, stock, isFeatured, tags, purity, weightValue, unit, makingCharges, gst } = req.body;

  if (!purity) {
    return res.status(400).json({ success: false, message: 'Purity is required' });
  }

  const images = req.files && req.files.length > 0
    ? req.files.map((file) => buildImageUrl(file, 'products'))
    : [];

  const finalUnit = unit || 'gram';
  const mc = makingCharges != null ? Number(makingCharges) : 12;
  const g = gst != null ? Number(gst) : 3;

  const { price: resolvedPrice, error: priceError } = await resolvePrice(
    material, purity, finalUnit, weightValue, mc, g
  );

  if (priceError) {
    return res.status(400).json({ success: false, message: priceError });
  }

  const product = await Product.create({
    name, description,
    price: resolvedPrice,
    discountedPrice: null,
    category, material,
    stock: Number(stock),
    isFeatured: isFeatured === 'true' || isFeatured === true,
    tags: tags ? JSON.parse(tags) : [],
    purity: String(purity),
    pricingType: 'dynamic',
    weightValue: Number(weightValue),
    unit: finalUnit,
    makingCharges: mc,
    gst: g,
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
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.category !== undefined) updates.category = body.category;
  if (body.material !== undefined) updates.material = body.material;
  if (body.purity !== undefined) updates.purity = body.purity;
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured === 'true' || body.isFeatured === true;
  if (body.weightValue !== undefined) updates.weightValue = body.weightValue ? Number(body.weightValue) : null;
  if (body.unit !== undefined) updates.unit = body.unit;
  if (body.makingCharges !== undefined) updates.makingCharges = Number(body.makingCharges);
  if (body.gst !== undefined) updates.gst = Number(body.gst);
  if (body.tags !== undefined) {
    updates.tags = typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;
  }
  return updates;
}

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidProductId(res);
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const updates = parseProductUpdates(req.body);

  const priceResult = await recalcPriceIfNeeded(product, updates);
  if (priceResult?.error) {
    return res.status(400).json({ success: false, message: priceResult.error });
  }
  if (priceResult?.price != null) {
    updates.price = priceResult.price;
    updates.pricingType = 'dynamic';
    updates.discountedPrice = null;
  }

  await applyImageUpdates(product, updates, req);

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
  if (!mongoose.isValidObjectId(req.params.id)) return invalidProductId(res);
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  for (const img of product.images) {
    if (img.publicId) {
      try { await cloudinary.uploader.destroy(img.publicId); } catch (err) { logger.warn(`Cloudinary delete failed: ${err.message}`); }
    }
  }

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted successfully' });
};

// @desc    Add/Update rating for a product
// @route   POST /api/products/:id/review
// @access  Private
const addReview = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidProductId(res);
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

  const Order = require('../models/Order');
  const verifiedOrder = await Order.findOne({
    user: req.user._id,
    orderStatus: 'delivered',
    'payment.status': 'paid',
    'items.product': product._id,
  });
  const isVerifiedPurchase = !!verifiedOrder;

  if (!isVerifiedPurchase) {
    return res.status(403).json({
      success: false,
      message: 'Only verified purchasers can leave a review',
    });
  }

  await Review.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    { rating: Number(rating), comment: comment.trim(), title: title?.trim() || '', isVerifiedPurchase },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

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
