const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const ItemAsset = require('../models/ItemAsset');
const DamagedAssetLog = require('../models/DamagedAssetLog'); // ✅ NEW
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Staff = require('../models/Staff');
const { sendMail } = require('../services/mail.service');

/* ============================
   ISSUE ITEMS (APPROVED → ACTIVE)
============================ */
exports.issueTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const { items } = req.body;

    // 1️⃣ Fetch approved transaction
    const transaction = await Transaction.findOne({
      transaction_id,
      status: 'approved',
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found or not approved',
      });
    }

    // 2️⃣ Process each transaction item
    for (const tItem of transaction.items) {
      const item = await Item.findById(tItem.item_id);
      if (!item) {
        return res.status(400).json({
          error: 'Invalid item in transaction',
        });
      }

      /* ================= BULK ITEM ================= */
      if (item.tracking_type === 'bulk') {
        const usableQty =
          item.available_quantity - (item.reserved_quantity || 0);

        if (usableQty < tItem.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${item.name}`,
          });
        }

        // Update stock
        item.available_quantity -= tItem.quantity;
        tItem.issued_quantity = tItem.quantity;

        await item.save();
      }

      /* ================= ASSET ITEM ================= */
      if (item.tracking_type === 'asset') {
        const issuedAsset = items?.find(
          (i) => String(i.item_id) === String(item._id)
        );

        if (!issuedAsset || !issuedAsset.asset_tags?.length) {
          return res.status(400).json({
            error: `Asset tags required for ${item.name}`,
          });
        }

        if (issuedAsset.asset_tags.length !== tItem.quantity) {
          return res.status(400).json({
            error: `Asset tag count mismatch for ${item.name}`,
          });
        }

        // Issue each asset tag
        for (const tag of issuedAsset.asset_tags) {
          const asset = await ItemAsset.findOne({
            asset_tag: tag,
            item_id: item._id,
            status: 'available',
          });

          if (!asset) {
            return res.status(400).json({
              error: `Asset ${tag} not available`,
            });
          }

          asset.status = 'issued';
          asset.last_transaction_id = transaction._id;
          await asset.save();
        }

        // 🔴 CRITICAL FIX — update item availability
        item.available_quantity -= issuedAsset.asset_tags.length;
        await item.save();

        // Store issued info in transaction
        tItem.asset_tags = issuedAsset.asset_tags;
        tItem.issued_quantity = issuedAsset.asset_tags.length;
      }
    }

    // 3️⃣ Finalize transaction
    transaction.status = 'active';
    transaction.issued_by_incharge_id = req.user.id;
    transaction.issued_at = new Date();

    await transaction.save();

    return res.json({
      success: true,
      message: 'Items issued successfully',
      transaction_id,
    });

  } catch (err) {
    console.error('Issue transaction error:', err);
    return res.status(500).json({
      error: 'Failed to issue transaction',
    });
  }
};

/* ============================
   RETURN TRANSACTION (ACTIVE → COMPLETED)
============================ */
exports.returnTransaction = async (req, res) => {
  try {
    const { returned_items } = req.body;

    if (!Array.isArray(returned_items) || returned_items.length === 0) {
      return res.status(400).json({ error: 'No returned items provided' });
    }

    const transaction = await Transaction.findOne({
      transaction_id: req.params.transaction_id,
      status: 'active'
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Active transaction not found' });
    }

    for (const rItem of returned_items) {
      const item = await Item.findById(rItem.item_id);
      if (!item) {
        return res.status(400).json({ error: 'Invalid item' });
      }

      const txnItem = transaction.items.find(
        t => String(t.item_id) === String(item._id)
      );

      if (!txnItem) {
        return res.status(400).json({
          error: `Item ${item.name} not part of transaction`
        });
      }

      /* =====================================================
         BULK ITEM RETURN (QUANTITY-BASED)
      ===================================================== */
      if (item.tracking_type === 'bulk') {
        const qty = Number(rItem.quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
          return res.status(400).json({ error: 'Invalid quantity' });
        }

        item.available_quantity += qty;
        txnItem.returned_quantity += qty;

        if (rItem.damaged === true) {
          item.damaged_quantity += qty;
          txnItem.damaged_quantity += qty;
        }

        await item.save();
      }

      /* =====================================================
         ASSET ITEM RETURN (TAG-BASED, PARTIAL DAMAGE SUPPORTED)
      ===================================================== */
      if (item.tracking_type === 'asset') {
        if (!Array.isArray(rItem.asset_tags) || rItem.asset_tags.length === 0) {
          return res.status(400).json({
            error: `Asset tags required for ${item.name}`
          });
        }

        const returnedTags = rItem.asset_tags.map(t =>
          t.trim().toUpperCase()
        );

        const damagedTags = Array.isArray(rItem.damaged_asset_tags)
          ? rItem.damaged_asset_tags.map(t => t.trim().toUpperCase())
          : [];

        // 🔒 Ensure damaged tags ⊆ returned tags
        for (const tag of damagedTags) {
          if (!returnedTags.includes(tag)) {
            return res.status(400).json({
              error: `Damaged asset ${tag} was not returned`
            });
          }
        }

        for (const tag of returnedTags) {
          if (!txnItem.asset_tags.includes(tag)) {
            return res.status(400).json({
              error: `Asset ${tag} not issued in this transaction`
            });
          }

          const asset = await ItemAsset.findOne({
            asset_tag: tag,
            item_id: item._id
          });

          if (!asset) {
            return res.status(400).json({
              error: `Asset ${tag} record missing`
            });
          }

          /* ---------- DAMAGED ASSET ---------- */
          if (damagedTags.includes(tag)) {
            asset.status = 'damaged';
            asset.condition = 'broken';

            item.damaged_quantity += 1;
            txnItem.damaged_quantity += 1;

            await DamagedAssetLog.create({
              asset_id: asset._id,
              transaction_id: transaction._id,
              student_id: transaction.student_id,
              faculty_id: transaction.faculty_id || null,
              faculty_email: transaction.faculty_email || null,
              damage_reason:
                rItem.damage_reason || 'Reported damaged during return',
              remarks: rItem.remarks || ''
            });
          }
          /* ---------- NORMAL RETURN ---------- */
          else {
            asset.status = 'available';
            asset.condition = 'good';

            item.available_quantity += 1;
            txnItem.returned_quantity += 1;
          }

          asset.last_transaction_id = transaction._id;
          await asset.save();
        }

        await item.save();
      }
    }

    /* =====================================================
       FINALIZE TRANSACTION
    ===================================================== */
    transaction.status = 'completed';
    transaction.actual_return_date = new Date();
    await transaction.save();

    return res.json({
      success: true,
      message: 'Transaction completed successfully',
      transaction_id: transaction.transaction_id
    });

  } catch (err) {
    console.error('Return transaction error:', err);
    return res.status(500).json({ error: err.message });
  }
};


/* ============================
   GET ACTIVE TRANSACTIONS
============================ */
exports.getActiveTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: 'active' })
      .populate('student_id', 'name reg_no')
      .populate('items.item_id', 'name tracking_type')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to load active transactions'
    });
  }
};

/* ============================
   GET PENDING TRANSACTIONS
============================ */
exports.getPendingTransactions = async (req, res) => {
  const transactions = await Transaction.find({ status: 'approved' })
    .populate('student_id', 'name reg_no')
    .populate('items.item_id', 'name tracking_type')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: transactions });
};

/* ============================
   GET AVAILABLE ASSETS FOR ITEM
============================ */
exports.getAvailableAssetsByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const assets = await ItemAsset.find({
      item_id: itemId,
      status: 'available'
    }).select('asset_tag status');

    res.json({
      success: true,
      data: assets
    });
  } catch (err) {
    console.error('Get available assets error:', err);
    res.status(500).json({
      error: 'Failed to load available assets'
    });
  }
};

