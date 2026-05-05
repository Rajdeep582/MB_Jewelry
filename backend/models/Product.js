const mongoose = require('mongoose');
const crypto = require('node:crypto');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    material: {
      type: String,
      required: [true, 'Material is required'],
      enum: ['Gold', 'Silver', 'Diamond'],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sold: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },

    productId: { type: String, unique: true, sparse: true },

    // Purity — required for dynamic pricing; old products may not have this
    purity: {
      type: String,
      enum: ['22K', '18K', '14K', 'Normal', 'Hallmarked'],
    },

    // Dynamic pricing — all new products always use dynamic pricing
    pricingType: {
      type: String,
      enum: ['static', 'dynamic'],
      default: 'dynamic',
    },
    weightValue: {
      type: Number,
      min: [0, 'Weight value cannot be negative'],
    },
    unit: {
      type: String,
      enum: ['gram', 'kg'],
      default: 'gram',
    },

    // Per-product making charges and GST — override global defaults
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

productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ material: 1 });
productSchema.index({ purity: 1 });
productSchema.index({ isFeatured: 1 });

productSchema.index({ name: 'text', description: 'text', tags: 'text' });

productSchema.pre('save', function (next) {
  if (!this.productId) {
    this.productId = `PRD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
