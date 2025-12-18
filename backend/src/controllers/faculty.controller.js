const Transaction = require('../models/Transaction');

/* ============================
   FACULTY APPROVAL
============================ */

exports.approveTransaction = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Approval token missing' });
    }

    const transaction = await Transaction.findOne({
      'faculty_approval.approval_token': token
    });

    if (!transaction) {
      return res.status(400).json({ error: 'Invalid approval token' });
    }

    // Prevent re-approval
    if (transaction.status !== 'raised') {
      return res.status(400).json({
        error: `Transaction already ${transaction.status}`
      });
    }

    transaction.status = 'approved';
    transaction.faculty_approval.approved = true;
    transaction.faculty_approval.approved_at = new Date();
    transaction.faculty_approval.approval_token = undefined;

    await transaction.save();

    // simple response (frontend can render UI)
    res.json({
      success: true,
      message: 'Transaction approved successfully',
      transaction_id: transaction.transaction_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
