const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },

    quantity: {
      type: Number,
      required: true
    },

    issued_quantity: {
      type: Number,
      default: 0
    },

    returned_quantity: {
      type: Number,
      default: 0
    },

    damaged_quantity: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ['raised', 'approved', 'active', 'completed', 'overdue', 'rejected'],
      default: 'raised',
      index: true
    },

    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },

    student_reg_no: {
      type: String,
      required: true,
      index: true
    },

    faculty_email: {
      type: String,
      required: true
    },

    faculty_id: String,

    items: [transactionItemSchema],

    faculty_approval: {
      approved: { type: Boolean, default: false },
      approved_at: Date,
      approval_token: String
    },

    issued_by_incharge_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },

    issued_at: Date,

    expected_return_date: {
      type: Date,
      required: true,
      index: true
    },

    actual_return_date: Date,

    damage_notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
