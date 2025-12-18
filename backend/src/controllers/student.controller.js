const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Student = require('../models/Student');
const crypto = require('crypto');
const { sendMail } = require('../services/mail.service');

/* ============================
   RAISE TRANSACTION
============================ */

exports.raiseTransaction = async (req, res) => {
  console.log('RAISE TRANSACTION HIT', req.user);

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

    /* ============================
       FETCH STUDENT (SOURCE OF TRUTH)
    ============================ */
    const student = await Student.findById(req.user.id);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    /* ============================
       VALIDATE INVENTORY
    ============================ */
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

    /* ============================
       GENERATE IDS
    ============================ */
    const transactionId =
      'TXN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const approvalToken = crypto.randomBytes(32).toString('hex');

    /* ============================
       CREATE TRANSACTION
    ============================ */
    const transaction = await Transaction.create({
      transaction_id: transactionId,
      student_id: student._id,
      student_reg_no: student.reg_no, // ✅ FIXED
      faculty_email,
      faculty_id,
      expected_return_date,
      items,
      status: 'raised',
      faculty_approval: {
        approval_token: approvalToken,
        approved: false
      }
    });

    /* ============================
       SEND FACULTY APPROVAL EMAIL
    ============================ */
    const approvalLink =
      `${process.env.FRONTEND_URL}/faculty/approve?token=${approvalToken}`;

    await sendMail({
      to: faculty_email,
      subject: 'IoT Lab Component Borrow Approval',
      html: `
        <p>
          Student <b>${student.name}</b>
          (Reg No: <b>${student.reg_no}</b>)
          has requested lab components.
        </p>
        <p>Transaction ID: <b>${transactionId}</b></p>
        <a href="${approvalLink}">Approve Request</a>
      `
    });

    return res.status(201).json({
      success: true,
      transaction_id: transactionId
    });

  } catch (err) {
    console.error('Raise transaction error:', err);
    return res.status(500).json({ error: err.message });
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
   TRACK TRANSACTION BY ID
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
