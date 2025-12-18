const Transaction = require('../models/Transaction');
const Item = require('../models/Item');

/* ============================
   ISSUE ITEMS (APPROVED → ACTIVE)
============================ */

exports.issueTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    const transaction = await Transaction.findOne({ transaction_id })
      .populate('items.item_id');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'approved') {
      return res.status(400).json({
        error: `Transaction is ${transaction.status}, cannot issue`
      });
    }

    // Validate inventory again (safety)
    for (const tItem of transaction.items) {
      const item = await Item.findById(tItem.item_id._id);

      const usableQty =
        item.available_quantity - item.reserved_quantity;

      if (usableQty < tItem.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.name}`
        });
      }
    }

    // Deduct inventory
    for (const tItem of transaction.items) {
      await Item.findByIdAndUpdate(
        tItem.item_id._id,
        {
          $inc: { available_quantity: -tItem.quantity }
        }
      );

      tItem.issued_quantity = tItem.quantity;
    }

    transaction.status = 'active';
    transaction.issued_by_incharge_id = req.user.id;
    transaction.issued_at = new Date();

    await transaction.save();

    res.json({
      success: true,
      message: 'Items issued successfully',
      transaction_id: transaction.transaction_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.returnTransaction = async (req, res) => {
  try {
    const { returned_items } = req.body;

    if (!returned_items || returned_items.length === 0) {
      return res.status(400).json({ error: 'No returned items provided' });
    }

    const transaction = await Transaction.findOne({
      transaction_id: req.params.transaction_id,
      status: 'active'
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Active transaction not found' });
    }

    /* ============================
       PROCESS RETURNS
    ============================ */
    for (const r of returned_items) {
      const item = await Item.findById(r.item_id);

      if (!item) {
        return res.status(400).json({ error: 'Invalid item in return' });
      }

      if (r.damaged) {
        item.damaged_quantity += r.quantity;
      } else {
        item.available_quantity += r.quantity;
      }

      await item.save();
    }

    /* ============================
       CLOSE TRANSACTION
    ============================ */
    transaction.status = 'completed';
    transaction.actual_return_date = new Date();
    transaction.returned_items = returned_items;

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

