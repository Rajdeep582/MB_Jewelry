const mongoose = require('mongoose');

/**
 * Lead — footer "Stay Connected" newsletter email (Admin → Leads also lists every
 * customer account directly from the users collection).
 * One document per email (unique, lowercase). `note` holds the admin's reminder for that
 * email — for a customer account a note-only document is created (sources stays empty).
 */
const leadSchema = new mongoose.Schema(
  {
    email:   { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name:    { type: String, trim: true, maxlength: 100 },
    sources: [{ type: String, enum: ['newsletter'] }],
    note:    { type: String, trim: true, maxlength: 500, default: '' }, // admin's private reminder
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ sources: 1 });

module.exports = mongoose.model('Lead', leadSchema);
