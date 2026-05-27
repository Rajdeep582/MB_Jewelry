const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
}, { timestamps: true });

// TTL index: MongoDB auto-deletes carts with no activity for 90 days (7,776,000 s).
// `updatedAt` is refreshed on every cart save → only truly abandoned carts expire.
cartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('Cart', cartSchema);
