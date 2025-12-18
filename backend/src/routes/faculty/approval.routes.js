const express = require('express');
const router = express.Router();

const {
  approveTransaction
} = require('../../controllers/faculty.controller');

// faculty approval via email link
router.get('/approve', approveTransaction);

module.exports = router;
