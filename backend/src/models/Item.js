const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    category: String,
    vendor: String,
    location: String,
    description: String,

    initial_quantity: {
      type: Number,
      required: true
    },

    available_quantity: {
      type: Number,
      required: true
    },

    reserved_quantity: {
      type: Number,
      default: 0
    },

    damaged_quantity: {
      type: Number,
      default: 0
    },

    min_threshold_quantity: {
      type: Number,
      default: 5
    },

    is_active: {
      type: Boolean,
      default: true
    },
    tracking_type: {
      type: String,
      enum: ['bulk', 'asset'],
      required: true,
      default: 'bulk'   // 🔑 VERY IMPORTANT for backward compatibility
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
