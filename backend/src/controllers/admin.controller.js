const Item = require('../models/Item');
const ItemAsset = require('../models/ItemAsset');
const Transaction = require('../models/Transaction');

/* =========================
   INVENTORY MANAGEMENT
========================= */

/* ============================
   ADD ITEM (BULK / ASSET)
============================ */
exports.addItem = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      vendor,
      location,
      description,
      tracking_type,
      initial_quantity,
      min_threshold_quantity,
      asset_prefix
    } = req.body;

    if (!tracking_type || !['bulk', 'asset'].includes(tracking_type)) {
      return res.status(400).json({ error: 'Invalid tracking type' });
    }

    // 1️⃣ Create item
    const item = await Item.create({
      name,
      sku,
      category,
      vendor,
      location,
      description,
      tracking_type,
      initial_quantity,
      available_quantity: initial_quantity,
      min_threshold_quantity
    });

    // 2️⃣ Generate asset tags if asset-tracked
    let generatedAssetTags = [];

    if (tracking_type === 'asset') {
      if (!initial_quantity || initial_quantity <= 0) {
        return res.status(400).json({
          error: 'Initial quantity required for asset-tracked items'
        });
      }

      const prefix = asset_prefix || sku;

      const assets = [];

      for (let i = 1; i <= initial_quantity; i++) {
        const assetTag = `${prefix}-${String(i).padStart(4, '0')}`;

        generatedAssetTags.push(assetTag);

        assets.push({
          item_id: item._id,
          asset_tag: assetTag,
          location,
          status: 'available',
          condition: 'good'
        });
      }

      await ItemAsset.insertMany(assets);
    }

    // 3️⃣ Respond with generated labels
    res.status(201).json({
      success: true,
      message: 'Item added successfully',
      item,
      generated_asset_tags:
        tracking_type === 'asset' ? generatedAssetTags : []
    });

  } catch (err) {
    console.error('Add item error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   UPDATE ITEM (METADATA ONLY)
============================ */
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // ❗ Do NOT allow tracking type change after creation
    if (
      req.body.tracking_type &&
      req.body.tracking_type !== item.tracking_type
    ) {
      return res.status(400).json({
        error: 'Tracking type cannot be changed after item creation'
      });
    }

    Object.assign(item, req.body);
    await item.save();

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ============================
   SOFT DELETE ITEM
============================ */
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

    res.json({
      success: true,
      message: 'Item removed (soft delete)'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ============================
   VIEW ALL ITEMS
============================ */
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find({ is_active: true })
      .sort({ name: 1 });

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   TRANSACTION MANAGEMENT
========================= */

/* ============================
   FULL TRANSACTION HISTORY
============================ */
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

/* ============================
   SEARCH TRANSACTIONS
============================ */
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
      status: 'overdue'
    })
      .populate('student_id', 'name reg_no email')
      .sort({ expected_return_date: 1 });

    res.json({ success: true, data: overdue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
