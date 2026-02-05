const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    bill_type: {
      type: String,
      enum: ['electricity', 'internet', 'maintenance', 'equipment', 'other'],
      default: 'other',
      index: true
    },

    bill_date: {
      type: Date,
      required: true,
      index: true
    },

    file_name: {
      type: String,
      required: true
    },

    file_path: {
      type: String,
      required: true
    },

    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
