const Transaction = require('../models/Transaction');

/* ============================
   FACULTY APPROVAL
============================ */

/* ============================
   APPROVE TRANSACTION
============================ */
exports.approveTransaction = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Approval token missing' });
    }

    const transaction = await Transaction.findOne({
      'faculty_approval.approval_token': token,
      status: 'raised',
    });

    if (!transaction) {
      return res.status(400).json({ error: 'Invalid or expired approval token' });
    }

    transaction.status = 'approved';
    transaction.faculty_approval.approved = true;
    transaction.faculty_approval.approved_at = new Date();
    transaction.faculty_approval.approval_token = undefined;

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction approved successfully',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* ============================
   GET APPROVAL DETAILS (READ ONLY)
============================ */
exports.getApprovalDetails = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Approval token missing' });
    }

    const transaction = await Transaction.findOne({
      'faculty_approval.approval_token': token,
      status: 'raised',
    });

    if (!transaction) {
      return res.status(400).json({ error: 'Invalid or expired approval token' });
    }

    res.json({
      success: true,
      transaction_id: transaction.transaction_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* ============================
   REJECT TRANSACTION
============================ */
exports.rejectTransaction = async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Approval token missing' });
    }

    const transaction = await Transaction.findOne({
      'faculty_approval.approval_token': token,
      status: 'raised',
    });

    if (!transaction) {
      return res.status(400).json({ error: 'Invalid or expired approval token' });
    }

    transaction.status = 'rejected';
    transaction.faculty_approval.approved = false;
    transaction.faculty_approval.rejected_reason = reason || '';
    transaction.faculty_approval.approved_at = new Date();
    transaction.faculty_approval.approval_token = undefined;

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction rejected successfully',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

