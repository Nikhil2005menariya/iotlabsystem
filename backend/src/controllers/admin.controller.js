const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

/* =========================
   INVENTORY MANAGEMENT
========================= */

// Add new item
exports.addItem = async (req, res) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Update item (quantity or metadata)
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Soft delete item
exports.removeItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, message: 'Item removed (soft delete)' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// View all items
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find({ is_active: true }).sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* =========================
   TRANSACTION MANAGEMENT
========================= */

// View full transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('student_id', 'name reg_no email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search transaction
exports.searchTransactions = async (req, res) => {
  try {
    const { transaction_id, reg_no, faculty_email, faculty_id } = req.query;

    const filter = {};

    if (transaction_id) filter.transaction_id = transaction_id;
    if (reg_no) filter.student_reg_no = reg_no;
    if (faculty_email) filter.faculty_email = faculty_email;
    if (faculty_id) filter.faculty_id = faculty_id;

    const transactions = await Transaction.find(filter)
      .populate('student_id', 'name reg_no email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* =========================
   OVERDUE TRANSACTIONS
========================= */

exports.getOverdueTransactions = async (req, res) => {
  try {
    const today = new Date();

    const overdue = await Transaction.find({
      status: { $in: ['active', 'approved'] },
      expected_return_date: { $lt: today }
    })
      .populate('student_id', 'name reg_no email')
      .sort({ expected_return_date: 1 });

    res.json({ success: true, data: overdue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
