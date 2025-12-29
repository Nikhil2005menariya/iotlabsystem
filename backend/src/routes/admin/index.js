const express = require('express');
const router = express.Router();

const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');

// 🔒 Protect ALL admin routes
router.use(auth, role('admin'));

const itemRoutes = require('./items.routes');
const transactionRoutes = require('./transactions.routes');
const overdueRoutes = require('./overdue.routes');
const damagedAssetsRoutes = require('./damagedAssets.routes');
const profileRoutes = require('./profile.routes');



router.use('/analysis', require('../../analysis/analysis.routes'));
router.use('/items', itemRoutes);
router.use('/transactions', transactionRoutes);
router.use('/overdue', overdueRoutes);
router.use('/damaged-assets', damagedAssetsRoutes);
router.use('/profile', profileRoutes);


module.exports = router;
