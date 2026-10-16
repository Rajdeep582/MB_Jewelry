const mongoose = require('mongoose');

/**
 * Lead — footer "Stay Connected" newsletter email (Admin → Leads also lists every
 * customer account directly from the users collection).
 * One document per email (unique, lowercase).
 */
const leadSchema = new mongoose.Schema(
  {
    email:   { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name:    { type: String, trim: true, maxlength: 100 },
    sources: [{ type: String, enum: ['newsletter'] }],
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ sources: 1 });

module.exports = mongoose.model('Lead', leadSchema);
