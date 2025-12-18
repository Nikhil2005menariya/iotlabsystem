const express = require('express');
const router = express.Router();

const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');

// 🔒 Protect ALL admin routes
router.use(auth, role('admin'));

const itemRoutes = require('./items.routes');
const transactionRoutes = require('./transactions.routes');
const overdueRoutes = require('./overdue.routes');

router.use('/items', itemRoutes);
router.use('/transactions', transactionRoutes);
router.use('/overdue', overdueRoutes);

module.exports = router;
