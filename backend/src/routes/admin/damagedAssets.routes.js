const express = require('express');
const router = express.Router();

const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');

const DamagedAssetLog = require('../../models/DamagedAssetLog');

// Admin only
router.use(auth, role('admin'));

/**
 * GET /api/v1/admin/damaged-assets
 * Admin: View all damaged & under-repair asset items
 */
router.get('/', async (req, res) => {
  try {
    const records = await DamagedAssetLog.find({
      status: { $in: ['damaged', 'under_repair'] }
    })
      .populate({
        path: 'asset_id',
        populate: { path: 'item_id' }
      })
      .populate('student_id', 'name reg_no email')
      .populate('faculty_id', 'name faculty_id email')
      .sort({ reported_at: -1 })
      .lean();

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('Error fetching damaged assets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch damaged assets'
    });
  }
});



/**
 * GET /api/v1/admin/damaged-assets/:id
 * Admin: Full drill-down view of a damaged asset
 */
router.get('/:id', async (req, res) => {
  try {
    const record = await DamagedAssetLog.findById(req.params.id)
      .populate({
        path: 'asset_id',
        populate: {
          path: 'item_id'
        }
      })
      .populate('student_id')
      .populate('faculty_id')
      .populate({
        path: 'transaction_id',
        populate: [
          { path: 'items.item_id' },
          { path: 'student_id' },
          { path: 'faculty_id' }
        ]
      })
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Damaged asset record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Error fetching damaged asset details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch damaged asset details'
    });
  }
});


/**
 * PATCH /api/v1/admin/damaged-assets/:id/status
 * Admin: Update asset status (repair / resolve / retire)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { action } = req.body;
    // action: 'repair' | 'resolve' | 'retire'

    if (!['repair', 'resolve', 'retire'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    const record = await DamagedAssetLog.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Damage record not found'
      });
    }

    const asset = await require('../../models/ItemAsset').findById(record.asset_id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // 🔁 State transitions
    switch (action) {
      case 'repair':
        asset.status = 'damaged';
        asset.condition = 'faulty';
        record.status = 'under_repair';
        break;

      case 'resolve':
        asset.status = 'available';
        asset.condition = 'good';
        record.status = 'resolved';
        break;

      case 'retire':
        asset.status = 'retired';
        asset.condition = 'broken';
        record.status = 'retired';
        break;
    }

    await asset.save();
    await record.save();

    res.json({
      success: true,
      message: `Asset status updated via action: ${action}`
    });
  } catch (error) {
    console.error('Error updating damaged asset status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update asset status'
    });
  }
});



/**
 * GET /api/v1/admin/damaged-assets/under-repair
 * Admin: View all assets currently under repair
 */
router.get('/under-repair/list', async (req, res) => {
  try {
    const ItemAsset = require('../../models/ItemAsset');

    const assets = await ItemAsset.find({
      status: 'damaged',
      condition: 'faulty'
    })
      .populate('item_id')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching under-repair assets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch under-repair assets'
    });
  }
});


module.exports = router;
