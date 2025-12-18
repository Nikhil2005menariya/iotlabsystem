const express = require('express');
const router = express.Router();
const {
  adminLogin,
  forgotPassword,
  resetPassword
} = require('../../controllers/auth.controller');

router.post('/login', adminLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
