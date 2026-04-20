const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // ── Order reference (polymorphic — works for both Order & CustomOrder) ──────
    order: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'orderType',   // dynamic ref — uses orderType field below
      default: null,
    },
    // Discriminator so populate() knows which collection to query
    orderType: {
      type: String,
      enum: ['Order', 'CustomOrder'],
      default: 'Order',
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Razorpay identifiers ──────────────────────────────────────────────────
    razorpayOrderId:   { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },

    // ── Transaction metadata ──────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['payment', 'refund', 'chargeback'],
      default: 'payment',
    },
    amount:   { type: Number, required: true },   // in INR (not paise)
    currency: { type: String, default: 'INR' },

    // For custom orders that have two phases (advance / final)
    phase: {
      type: String,
      enum: ['advance', 'final', null],
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },

    // Human-readable failure reason for audit log
    failReason: { type: String, default: '' },

    // Raw gateway response for debugging / dispute resolution
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Fast look-ups used by webhook handler & verify endpoints
transactionSchema.index({ razorpayOrderId: 1, status: 1 });
transactionSchema.index({ order: 1, orderType: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
