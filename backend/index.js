require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();

console.log('Environment variables:', {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: process.env.DB_PORT,
  DB_PASS: process.env.DB_PASS ? '[Set]' : '[Missing]',
  JWT_SECRET: process.env.JWT_SECRET ? '[Set]' : '[Missing]',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '[Set]' : '[Missing]',
  CRON_API_KEY: process.env.CRON_API_KEY ? '[Set]' : '[Missing]',
  FRONTEND_URL: process.env.FRONTEND_URL,
});

// ✅ Direct PostgreSQL pool setup using env vars
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }  // Required by Render PostgreSQL
});

// ✅ Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
    return;
  }
  console.log('✅ Database connected successfully');
  release();
});

module.exports = pool;

const transporter = nodemailer.createTransport({
  host: 'smtp.secureserver.net',
  port: 465,
  secure: true, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER, // info@unitedsolutionsplus.in
    pass: process.env.EMAIL_PASS  // Your GoDaddy email password
  }
});

const allowedOrigins = [
  'http://localhost:3000',
  'https://hrms-systems.onrender.com',
  'https://attendance.unitedsolutionsplus.in'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());


// JWT authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('No token provided for:', req.originalUrl);
    return res.status(401).json({ message: 'Authentication token missing.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined!');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT decoded:', { id: user.id, role: user.role });
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication token expired.' });
    }
    return res.status(403).json({ message: 'Invalid authentication token.' });
  }
}

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields (name, email, password, role) are required.' });
    }
   if (role !== 'employee' && role !== 'admin') {
  return res.status(400).json({ message: 'Role must be "employee" or "admin".' });
}

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      [name, email, hashed, role]
    );
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('User registration error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🛂 Login request body:", req.body);

const allUsers = await pool.query('SELECT * FROM users');
console.log("🧾 All users in DB:", allUsers.rows);

if (allUsers.rows.length) {
  const testUser = allUsers.rows.find(u => u.email === email);
  if (testUser) {
    const bcrypt = require('bcrypt');
    const match = await bcrypt.compare(password, testUser.password);
    console.log("🔑 Password match:", match);
  }
}


    console.log("Login request:", { email, password }); // ✅ ← THIS GOES HERE

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];

    if (!user) {
      console.log("❌ User not found");
    } else {
      console.log("✅ User found:", user.email);
      const match = await bcrypt.compare(password, user.password);
      console.log("🔑 Password match:", match);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined!');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ Login successful for:', user.email);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('🔥 User login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});



app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Forgot password request for:', email);
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const { rows } = await pool.query('SELECT id, name FROM users WHERE email=$1', [email]);
    const user = rows[0];

    if (!user) {
      console.log('No user found with email:', email);
      return res.status(200).json({ message: 'If a matching account is found, a password reset link has been sent to your email.' });
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3',
      [user.id, resetToken, expiresAt]
    );
    console.log('Reset token saved for user_id:', user.id, 'token:', resetToken);

    const frontendUrl = process.env.FRONTEND_URL || 'https://hrms-systems.onrender.com';
    const resetLink = `${frontendUrl}/?view=resetPassword&token=${resetToken}`;
    console.log('Reset link generated:', resetLink);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request for HRMS',
      html: `
        <p>Hello ${user.name},</p>
        <p>You have requested a password reset for your HRMS account.</p>
        <p>Please click on the following link to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>HRMS Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
    res.status(200).json({ message: 'If a matching account is found, a password reset link has been sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset request.', error: error.message });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    const { rows } = await pool.query(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token=$1',
      [token]
    );
    const resetRecord = rows[0];

    if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password=$1 WHERE id=$2',
      [hashed, resetRecord.user_id]
    );

    await pool.query('DELETE FROM password_reset_tokens WHERE token=$1', [token]);

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset.' });
  }
});

app.post('/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [userId]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Invalid current password.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password=$1 WHERE id=$2',
      [hashedNewPassword, userId]
    );

    res.status(200).json({ message: 'Password has been changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error during password change.' });
  }
});

// Attendance routes
app.get('/attendance', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM attendance WHERE user_id=$1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error getting attendance.' });
  }
});

app.post('/attendance/checkin', authenticate, async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      'INSERT INTO attendance (user_id, date, check_in) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id, date) DO UPDATE SET check_in = CURRENT_TIMESTAMP RETURNING *',
      [req.user.id, date]
    );
    console.log('Check-in recorded:', result.rows[0]);
    res.status(200).json({ message: 'Checked in successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Server error during check-in.' });
  }
});

app.post('/attendance/checkout', authenticate, async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `UPDATE attendance SET
         check_out = CURRENT_TIMESTAMP,
         status = CASE WHEN (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600) >= 8.5 THEN 'present' ELSE 'absent' END
       WHERE user_id=$1 AND date=$2 AND check_in IS NOT NULL AND check_out IS NULL
       RETURNING *`,
      [req.user.id, date]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'No valid check-in record found or already checked out.' });
    }
    console.log('Check-out recorded:', rows[0]);
    res.status(200).json({ message: 'Checked out successfully.', data: rows[0] });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Server error during check-out.' });
  }
});

app.get('/attendance/corrections', authenticate, async (req, res) => {
  try {
    let queryText;
    let queryParams;

    if (req.user.role === 'admin') {
      queryText = 'SELECT c.*, u.name as user_name FROM corrections c JOIN users u ON c.user_id = u.id ORDER BY created_at DESC';
      queryParams = [];
    } else {
      queryText = 'SELECT * FROM corrections WHERE user_id=$1 ORDER BY created_at DESC';
      queryParams = [req.user.id];
    }

    const { rows } = await pool.query(queryText, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Get corrections error:', error);
    res.status(500).json({ message: 'Server error getting corrections.' });
  }
});

app.post('/attendance/correction-request', authenticate, async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date || !reason) {
      return res.status(400).json({ message: 'Date and reason are required for correction request.' });
    }
    if (new Date(date) > new Date()) {
      return res.status(400).json({ message: 'Cannot request correction for a future date.' });
    }
    await pool.query(
      'INSERT INTO corrections (user_id, date, reason, status) VALUES ($1, $2, $3, $4)',
      [req.user.id, date, reason, 'pending']
    );
    res.status(201).json({ message: 'Correction request submitted successfully.' });
  } catch (error) {
    console.error('Correction request error:', error);
    res.status(500).json({ message: 'Server error submitting correction request.' });
  }
});

app.post('/attendance/correction-review', authenticate, async (req, res) => {
  try {
    const { id, status } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can review corrections.' });
    }
    if (!id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Correction ID and a valid status ("approved" or "rejected") are required.' });
    }

    await pool.query('UPDATE corrections SET status=$1 WHERE id=$2', [status, id]);

    if (status === 'approved') {
      const { rows: correctionRows } = await pool.query('SELECT user_id, date FROM corrections WHERE id=$1', [id]);
      if (correctionRows.length > 0) {
        const { user_id, date } = correctionRows[0];

        const { rows: attendanceRows } = await pool.query(
          'SELECT id FROM attendance WHERE user_id=$1 AND date=$2',
          [user_id, date]
        );

        if (attendanceRows.length > 0) {
          await pool.query(
            `UPDATE attendance SET status='present' WHERE user_id=$1 AND date=$2`,
            [user_id, date]
          );
        } else {
          await pool.query(
            `INSERT INTO attendance (user_id, date, status) VALUES ($1, $2, 'present')`,
            [user_id, date]
          );
        }
        console.log(`Attendance for user ${user_id} on ${date} set to 'present' due to approved correction.`);
      }
    }

    res.status(200).json({ message: 'Correction reviewed successfully.' });
  } catch (error) {
    console.error('Correction review error:', error);
    res.status(500).json({ message: 'Server error reviewing correction.' });
  }
});

// Leave routes
app.get('/leaves', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM leaves WHERE user_id=$1 ORDER BY from_date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error getting leave records.' });
  }
});

app.post('/leaves/apply', authenticate, async (req, res) => {
  try {
    const { from_date, to_date, reason } = req.body;
    if (!from_date || !to_date || !reason) {
      return res.status(400).json({ message: 'From date, to date, and reason are required for leave application.' });
    }
    await pool.query(
      'INSERT INTO leaves (user_id, from_date, to_date, reason, status) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, from_date, to_date, reason, 'pending']
    );
    res.status(201).json({ message: 'Leave application submitted successfully.' });
  } catch (error) {
    console.error('Leave application error:', error);
    res.status(500).json({ message: 'Server error submitting leave application.' });
  }
});

app.get('/admin/leaves', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can view all leave requests.' });
    }
    const { rows } = await pool.query(
      'SELECT leaves.*, users.name FROM leaves JOIN users ON leaves.user_id = users.id ORDER BY from_date DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Admin get leaves error:', error);
    res.status(500).json({ message: 'Server error getting all leave records.' });
  }
});

app.post('/admin/leaves/update', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can update leave requests.' });
    }
    const { leave_id, status } = req.body;
    if (!leave_id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Leave ID and a valid status ("approved" or "rejected") are required.' });
    }

    await pool.query('UPDATE leaves SET status=$1 WHERE id=$2', [status, leave_id]);
    res.status(200).json({ message: 'Leave request updated successfully.' });
  } catch (error) {
    console.error('Admin update leave error:', error);
    res.status(500).json({ message: 'Server error updating leave request.' });
  }
});

// Task routes
app.post('/tasks/mark-forgotten-checkout-absent', async (req, res) => {
  try {
    if (req.headers['x-api-key'] !== process.env.CRON_API_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
    await pool.query(
      `UPDATE attendance
       SET status = 'absent'
       WHERE date = $1 AND check_out IS NULL`,
      [yesterday]
    );
    console.log(`Marked forgotten check-outs for ${yesterday} as absent.`);
    res.status(200).json({ message: `Forgotten check-outs for ${yesterday} processed.` });
  } catch (error) {
    console.error('Error processing forgotten check-outs:', error);
    res.status(500).json({ message: 'Server error processing forgotten check-outs.' });
  }
});

app.get('/test-email', async (req, res) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'test@example.com', // Replace with your test email
      subject: 'Test Email from HRMS',
      text: 'This is a test email from your HRMS application.'
    };
    await transporter.sendMail(mailOptions);
    console.log('Test email sent to test@example.com');
    res.status(200).json({ message: 'Test email sent.' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Failed to send test email.', error: error.message });
  }
});

app.get('/auth/reset-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: 'Token is required.' });
    }

    const { rows } = await pool.query(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token=$1',
      [token]
    );
    const resetRecord = rows[0];

    if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    res.status(200).json({ message: 'Token is valid.' });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ message: 'Server error during token validation.' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(3001, '0.0.0.0', () => console.log("✅ Server running on 0.0.0.0:3001"));