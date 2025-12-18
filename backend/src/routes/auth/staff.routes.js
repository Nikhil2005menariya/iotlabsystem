const express = require('express');
const router = express.Router();

// middlewares
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');

// controllers
const {
  staffLogin,
  adminLogin,
  forgotPassword,
  resetPassword,
  inchargeForgotPassword,
  inchargeResetPassword,
  requestStaffEmailChange,
  confirmStaffEmailChange,
} = require('../../controllers/auth.controller');

// ================= AUTH ROUTES =================

// Staff / Admin login
router.post('/login', staffLogin);
// If you have a separate admin login, uncomment this
// router.post('/admin/login', adminLogin);

// Password reset flows
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// In-charge password reset
router.post('/incharge/forgot-password', inchargeForgotPassword);
router.post('/incharge/reset-password', inchargeResetPassword);

// ================= PROTECTED ROUTES =================
// Admin + In-charge only

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
