const express = require('express');
const router = express.Router();

router.use('/transactions', require('./transactions.routes'));
router.use('/items', require('./items.routes'));

module.exports = router;
