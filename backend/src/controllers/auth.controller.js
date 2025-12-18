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
   STAFF LOGIN (ADMIN + INCHARGE)
====================== */

exports.staffLogin = async (req, res) => {
  const { email, password } = req.body;

  const staff = await Staff.findOne({
    email,
    role: { $in: ['admin', 'incharge'] }
  }).select('+password');

  if (!staff || !(await bcrypt.compare(password, staff.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: staff._id, role: staff.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  staff.last_login = new Date();
  await staff.save();

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
  if (!student.is_verified) {
  return res.status(403).json({ error: 'Email not verified' });
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

// student account creation


exports.registerStudent = async (req, res) => {
  try {
    const { name, reg_no, email, password } = req.body;

    const exists = await Student.findOne({
      $or: [{ reg_no }, { email }]
    });

    if (exists) {
      return res.status(400).json({ error: 'Student already exists' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const student = await Student.create({
      name,
      reg_no,
      email,
      password: await bcrypt.hash(password, 10),
      email_verification_token: verificationToken
    });

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await sendMail({
      to: email,
      subject: 'Verify your IoT Lab Account',
      html: `
        <p>Click the link below to verify your account:</p>
        <a href="${verifyLink}">Verify Email</a>
      `
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Verify email to login.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.verifyStudentEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const student = await Student.findOne({
      email_verification_token: token
    }).select('+email_verification_token');

    if (!student) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    student.is_verified = true;
    student.email_verification_token = undefined;

    await student.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.studentForgotPassword = async (req, res) => {
  const { email } = req.body;

  const student = await Student.findOne({ email });
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  student.reset_otp = crypto.createHash('sha256').update(otp).digest('hex');
  student.reset_otp_expiry = Date.now() + 10 * 60 * 1000;

  await student.save();

  await sendMail({
    to: email,
    subject: 'Student Password Reset OTP',
    html: `<p>Your OTP is <b>${otp}</b>. Valid for 10 minutes.</p>`
  });

  res.json({ message: 'OTP sent to email' });
};


exports.studentResetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const student = await Student.findOne({
    email,
    reset_otp: hashedOtp,
    reset_otp_expiry: { $gt: Date.now() }
  }).select('+reset_otp');

  if (!student) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  student.password = await bcrypt.hash(new_password, 10);
  student.reset_otp = undefined;
  student.reset_otp_expiry = undefined;

  await student.save();

  res.json({ message: 'Password reset successful' });
};


// incharge reset password

exports.inchargeForgotPassword = async (req, res) => {
  const { email } = req.body;

  const incharge = await Staff.findOne({ email, role: 'incharge' });
  if (!incharge) {
    return res.status(404).json({ error: 'In-charge not found' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  incharge.reset_otp = crypto.createHash('sha256').update(otp).digest('hex');
  incharge.reset_otp_expiry = Date.now() + 10 * 60 * 1000;

  await incharge.save();

  await sendMail({
    to: email,
    subject: 'In-charge Password Reset OTP',
    html: `<p>Your OTP is <b>${otp}</b>. Valid for 10 minutes.</p>`
  });

  res.json({ message: 'OTP sent to email' });
};

exports.inchargeResetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const incharge = await Staff.findOne({
    email,
    role: 'incharge',
    reset_otp: hashedOtp,
    reset_otp_expiry: { $gt: Date.now() }
  }).select('+reset_otp');

  if (!incharge) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  incharge.password = await bcrypt.hash(new_password, 10);
  incharge.reset_otp = undefined;
  incharge.reset_otp_expiry = undefined;

  await incharge.save();

  res.json({ message: 'Password reset successful' });
};
