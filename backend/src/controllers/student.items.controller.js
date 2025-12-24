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
        available_quantity: 1,
        total_quantity: 1,          // ✅ REQUIRED
        min_threshold_quantity: 1   // ✅ REQUIRED (low-stock UI)
      }
    ).sort({ name: 1 });

    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error('STUDENT ITEMS ERROR:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load available items'
    });
  }
};
