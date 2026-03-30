const Order = require('../models/Order');
const Product = require('../models/Product');
const razorpay = require('../config/razorpay');
const { verifyRazorpaySignature } = require('../utils/razorpayHelper');

// @desc    Create Razorpay order
// @route   POST /api/orders/create-payment
// @access  Private
const createPayment = async (req, res) => {
  const { items, shippingAddress } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  // Calculate total from DB prices (trust server, not client)
  let itemsPrice = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
    }

    const price = product.discountedPrice || product.price;
    itemsPrice += price * item.quantity;
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url || '',
      price,
      quantity: item.quantity,
    });
  }

  const shippingPrice = itemsPrice > 999 ? 0 : 99;
  const taxPrice = Math.round(itemsPrice * 0.03 * 100) / 100; // 3% GST
  const totalAmount = itemsPrice + shippingPrice + taxPrice;

  // Create Razorpay order (amount in paise)
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100),
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
    notes: { userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    orderItems,
    shippingAddress,
    pricing: { itemsPrice, shippingPrice, taxPrice, totalAmount },
  });
};

// @desc    Verify payment & create order
// @route   POST /api/orders/verify-payment
// @access  Private
const verifyPayment = async (req, res) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    orderItems,
    shippingAddress,
    pricing,
  } = req.body;

  // Verify HMAC signature
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Reduce stock
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity, sold: item.quantity },
    });
  }

  // Create order in DB
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    payment: {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: 'paid',
      paidAt: new Date(),
    },
    itemsPrice: pricing.itemsPrice,
    shippingPrice: pricing.shippingPrice,
    taxPrice: pricing.taxPrice,
    totalAmount: pricing.totalAmount,
    orderStatus: 'confirmed',
  });

  res.status(201).json({ success: true, message: 'Order placed successfully', order });
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'name images price');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Only allow owner or admin
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, order });
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = status ? { orderStatus: status } : {};

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Order.countDocuments(query),
  ]);

  res.json({ success: true, orders, total, pages: Math.ceil(total / limit) });
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res) => {
  const { status, trackingNumber } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  order.orderStatus = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (status === 'delivered') order.deliveredAt = new Date();

  await order.save();
  res.json({ success: true, order });
};

// @desc    Admin stats
// @route   GET /api/orders/stats
// @access  Admin
const getStats = async (req, res) => {
  const [totalOrders, totalRevenue, statusCounts] = await Promise.all([
    Order.countDocuments({ 'payment.status': 'paid' }),
    Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    },
  });
};

module.exports = { createPayment, verifyPayment, getMyOrders, getOrder, getAllOrders, updateOrderStatus, getStats };
