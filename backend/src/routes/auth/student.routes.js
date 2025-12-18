const express = require('express');
const router = express.Router();
const {
  studentLogin
} = require('../../controllers/auth.controller');

router.post('/login', studentLogin);

module.exports = router;
