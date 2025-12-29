const express = require('express');
const router = express.Router();


router.use('/transactions', require('./transactions.routes'));
router.use('/profile', require('./profile.routes'));

module.exports = router;
