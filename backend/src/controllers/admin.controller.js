const Item = require('../models/Item');
const ItemAsset = require('../models/ItemAsset');
const Transaction = require('../models/Transaction');

/* =========================
   INVENTORY MANAGEMENT
========================= */

/* ============================
   ADD ITEM (FINAL – SAFE)
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

    if (!initial_quantity || initial_quantity <= 0) {
      return res.status(400).json({
        error: 'Initial quantity must be greater than 0'
      });
    }

    /* ================= CREATE ITEM ================= */
    const item = await Item.create({
      name,
      sku,
      category,
      vendor,
      location,
      description,
      tracking_type,

      // ✅ LIVE FIELDS
      total_quantity: initial_quantity,
      available_quantity: initial_quantity,

      // 📜 HISTORICAL
      initial_quantity,

      min_threshold_quantity,

      // 🔐 ASSET COUNTER
      last_asset_seq: tracking_type === 'asset' ? initial_quantity : 0
    });

    const generatedAssetTags = [];

    /* ================= CREATE ASSETS ================= */
    if (tracking_type === 'asset') {
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

    return res.status(201).json({
      success: true,
      message: 'Item added successfully',
      data: item,
      generated_asset_tags: generatedAssetTags
    });

  } catch (err) {
    console.error('ADD ITEM ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
};
/* ============================
   UPDATE ITEM (FINAL – BACKWARD COMPATIBLE)
============================ */
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    /* ===== tracking_type is immutable ===== */
    if (
      req.body.tracking_type &&
      req.body.tracking_type !== item.tracking_type
    ) {
      return res.status(400).json({
        error: 'Tracking type cannot be changed after item creation',
      });
    }

    const addQty = Number(req.body.add_quantity || 0);
    const removeAssetTags = req.body.remove_asset_tags || [];
    const createdAssets = [];

    /* =================================================
       ENSURE last_asset_seq EXISTS (AUTO-INIT)
       ================================================= */
    if (
      item.tracking_type === 'asset' &&
      typeof item.last_asset_seq !== 'number'
    ) {
      const lastAsset = await ItemAsset.findOne({ item_id: item._id })
        .sort({ asset_tag: -1 })
        .lean();

      if (lastAsset?.asset_tag) {
        const match = lastAsset.asset_tag.match(/(\d+)$/);
        item.last_asset_seq = match ? parseInt(match[1], 10) : 0;
      } else {
        item.last_asset_seq = 0;
      }
    }

    /* ================= ADD STOCK ================= */
    if (addQty > 0) {

      /* ===== BULK ===== */
      if (item.tracking_type === 'bulk') {
        item.total_quantity += addQty;
        item.available_quantity += addQty;
      }

      /* ===== ASSET ===== */
      if (item.tracking_type === 'asset') {
        for (let i = 0; i < addQty; i++) {
          item.last_asset_seq += 1;

          const assetTag = `${item.sku}-${String(
            item.last_asset_seq
          ).padStart(4, '0')}`;

          const asset = await ItemAsset.create({
            item_id: item._id,
            asset_tag: assetTag,
            status: 'available',
            condition: 'good',
            location: item.location,
          });

          // ✅ RETURN FULL OBJECT (OLD BEHAVIOR)
          createdAssets.push(asset);
        }

        item.total_quantity += addQty;
        item.available_quantity += addQty;
      }
    }

    /* ================= REMOVE ASSET STOCK ================= */
    if (
      addQty < 0 &&
      item.tracking_type === 'asset' &&
      removeAssetTags.length > 0
    ) {
      const assets = await ItemAsset.find({
        item_id: item._id,
        asset_tag: { $in: removeAssetTags },
        status: 'available',
      });

      if (assets.length !== removeAssetTags.length) {
        return res.status(400).json({
          error: 'One or more selected assets are not available',
        });
      }

      await ItemAsset.updateMany(
        { _id: { $in: assets.map(a => a._id) } },
        { $set: { status: 'retired', condition: 'broken' } }
      );

      item.total_quantity -= assets.length;
      item.available_quantity -= assets.length;
    }

    /* ================= REMOVE BULK STOCK ================= */
    if (addQty < 0 && item.tracking_type === 'bulk') {
      const removeQty = Math.abs(addQty);

      if (removeQty > item.available_quantity) {
        return res.status(400).json({
          error: 'Cannot remove more than available quantity',
        });
      }

      item.total_quantity -= removeQty;
      item.available_quantity -= removeQty;
    }

    /* ================= CLEAN REQUEST ================= */
    delete req.body.add_quantity;
    delete req.body.remove_asset_tags;
    delete req.body.tracking_type;
    delete req.body.initial_quantity;
    delete req.body.available_quantity;
    delete req.body.total_quantity;
    delete req.body.last_asset_seq;

    Object.assign(item, req.body);
    await item.save();

    return res.json({
      success: true,
      data: item,
      created_assets: createdAssets, // 🔥 EXACTLY LIKE BEFORE
    });

  } catch (err) {
    console.error('UPDATE ITEM ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
};


/* ============================
   GET ITEM ASSETS
============================ */
exports.getItemAssets = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.tracking_type !== 'asset') {
      return res.status(400).json({
        error: 'This item does not support asset tracking'
      });
    }

    const filter = { item_id: item._id };
    if (status) filter.status = status;

    const assets = await ItemAsset.find(filter)
      .select('asset_tag status condition')
      .sort({ asset_tag: 1 })
      .lean();

    return res.json({
      success: true,
      data: assets
    });

  } catch (err) {
    console.error('GET ITEM ASSETS ERROR:', err);
    return res.status(500).json({
      error: 'Failed to fetch item assets'
    });
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
    const items = await Item.find({ is_active: true }).sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   TRANSACTION HISTORY
============================ */
exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('student_id', 'name reg_no email')
      .populate('items.item_id', 'name sku tracking_type')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: transactions });
  } catch (err) {
    console.error('GET TRANSACTION HISTORY ERROR:', err);
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
      .populate('items.item_id', 'name sku tracking_type')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: transactions });
  } catch (err) {
    console.error('SEARCH TRANSACTIONS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   OVERDUE TRANSACTIONS
============================ */
exports.getOverdueTransactions = async (req, res) => {
  try {
    const overdue = await Transaction.find({ status: 'overdue' })
      .populate('student_id', 'name reg_no email')
      .populate('items.item_id', 'name sku tracking_type')
      .sort({ expected_return_date: 1 })
      .lean();

    res.json({ success: true, data: overdue });
  } catch (err) {
    console.error('GET OVERDUE TRANSACTIONS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ============================
   GET SINGLE ITEM
============================ */
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      is_active: true
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
