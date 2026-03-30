const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    type: {
      type: String,
      enum: ['payment', 'refund', 'chargeback'],
      default: 'payment',
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed }, // Store raw webhook hooks anonymously without explicit schema
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
