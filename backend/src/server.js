require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const startOverdueJob = require('./jobs/overdue.job');
const { verifyMail } = require('./config/mail');


connectDB();
verifyMail();
startOverdueJob();


const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.send('Backend OK'));


app.listen(5000, () => console.log('Server running on port 5000'));
