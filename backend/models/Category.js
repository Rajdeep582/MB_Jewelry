const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * pre('save') hook — auto-generates URL-safe slug from name whenever name changes.
 * Rules: lowercase → spaces to hyphens → strip non-alphanumeric (keep hyphens).
 * e.g. "Gold Coin" → "gold-coin"
 * DELIBERATELY DOES NOT run if name unchanged (prevents unnecessary slug mutation on unrelated saves).
 */
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^a-z0-9-]/g, '');
  }
  next();
});


categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
