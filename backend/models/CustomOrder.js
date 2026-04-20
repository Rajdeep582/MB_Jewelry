const mongoose = require('mongoose');
const crypto = require('crypto');

// ─── Reuse the same tracking step shape as Order.js ──────────────────────────
const trackingStepSchema = new mongoose.Schema({
  status:    { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  comment:   { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

// ─── Reference image — same shape as Product.images ──────────────────────────
const referenceImageSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  publicId: { type: String, default: '' },
}, { _id: false });

// ─── Shipping address — same shape as Order.shippingAddress ──────────────────
const shippingAddressSchema = new mongoose.Schema({
  fullName:     { type: String, required: true },
  phone:        { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String, default: '' },
  city:         { type: String, required: true },
  state:        { type: String, required: true },
  pincode:      { type: String, required: true },
  country:      { type: String, default: 'India' },
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────
const customOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
    },

    // ── Design Specifications ─────────────────────────────────────────────────
    type: {
      type: String,
      required: [true, 'Jewelry type is required'],
      enum: ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle'],
    },
    material: {
      type: String,
      required: [true, 'Material is required'],
      enum: ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'],
    },
    purity: {
      type: String,
      enum: ['24K', '22K', 'None'],
      default: 'None',
    },
    description: {
      type: String,
      required: [true, 'Design description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      trim: true,
    },
    // Optional measurement fields (contextual on type)
    fingerSize:  { type: String, default: '' }, // e.g. "16", "US 7"
    neckSize:    { type: String, default: '' }, // e.g. "45cm"
    wristSize:   { type: String, default: '' }, // for bracelets/bangles
    weight:      { type: String, default: '' }, // estimated, e.g. "8–10g"
    budget:      { type: String, default: '' }, // user's stated budget range

    referenceImages: { type: [referenceImageSchema], default: [] },

    shippingAddress: { type: shippingAddressSchema, required: true },
    preferredDeliveryDate: { type: Date },

    // ── Admin Quote & Pricing ─────────────────────────────────────────────────
    quoteAmount:   { type: Number, default: null }, // Base price excl. GST
    taxAmount:     { type: Number, default: 0 },    // 18% GST
    totalAmount:   { type: Number, default: 0 },    // quoteAmount + taxAmount
    advanceAmount: { type: Number, default: 0 },    // 25% of totalAmount
    finalAmount:   { type: Number, default: 0 },    // 75% of totalAmount
    quotedAt:      { type: Date },
    quoteNote:     { type: String, default: '' }, // Visible to user
    adminNotes:    { type: String, default: '' }, // Internal only

    // ── Status Lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending',
        'quoted',
        'advance_paid',
        'in_production',
        'final_payment_pending',
        'final_payment_paid',
        'ready_to_ship',
        'shipped',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
    },

    // ── Payments (2 Phases) ───────────────────────────────────────────────────
    advancePayment: {
      razorpayOrderId:   { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      method:    { type: String, default: 'razorpay' },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      paidAt:    { type: Date },
      failReason: { type: String, default: '' },
    },
    
    finalPayment: {
      razorpayOrderId:   { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      method:    { type: String, default: 'razorpay' },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      paidAt:    { type: Date },
      failReason: { type: String, default: '' },
    },

    // ── Delivery / Tracking ───────────────────────────────────────────────────────────
    customOrderId: { type: String, unique: true, sparse: true },
    // System-generated UUID on dispatch — same contract as Order.deliveryId
    deliveryId:        { type: String, unique: true, sparse: true },
    dispatchedAt:      { type: Date },
    estimatedDelivery: { type: Date },
    // trackingNumber auto-set = deliveryId (internal courier — no external AWB)
    trackingNumber:    { type: String, default: '' },
    deliveredAt:       { type: Date },
    trackingHistory:   [trackingStepSchema],
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
customOrderSchema.index({ user:      1 });
customOrderSchema.index({ status:    1 });
customOrderSchema.index({ createdAt: -1 });
customOrderSchema.index({ 'advancePayment.status': 1 });
customOrderSchema.index({ 'finalPayment.status':   1 });
customOrderSchema.index({ customOrderId: 1 }, { sparse: true, unique: true });
customOrderSchema.index({ deliveryId: 1 }, { sparse: true, unique: true });

// Auto-generate customOrderId
customOrderSchema.pre('save', function (next) {
  if (!this.customOrderId) {
    this.customOrderId = `CUS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('CustomOrder', customOrderSchema);
