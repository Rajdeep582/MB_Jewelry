const mongoose = require('mongoose');
const crypto = require('crypto');

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
      enum: ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Brooch', 'Set'],
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
    weight: { type: String, default: '' }, // e.g. "12.5g"
    sku: { type: String, unique: true, sparse: true },
    
    // Jewelry Production Business standards
    purity: { 
      type: String, 
      enum: ['24K', '22K', 'None'],
      default: 'None' 
    },
    isHallmarked: { 
      type: Boolean, 
      default: false 
    },
    productId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Indexes for performance
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ material: 1 });
productSchema.index({ type: 1 });
productSchema.index({ purity: 1 });
productSchema.index({ isHallmarked: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ productId: 1 }, { sparse: true, unique: true });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Auto-generate productId
productSchema.pre('save', function (next) {
  if (!this.productId) {
    this.productId = `PRD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
