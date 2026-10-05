const mongoose = require('mongoose');

/**
 * Counter — named, atomically-incremented sequences (e.g. "invoice-26-27").
 * Used for gap-free, consecutive invoice numbers per financial year.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
