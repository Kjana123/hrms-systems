
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const cookieParser = require('cookie-parser');

const app = express();

console.log('Environment variables:', {
  DATABASE_URL: process.env.DATABASE_URL ? '[Set]' : '[Missing]',
  JWT_SECRET: process.env.JWT_SECRET ? '[Set]' : '[Missing]',
  REFRESH_SECRET: process.env.REFRESH_SECRET ? '[Set]' : '[Missing]',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '[Set]' : '[Missing]',
  CRON_API_KEY: process.env.CRON_API_KEY ? '[Set]' : '[Missing]',
  FRONTEND_URL: process.env.FRONTEND_URL,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const allowedOrigins = [
  'http://localhost:3000',
  'https://hrms-systems.onrender.com',
  'https://attendance.unitedsolutionsplus.in',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

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

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, shift_type } = req.body;

    if (!name || !email || !password || !role || !shift_type) {
      return res.status(400).json({ message: 'Name, email, password, role, and shift_type are required.' });
    }

    if (!['employee', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be "employee" or "admin".' });
    }

    if (!['day', 'evening'].includes(shift_type)) {
      return res.status(400).json({ message: 'Shift_type must be "day" or "evening".' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role, shift_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, shift_type',
      [name, email, hashed, role, shift_type]
    );

    console.log('User registered:', { id: rows[0].id, email });
    res.status(201).json({ message: 'User registered successfully.', user: rows[0] });
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
    console.log('Login request:', { email });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log('🔑 Password match:', match);

    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log('🧍 User logged in:', { id: user.id, email: user.email });
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shift_type: user.shift_type },
    });
  } catch (error) {
    console.error('🔥 User login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    if (!process.env.REFRESH_SECRET) {
      console.error('REFRESH_SECRET is not defined!');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const { rows } = await pool.query('SELECT id, role, shift_type FROM users WHERE id=$1', [decoded.id]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired.' });
    }
    return res.status(401).json({ message: 'Invalid refresh token.' });
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ message: 'Logged out successfully.' });
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
    console.log('Generated reset token:', resetToken, 'expires at:', expiresAt);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3',
      [user.id, resetToken, expiresAt]
    );
    console.log('Reset token saved for user_id:', user.id);

    const frontendUrl = process.env.FRONTEND_URL || 'https://attendance.unitedsolutionsplus.in';
    const resetLink = `${frontendUrl}/?view=resetPassword&token=${resetToken}`;
    console.log('Reset link:', resetLink);

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
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
    res.status(200).json({ message: 'If a matching account is found, a password reset link has been sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error during password reset request.', error: error.message });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    console.log('Reset password request with token:', token);
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    const { rows } = await pool.query(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token=$1',
      [token]
    );
    const resetRecord = rows[0];

    if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
      console.log('Invalid or expired token:', token);
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password=$1 WHERE id=$2',
      [hashed, resetRecord.user_id]
    );
    console.log('Password updated for user_id:', resetRecord.user_id);

    await pool.query('DELETE FROM password_reset_tokens WHERE token=$1', [token]);
    console.log('Reset token deleted:', token);

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error during password reset.', error: error.message });
  }
});

app.get('/auth/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    console.log('Validating reset token:', token);
    if (!token) {
      return res.status(400).json({ message: 'Token is required.' });
    }

    const { rows } = await pool.query(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token=$1',
      [token]
    );
    const resetRecord = rows[0];

    if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
      console.log('Invalid or expired token:', token);
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    console.log('Token is valid for user_id:', resetRecord.user_id);
    res.status(200).json({ message: 'Token is valid.' });
  } catch (error) {
    console.error('Token validation error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error during token validation.', error: error.message });
  }
});

app.post('/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
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

app.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can view all users.' });
    }
    const { rows } = await pool.query('SELECT id, name, email, role, shift_type FROM users ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error getting users.' });
  }
});

