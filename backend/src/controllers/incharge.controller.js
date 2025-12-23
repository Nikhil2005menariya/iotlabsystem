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

/* ============================
   RETURN ITEMS (ACTIVE → COMPLETED)
============================ */
exports.returnTransaction = async (req, res) => {
  try {
    const { returned_items } = req.body;

    if (!returned_items || returned_items.length === 0) {
      return res.status(400).json({
        error: 'No returned items provided'
      });
    }

    const transaction = await Transaction.findOne({
      transaction_id: req.params.transaction_id,
      status: 'active'
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Active transaction not found'
      });
    }

    /* ============================
       PROCESS RETURNS
    ============================ */
    for (const rItem of returned_items) {
      const item = await Item.findById(rItem.item_id);

      if (!item) {
        return res.status(400).json({ error: 'Invalid item in return' });
      }

      /* ========= BULK ITEM ========= */
      if (item.tracking_type === 'bulk') {
        item.available_quantity += rItem.quantity;

        if (rItem.damaged) {
          item.damaged_quantity += rItem.quantity;
        }

        await item.save();
      }

      /* ========= ASSET ITEM ========= */
      if (item.tracking_type === 'asset') {
        if (!rItem.asset_tags || rItem.asset_tags.length === 0) {
          return res.status(400).json({
            error: `Asset tags required for ${item.name}`
          });
        }

        for (const tag of rItem.asset_tags) {
          const asset = await ItemAsset.findOne({
            asset_tag: tag,
            item_id: item._id,
            status: 'issued'
          });

          if (!asset) {
            return res.status(400).json({
              error: `Asset ${tag} not issued or invalid`
            });
          }

          if (rItem.damaged) {
            asset.status = 'damaged';
            asset.condition = 'broken';
            item.damaged_quantity += 1;
          } else {
            asset.status = 'available';
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