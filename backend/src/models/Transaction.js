const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },

    /* =====================
       BULK TRACKING
    ===================== */
    quantity: {
      type: Number,
      default: 0
    },

    /* =====================
       ASSET TRACKING
    ===================== */
    asset_tags: {
      type: [String],   // e.g. ["UNO-0001", "UNO-0002"]
      default: []
    },

    /* =====================
       SYSTEM MANAGED
    ===================== */
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
      enum: [
        'raised',
        'approved',
        'active',
        'completed',
        'overdue',
        'rejected'
      ],
      default: 'raised',
      index: true
    },

    /* =====================
       STUDENT INFO
    ===================== */
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

    /* =====================
       FACULTY INFO
    ===================== */
    faculty_email: {
      type: String,
      required: true
    },

    faculty_id: String,

    /* =====================
       TRANSACTION ITEMS
    ===================== */
    items: [transactionItemSchema],

    /* =====================
       FACULTY APPROVAL
    ===================== */
    faculty_approval: {
      approved: {
        type: Boolean,
        default: false
      },
      approved_at: Date,
      approval_token: String
    },

    /* =====================
       ISSUE DETAILS
    ===================== */
    issued_by_incharge_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },

    issued_at: Date,

    /* =====================
       RETURN DETAILS
    ===================== */
    expected_return_date: {
      type: Date,
      required: true,
      index: true
    },

    actual_return_date: Date,

    damage_notes: String,

    /* =====================
       OVERDUE CONTROL
    ===================== */
    overdue_notified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
