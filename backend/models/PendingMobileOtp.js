const mongoose = require('mongoose');

// Stores pending mobile OTP before account creation.
// TTL index auto-deletes docs after 10 minutes.
const pendingMobileOtpSchema = new mongoose.Schema({
  mobile:      { type: String, required: true, index: true },
  otpHash:     { type: String, required: true },
  attempts:    { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now, expires: 600 }, // 10 min TTL
});

module.exports = mongoose.model('PendingMobileOtp', pendingMobileOtpSchema);
