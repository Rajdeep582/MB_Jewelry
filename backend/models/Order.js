const mongoose = require('mongoose');
const crypto = require('crypto');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const trackingStepSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  comment: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    payment: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      method: { type: String, default: 'razorpay' },      // razorpay | cod (extensible)
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      paidAt: { type: Date },
      failReason: { type: String, default: '' },           // audit: why payment failed
    },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    orderStatus: {
      type: String,
      enum: ['confirmed', 'in_production', 'ready_to_ship', 'shipped', 'delivered', 'returned_refunded', 'failed'],
      default: 'confirmed',
    },
    deliveredAt: { type: Date },
    dispatchedAt: { type: Date },                                         // set automatically when shipped
    estimatedDelivery: { type: Date },
    orderId: { type: String, unique: true, sparse: true },
    // System-generated UUID assigned at dispatch — immutable, collision-free, internal traceability ID
    // Separate from courier AWB (trackingNumber) — format displayed as MB-XXXXXXXX (last 8 chars)
    deliveryId: { type: String, unique: true, sparse: true },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    courierPartner: { type: String, default: '' },
    deliveryAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trackingHistory: [trackingStepSchema],
  },
  { timestamps: true }
);

// Indexes
orderSchema.index({ user: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });


// Auto-generate orderId
orderSchema.pre('save', function (next) {
  if (!this.orderId) {
    this.orderId = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
