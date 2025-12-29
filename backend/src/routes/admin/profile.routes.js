const express = require('express');
const router = express.Router();

const {
  changeAdminPassword,
  requestAdminEmailOTP,
  updateAdminEmail
} = require('../../controllers/admin.controller');

router.post('/change-password', changeAdminPassword);
router.post('/request-email-otp', requestAdminEmailOTP);
router.post('/update-email', updateAdminEmail);

module.exports = router;
