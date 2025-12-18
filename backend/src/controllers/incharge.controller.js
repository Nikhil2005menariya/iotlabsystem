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


/* ============================
   RETURN ITEMS (ACTIVE → COMPLETED)
============================ */

exports.returnTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const { items, damage_notes } = req.body;

    /*
      items: [
        {
          item_id,
          returned_quantity,
          damaged_quantity
        }
      ]
    */

    const transaction = await Transaction.findOne({ transaction_id })
      .populate('items.item_id');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'active') {
      return res.status(400).json({
        error: `Transaction is ${transaction.status}, cannot return`
      });
    }

    // Validate return data
    for (const rItem of items) {
      const tItem = transaction.items.find(
        i => i.item_id._id.toString() === rItem.item_id
      );

      if (!tItem) {
        return res.status(400).json({ error: 'Invalid item in return list' });
      }

      const totalReturned =
        rItem.returned_quantity + rItem.damaged_quantity;

      if (totalReturned !== tItem.issued_quantity) {
        return res.status(400).json({
          error: `Returned + damaged quantity must equal issued quantity for item ${tItem.item_id.name}`
        });
      }
    }

    // Process inventory updates
    for (const rItem of items) {
      const tItem = transaction.items.find(
        i => i.item_id._id.toString() === rItem.item_id
      );

      const item = await Item.findById(tItem.item_id._id);

      // Restore usable items
      await Item.findByIdAndUpdate(item._id, {
        $inc: {
          available_quantity: rItem.returned_quantity,
          damaged_quantity: rItem.damaged_quantity
        }
      });

      tItem.returned_quantity = rItem.returned_quantity;
      tItem.damaged_quantity = rItem.damaged_quantity;
    }

    transaction.status = 'completed';
    transaction.actual_return_date = new Date();
    transaction.damage_notes = damage_notes;

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction completed successfully',
      transaction_id: transaction.transaction_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

