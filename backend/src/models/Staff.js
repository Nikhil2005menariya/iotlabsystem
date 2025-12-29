const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ['admin', 'incharge'],
      required: true
    },

    is_active: {
      type: Boolean,
      default: true
    },

    /* ===== PASSWORD RESET (already exists) ===== */
    reset_otp: {
      type: String,
      select: false
    },
    reset_otp_expiry: {
      type: Date,
      select: false
    },

    /* ===== EMAIL CHANGE (ADD THESE) ===== */
    pending_email: {
      type: String,
      lowercase: true
    },
    email_otp: {
      type: String,
      select: false
    },
    email_otp_expiry: {
      type: Date,
      select: false
    },

    last_login: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
