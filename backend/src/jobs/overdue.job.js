const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendMail } = require('../services/mail.service');

/*
  Runs every day at 9 AM
  Cron format: min hour day month day-of-week
*/
const startOverdueJob = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('Running overdue transaction check');

    const today = new Date();

    const overdueTransactions = await Transaction.find({
      status: { $in: ['approved', 'active'] },
      expected_return_date: { $lt: today }
    });

    for (const txn of overdueTransactions) {
      // mark overdue if not already
      if (txn.status !== 'overdue') {
        txn.status = 'overdue';
        await txn.save();
      }

      const student = await Student.findById(txn.student_id);
      if (!student) continue;

      // prevent duplicate notifications
      const alreadySent = await Notification.findOne({
        transaction_id: txn.transaction_id,
        type: 'overdue'
      });

      if (alreadySent) continue;

      const subject = `Overdue Lab Components – Transaction ${txn.transaction_id}`;

      const message = `
        <p>Your lab transaction <b>${txn.transaction_id}</b> is overdue.</p>
        <p>Expected return date: ${txn.expected_return_date.toDateString()}</p>
        <p>Please return the components immediately.</p>
      `;

      // notify student
      await sendMail({
        to: student.email,
        subject,
        html: message
      });

      // notify faculty
      await sendMail({
        to: txn.faculty_email,
        subject,
        html: message
      });

      // log notification
      await Notification.create({
        type: 'overdue',
        recipient_email: `${student.email}, ${txn.faculty_email}`,
        transaction_id: txn.transaction_id
      });
    }
  });
};

module.exports = startOverdueJob;
