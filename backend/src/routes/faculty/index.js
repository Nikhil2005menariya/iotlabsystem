const express = require('express');
const router = express.Router();

router.use('/', require('./approval.routes'));

module.exports = router;
