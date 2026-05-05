const mongoose = require('mongoose');

const globalPricingSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      enum: ['Gold', 'Silver', 'Diamond'],
    },
    purity: {
      type: String,
      required: true,
      enum: ['22K', '18K', '14K', 'Normal', 'Hallmarked'],
    },
    unit: {
      type: String,
      required: true,
      enum: ['gram', 'kg'],
      default: 'gram',
    },
    livePrice: {
      type: Number,
      required: [true, 'Live price is required'],
      min: [0, 'Live price cannot be negative'],
    },
    makingCharges: {
      type: Number,
      default: 12,
      min: [0, 'Making charges cannot be negative'],
    },
    gst: {
      type: Number,
      default: 3,
      min: [0, 'GST cannot be negative'],
    },
  },
  { timestamps: true }
);

// Each material/purity/unit combination is unique
globalPricingSchema.index({ material: 1, purity: 1, unit: 1 }, { unique: true });

module.exports = mongoose.model('GlobalPricing', globalPricingSchema);
