const Item = require('../models/Item');

exports.getAvailableItemsForStudent = async (req, res) => {
  try {
    const items = await Item.find(
      { is_active: true },
      {
        name: 1,
        sku: 1,
        category: 1,
        description: 1,
        tracking_type: 1,
        available_quantity: 1
      }
    ).sort({ name: 1 });

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
