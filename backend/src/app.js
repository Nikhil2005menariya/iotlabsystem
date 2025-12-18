const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('Backend OK');
});

app.use('/api', require('./routes'));

module.exports = app;