app.put('/users/update', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can update user details.' });
    }
    const { user_id, name, email, role, shift_type } = req.body;

    if (!user_id || (!name && !email && !role && !shift_type)) {
      return res.status(400).json({ message: 'User ID and at least one field to update are required.' });
    }

    if (role && !['employee', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be "employee" or "admin".' });
    }

    if (shift_type && !['day', 'evening'].includes(shift_type)) {
      return res.status(400).json({ message: 'Shift_type must be "day" or "evening".' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name) {
      fields.push(`name = $${index++}`);
      values.push(name);
    }
    if (email) {
      fields.push(`email = $${index++}`);
      values.push(email);
    }
    if (role) {
      fields.push(`role = $${index++}`);
      values.push(role);
    }
    if (shift_type) {
      fields.push(`shift_type = $${index++}`);
      values.push(shift_type);
    }

    values.push(user_id);
    const queryText = `UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING id, name, email, role, shift_type`;
    const { rows } = await pool.query(queryText, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    console.log('User updated:', { id: rows[0].id, email: rows[0].email });
    res.json({ message: 'User updated successfully.', user: rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    res.status(500).json({ message: 'Server error updating user.' });
  }
});

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
    const date = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
    const now = moment.tz('Asia/Kolkata');
    const userId = req.user.id;

    const { rows: userRows } = await pool.query('SELECT shift_type FROM users WHERE id=$1', [userId]);
    const shiftType = userRows[0]?.shift_type || 'day';

    const shiftStart = shiftType === 'day'
      ? moment.tz(`${date} 09:00`, 'Asia/Kolkata')
      : moment.tz(`${date} 21:00`, 'Asia/Kolkata');

    const status = now.isAfter(shiftStart) ? 'Late' : 'Present';

    const result = await pool.query(
      `INSERT INTO attendance (user_id, date, check_in, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET check_in = CURRENT_TIMESTAMP, status = $3
       RETURNING *`,
      [userId, date, status]
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
    const date = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
    const { rows } = await pool.query(
      `UPDATE attendance
       SET check_out = CURRENT_TIMESTAMP,
           status = CASE
             WHEN status = 'Late' THEN 'Late'
             WHEN (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600) >= 8.5 THEN 'Present'
             ELSE 'Absent'
           END
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
    if (moment(date).isAfter(moment(), 'day')) {
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
            `UPDATE attendance SET status='Present' WHERE user_id=$1 AND date=$2`,
            [user_id, date]
          );
        } else {
          await pool.query(
            `INSERT INTO attendance (user_id, date, status) VALUES ($1, $2, 'Present')`,
            [user_id, date]
          );
        }
        console.log(`Attendance for user ${user_id} on ${date} set to 'Present' due to approved correction.`);
      }
    }

    res.status(200).json({ message: 'Correction reviewed successfully.' });
  } catch (error) {
    console.error('Correction review error:', error);
    res.status(500).json({ message: 'Server error reviewing correction.' });
  }
});

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
    if (moment(to_date).isBefore(moment(from_date))) {
      return res.status(400).json({ message: 'To date cannot be before from date.' });
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

app.get('/holidays', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM holidays ORDER BY date');
    res.json(rows);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ message: 'Server error getting holidays.' });
  }
});

app.get('/admin/attendance/export', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only admins can export attendance.' });
    }

    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required.' });
    }

    const startDate = moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').startOf('month').format('YYYY-MM-DD');
    const endDate = moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').endOf('month').format('YYYY-MM-DD');

    const { rows } = await pool.query(
      `SELECT a.user_id, u.name, u.email, u.shift_type, a.date, a.check_in, a.check_out, a.status
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.date BETWEEN $1 AND $2
       ORDER BY a.date, u.name`,
      [startDate, endDate]
    );

    const fields = [
      { label: 'User ID', value: 'user_id' },
      { label: 'Name', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'Shift Type', value: 'shift_type' },
      { label: 'Date', value: 'date' },
      { label: 'Check In', value: row => row.check_in ? moment(row.check_in).tz('Asia/Kolkata').format('HH:mm:ss') : '' },
      { label: 'Check Out', value: row => row.check_out ? moment(row.check_out).tz('Asia/Kolkata').format('HH:mm:ss') : '' },
      { label: 'Status', value: 'status' },
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`attendance_${year}_${month}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ message: 'Server error exporting attendance.' });
  }
});

app.post('/tasks/mark-forgotten-checkout-absent', async (req, res) => {
  try {
    if (req.headers['x-api-key'] !== process.env.CRON_API_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'days').format('YYYY-MM-DD');
    await pool.query(
      `UPDATE attendance
       SET status = 'Absent'
       WHERE date = $1 AND check_out IS NULL AND status != 'Late'`,
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
      to: 'test@example.com',
      subject: 'Test Email from HRMS',
      text: 'This is a test email from your HRMS application.',
    };
    await transporter.sendMail(mailOptions);
    console.log('Test email sent to test@example.com');
    res.status(200).json({ message: 'Test email sent.' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Failed to send test email.', error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on 0.0.0.0:${PORT}`));
