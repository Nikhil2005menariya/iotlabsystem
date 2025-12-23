const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const ItemAsset = require('../models/ItemAsset');

/* ============================
   ISSUE ITEMS (APPROVED → ACTIVE)
============================ */
exports.issueTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const { items } = req.body; // 🔥 asset tags come here

    const transaction = await Transaction.findOne({
      transaction_id,
      status: 'approved'
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found or not approved'
      });
    }

    /* ============================
       PROCESS EACH TRANSACTION ITEM
    ============================ */
    for (const tItem of transaction.items) {
      const item = await Item.findById(tItem.item_id);

      if (!item) {
        return res.status(400).json({ error: 'Invalid item in transaction' });
      }

      /* ========= BULK ITEM ========= */
      if (item.tracking_type === 'bulk') {
        const usableQty =
          item.available_quantity - item.reserved_quantity;

        if (usableQty < tItem.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${item.name}`
          });
        }

        item.available_quantity -= tItem.quantity;
        tItem.issued_quantity = tItem.quantity;

        await item.save();
      }

      /* ========= ASSET ITEM ========= */
      if (item.tracking_type === 'asset') {
        // Find asset tags provided for this item
        const issuedAsset = items?.find(
          i => String(i.item_id) === String(item._id)
        );

        if (!issuedAsset || !issuedAsset.asset_tags?.length) {
          return res.status(400).json({
            error: `Asset tags required for ${item.name}`
          });
        }

        if (issuedAsset.asset_tags.length !== tItem.quantity) {
          return res.status(400).json({
            error: `Asset tag count mismatch for ${item.name}`
          });
        }

        for (const tag of issuedAsset.asset_tags) {
          const asset = await ItemAsset.findOne({
            asset_tag: tag,
            item_id: item._id,
            status: 'available'
          });

          if (!asset) {
            return res.status(400).json({
              error: `Asset ${tag} not available`
            });
          }

          asset.status = 'issued';
          asset.last_transaction_id = transaction._id;
          await asset.save();
        }

        tItem.asset_tags = issuedAsset.asset_tags;
        tItem.issued_quantity = issuedAsset.asset_tags.length;
      }
    }

    transaction.status = 'active';
    transaction.issued_by_incharge_id = req.user.id;
    transaction.issued_at = new Date();

    await transaction.save();

    res.json({
      success: true,
      message: 'Items issued successfully',
      transaction_id
    });

  } catch (err) {
    console.error('Issue transaction error:', err);
    res.status(500).json({ error: err.message });
  }
};

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
      if (!item) return res.status(400).json({ error: 'Invalid item' });

      const txnItem = transaction.items.find(
        t => t.item_id.toString() === item._id.toString()
      );

      if (!txnItem) {
        return res.status(400).json({
          error: `Item ${item.name} not part of transaction`
        });
      }

      /* ================= BULK ================= */
      if (item.tracking_type === 'bulk') {
        const qty = Number(rItem.quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
          return res.status(400).json({ error: 'Invalid quantity' });
        }

        item.available_quantity = Number(item.available_quantity) || 0;
        item.available_quantity += qty;

        txnItem.returned_quantity += qty;

        if (rItem.damaged) {
          item.damaged_quantity += qty;
          txnItem.damaged_quantity += qty;
        }

        await item.save();
      }

      /* ================= ASSET ================= */
      if (item.tracking_type === 'asset') {
        if (!Array.isArray(rItem.asset_tags) || rItem.asset_tags.length === 0) {
          return res.status(400).json({
            error: `Asset tags required for ${item.name}`
          });
        }

        for (const rawTag of rItem.asset_tags) {
          const tag = rawTag.trim().toUpperCase();

          if (!txnItem.asset_tags.includes(tag)) {
            return res.status(400).json({
              error: `Asset ${tag} not issued in this transaction`
            });
          }

          if (
            txnItem.returned_quantity + txnItem.damaged_quantity >=
            txnItem.issued_quantity
          ) {
            return res.status(400).json({
              error: `Asset ${tag} already returned or damaged`
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

          if (rItem.damaged) {
            asset.status = 'damaged';
            asset.condition = 'broken';
            item.damaged_quantity += 1;
            txnItem.damaged_quantity += 1;
          } else {
            asset.status = 'available';
            txnItem.returned_quantity += 1;
          }

          asset.last_transaction_id = transaction._id;
          await asset.save();
        }

        await item.save();
      }
    }

    transaction.status = 'completed';
    transaction.actual_return_date = new Date();
    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction completed successfully',
      transaction_id: transaction.transaction_id
    });

  } catch (err) {
    console.error('Return transaction error:', err);
    res.status(500).json({ error: err.message });
  }
};


exports.getActiveTransactions = async (req, res) => {
  try {
  const transactions = await Transaction.find({ status: 'active' })
  .populate('student_id', 'name reg_no')
  .populate('items.item_id', 'name tracking_type') // ✅ FIX
  .sort({ createdAt: -1 });


    res.json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to load active transactions',
    });
  }
};

exports.getPendingTransactions = async (req, res) => {
const transactions = await Transaction.find({ status: 'approved' })
  .populate('student_id', 'name reg_no')
  .populate('items.item_id', 'name tracking_type') // ✅ FIX
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
      status: 'available',
    }).select('asset_tag status');

    res.json({
      success: true,
      data: assets,
    });
  } catch (err) {
    console.error('Get available assets error:', err);
    res.status(500).json({
      error: 'Failed to load available assets',
    });
  }
};
