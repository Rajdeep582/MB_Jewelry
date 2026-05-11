const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    // Source reference (nullable if source deleted)
    sourceType: { type: String, enum: ['order', 'custom_order'], required: true },
    sourceId:   { type: mongoose.Schema.Types.ObjectId, required: true }, // original _id

    // Human-readable IDs (snapshot — survives source deletion)
    orderId:    { type: String, default: '' },   // e.g. ORD-XXXX or CUS-XXXX
    deliveryId: { type: String, default: '' },   // MB-XXXXXXXX tracking code

    // Customer snapshot
    customerName:  { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    shippingAddress: { type: mongoose.Schema.Types.Mixed },

    // Items snapshot
    itemsSummary: { type: String, default: '' }, // e.g. "Gold Ring (22K)"
    totalAmount:  { type: Number, default: 0 },

    // Delivery state
    status:            { type: String, enum: ['shipped', 'delivered'], default: 'shipped' },
    dispatchedAt:      { type: Date },
    estimatedDelivery: { type: Date },
    deliveredAt:       { type: Date },

    // Delivery partner
    deliveryAgent:       { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' },
    deliveredByPartnerId:   { type: String, default: '' }, // e.g. "DP-D72BDD25"
    deliveredByPartnerName: { type: String, default: '' }, // e.g. "Zick Yeager"

    // Tracking history snapshot (copied from source at snapshot time)
    trackingHistory: { type: Array, default: [] },
  },
  { timestamps: true }
);

deliverySchema.index({ sourceId: 1, sourceType: 1 }, { unique: true });
deliverySchema.index({ status: 1 });
deliverySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Delivery', deliverySchema);
