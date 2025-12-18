const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Staff = require('../models/Staff');
const { sendMail } = require('../services/mail.service');
const Student = require('../models/Student');

/* ======================
   ADMIN LOGIN
====================== */

exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await Staff.findOne({ email, role: 'admin' }).select('+password');

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin._id, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  admin.last_login = new Date();
  await admin.save();

  res.json({ token });
};

/* ======================
   FORGOT PASSWORD (OTP)
====================== */

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const admin = await Staff.findOne({ email, role: 'admin' });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const otp = crypto.randomInt(100000, 999999).toString();

  admin.reset_otp = crypto.createHash('sha256').update(otp).digest('hex');
  admin.reset_otp_expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  await admin.save();

  await sendMail({
    to: email,
    subject: 'Admin Password Reset OTP',
    html: `<p>Your OTP is <b>${otp}</b>. Valid for 10 minutes.</p>`
  });

  res.json({ message: 'OTP sent to email' });
};

/* ======================
   VERIFY OTP & RESET
====================== */

exports.resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const admin = await Staff.findOne({
    email,
    reset_otp: hashedOtp,
    reset_otp_expiry: { $gt: Date.now() }
  }).select('+reset_otp');

  if (!admin) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  admin.password = await bcrypt.hash(new_password, 10);
  admin.reset_otp = undefined;
  admin.reset_otp_expiry = undefined;

  await admin.save();

  res.json({ message: 'Password reset successful' });
};


/* ======================
   STUDENT LOGIN
====================== */

exports.studentLogin = async (req, res) => {
  const { reg_no, password } = req.body;

  const student = await Student.findOne({ reg_no }).select('+password');
  if (!student) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await require('bcryptjs').compare(password, student.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = require('jsonwebtoken').sign(
    { id: student._id, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.json({ token });
};