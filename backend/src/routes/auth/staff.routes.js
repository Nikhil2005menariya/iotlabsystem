const express = require('express');
const router = express.Router();
const { staffLogin } = require('../../controllers/auth.controller');

const {
  adminLogin,
  forgotPassword,
  resetPassword,
  inchargeForgotPassword,
  inchargeResetPassword,
} = require('../../controllers/auth.controller');

router.post('/login', staffLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/incharge/forgot-password', inchargeForgotPassword);
router.post('/incharge/reset-password', inchargeResetPassword);

module.exports = router;
