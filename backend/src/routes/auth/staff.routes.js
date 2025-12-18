const express = require('express');
const router = express.Router();
const { staffLogin } = require('../../controllers/auth.controller');

const {
  adminLogin,
  forgotPassword,
  resetPassword,
  inchargeForgotPassword,
  inchargeResetPassword,
  requestStaffEmailChange,
  confirmStaffEmailChange,
} = require('../../controllers/auth.controller');

router.post('/login', staffLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/incharge/forgot-password', inchargeForgotPassword);
router.post('/incharge/reset-password', inchargeResetPassword);
// 🔐 Admin + Incharge only
router.post(
  '/change-email/request',
  auth,
  role('admin', 'incharge'),
  requestStaffEmailChange
);

router.post(
  '/change-email/confirm',
  auth,
  role('admin', 'incharge'),
  confirmStaffEmailChange
);

module.exports = router;
