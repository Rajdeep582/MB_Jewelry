const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // The confirmed order (null until payment verified)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Razorpay identifiers
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },

    type: {
      type: String,
      enum: ['payment', 'refund', 'chargeback'],
      default: 'payment',
    },
    amount: { type: Number, required: true },        // in INR (not paise)
    currency: { type: String, default: 'INR' },

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

module.exports = mongoose.model('Transaction', transactionSchema);
