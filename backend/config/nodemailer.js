// config/nodemailer.js
console.log(`[FILE_LOAD_CHECK] config/nodemailer.js loaded at ${new Date().toISOString()}`);

const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

module.exports = transporter;