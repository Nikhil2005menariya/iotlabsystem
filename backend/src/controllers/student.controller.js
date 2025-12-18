const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const crypto = require('crypto');
const { sendMail } = require('../services/mail.service');

/* ============================
   RAISE TRANSACTION
============================ */

exports.raiseTransaction = async (req, res) => {
  try {
    const {
      items,
      faculty_email,
      faculty_id,
      expected_return_date
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items selected' });
    }

    // Validate inventory
    for (const i of items) {
      const item = await Item.findById(i.item_id);
      if (!item || !item.is_active) {
        return res.status(400).json({ error: 'Invalid item selected' });
      }

      const usableQty =
        item.available_quantity - item.reserved_quantity;

      if (usableQty < i.quantity) {
        return res.status(400).json({
          error: `Insufficient quantity for ${item.name}`
        });
      }
    }

    const transactionId =
      'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const approvalToken = crypto.randomBytes(32).toString('hex');

    const transaction = await Transaction.create({
      transaction_id: transactionId,
      student_id: req.user.id,
      student_reg_no: req.user.reg_no, // optional fallback
      faculty_email,
      faculty_id,
      expected_return_date,
      items,
      faculty_approval: {
        approval_token: approvalToken
      }
    });

    // send approval email to faculty
    const approvalLink = `${process.env.FRONTEND_URL}/faculty/approve?token=${approvalToken}`;

    await sendMail({
      to: faculty_email,
      subject: 'IoT Lab Component Borrow Approval',
      html: `
        <p>A student has requested lab components.</p>
        <p>Transaction ID: <b>${transactionId}</b></p>
        <a href="${approvalLink}">
          Approve Request
        </a>
      `
    });

    res.status(201).json({
      success: true,
      transaction_id: transactionId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   STUDENT TRANSACTION HISTORY
============================ */

exports.getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      student_id: req.user.id
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   TRACK TRANSACTION
============================ */

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      transaction_id: req.params.transaction_id,
      student_id: req.user.id
    }).populate('items.item_id', 'name sku');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
