require('dotenv').config(); // This line MUST be at the very top of your file

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const pool = require('./db');
const cors = require('cors'); // Import cors
const cookieParser = require('cookie-parser'); // Import cookie-parser

const app = express();
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser middleware
app.use(cors({ // Enable CORS for all routes
  origin: ['http://localhost:3000', 'https://attendance.unitedsolutionsplus.in'], // Replace with your frontend domain in production
  credentials: true,
}));

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Middleware to authenticate JWT token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Ensure process.env.JWT_SECRET is actually loaded here
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT decoded:', { id: decoded.id, role: decoded.role });
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Middleware to check if user is an admin
const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin rights required.' });
  }
};

// User Registration
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, employee_id, role, shift_type } = req.body;

    if (!name || !email || !password || !employee_id || !role || !shift_type) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, employee_id, role, shift_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, employee_id, role, shift_type',
      [name, email, hashedPassword, employee_id, role, shift_type]
    );
    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique violation code for PostgreSQL
      return res.status(409).json({ message: 'Employee ID or Email already exists.' });
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// User Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    // Explicitly ensure password_hash is a non-empty string before comparing
    if (typeof user.password_hash !== 'string' || !user.password_hash.trim()) {
      console.error('Login error: password_hash is not a valid string or is empty for user:', user.email);
      return res.status(400).json({ message: 'Invalid credentials.' });
    }
    
    // Ensure process.env.JWT_SECRET is actually loaded here for signing
    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
        console.error('JWT or Refresh Token secret is not defined in environment variables.');
        return res.status(500).json({ message: 'Server configuration error: JWT secrets missing.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token (e.g., in a secure, httpOnly cookie or database)
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 7 * 24 * 60 * 60 * 1000 }); // Changed SameSite to 'Lax'

    res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, employee_id: user.employee_id, shift_type: user.shift_type } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Token Refresh
app.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken; // Assuming refresh token is in an httpOnly cookie
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  try {
    // Ensure process.env.REFRESH_TOKEN_SECRET is actually loaded here
    if (!process.env.REFRESH_TOKEN_SECRET) {
        console.error('REFRESH_TOKEN_SECRET is not defined in environment variables.');
        return res.status(500).json({ message: 'Server configuration error: Refresh Token secret missing.' });
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const { rows } = await pool.query('SELECT id, name, email, role, employee_id, shift_type FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }
    const user = rows[0];
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ accessToken: newAccessToken, user });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
});

// User Logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' }); // Changed SameSite to 'Lax'
  res.json({ message: 'Logged out successfully.' });
});

// Change Password
app.post('/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password.' });
  }
});


// Check-in
app.post('/attendance/checkin', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const checkinTime = moment().tz('Asia/Kolkata').format('HH:mm:ss');
    const userShiftType = req.user.shift_type;

    // Check if user already checked in today
    const existingAttendance = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (existingAttendance.rows.length > 0) {
      return res.status(400).json({ message: 'Already checked in today.' });
    }

    let status = 'present';
    const checkinMoment = moment().tz('Asia/Kolkata');
    let expectedCheckinHour;
    if (userShiftType === 'evening') {
      expectedCheckinHour = 21; // 9 PM
    } else {
      expectedCheckinHour = 9; // 9 AM
    }

    if (checkinMoment.hour() > expectedCheckinHour || (checkinMoment.hour() === expectedCheckinHour && checkinMoment.minute() > 0)) {
      status = 'late';
    }

    const result = await pool.query(
      'INSERT INTO attendance (user_id, date, check_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, today, checkinTime, status]
    );
    res.status(201).json({ message: 'Check-in successful!', data: result.rows[0] });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Server error during check-in.' });
  }
});

// Check-out
app.post('/attendance/checkout', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const checkoutTime = moment().tz('Asia/Kolkata').format('HH:mm:ss');

    const result = await pool.query(
      'UPDATE attendance SET check_out = $1 WHERE user_id = $2 AND date = $3 AND check_out IS NULL RETURNING *',
      [checkoutTime, userId, today]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'No active check-in found for today or already checked out.' });
    }
    res.json({ message: 'Check-out successful!', data: result.rows[0] });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Server error during check-out.' });
  }
});

// Get User Attendance
app.get('/attendance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error getting attendance.' });
  }
});

// Get all attendance corrections (admin only)
app.get('/attendance/corrections', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only.' });
    }

    const result = await pool.query(
      'SELECT * FROM corrections ORDER BY created_at DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all corrections:', error);
    res.status(500).json({ message: 'Server error fetching corrections.' });
  }
});


// Request Attendance Correction
app.post('/attendance/correction-request', authenticate, async (req, res) => {
  try {
    const { date, reason } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const employeeId = req.user.employee_id;

    // Check if a correction request for this date already exists and is pending
    const existingRequest = await pool.query(
      'SELECT * FROM corrections WHERE user_id = $1 AND date = $2 AND status = $3', 
      [userId, date, 'pending']
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ message: 'A pending correction request for this date already exists.' });
    }

    const result = await pool.query(
      'INSERT INTO corrections (user_id, user_name, employee_id, date, reason, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, userName, employeeId, date, reason, 'pending']
    );
    res.status(201).json({ message: 'Correction request submitted successfully!', data: result.rows[0] });
  } catch (error) {
    console.error('Correction request error:', error);
    res.status(500).json({ message: 'Server error submitting correction request.' });
  }
});

// Get User's Own Correction Requests
app.get('/attendance/corrections/user', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      'SELECT * FROM corrections WHERE user_id = $1 ORDER BY date DESC, status ASC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get user corrections error:', error);
    res.status(500).json({ message: 'Server error getting user corrections.' });
  }
  console.log("✅ /attendance/corrections/user route registered");
});


// Apply Leave
app.post('/leaves/apply', authenticate, async (req, res) => {
  try {
    const { from_date, to_date, reason } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const employeeId = req.user.employee_id;

    if (!moment(from_date).isValid() || !moment(to_date).isValid() || moment(from_date).isAfter(moment(to_date))) {
      return res.status(400).json({ message: 'Invalid date range provided.' });
    }

    const result = await pool.query(
      'INSERT INTO leaves (user_id, user_name, employee_id, from_date, to_date, reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, userName, employeeId, from_date, to_date, reason, 'pending']
    );
    res.status(201).json({ message: 'Leave application submitted!', data: result.rows[0] });
  } catch (error) {
    console.error('Leave application error:', error);
    res.status(500).json({ message: 'Server error submitting leave application.' });
  }
});

// Get User Leaves
app.get('/leaves', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      'SELECT * FROM leaves WHERE user_id = $1 ORDER BY from_date DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error getting leaves.' });
  }
});

// Request Leave Cancellation (Employee)
app.post('/leaves/cancel-request', authenticate, async (req, res) => {
  try {
    const { leave_id } = req.body;
    const userId = req.user.id;

    const { rows } = await pool.query('SELECT * FROM leaves WHERE id = $1 AND user_id = $2', [leave_id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found or you do not have permission.' });
    }

    const leave = rows[0];

    // Only allow cancellation request for 'approved' leaves
    if (leave.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved leaves can be requested for cancellation.' });
    }

    // Check if a cancellation request is already pending
    if (leave.status === 'cancellation_pending') {
      return res.status(400).json({ message: 'Cancellation request for this leave is already pending.' });
    }

    await pool.query('UPDATE leaves SET status = $1 WHERE id = $2', ['cancellation_pending', leave_id]);
    res.json({ message: 'Leave cancellation request submitted successfully.' });
  } catch (error) {
    console.error('Leave cancellation request error:', error);
    res.status(500).json({ message: 'Server error processing cancellation request.' });
  }
});

// Update Leave Dates (Drag and Drop in Calendar)
app.put('/leaves/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.body;
    const userId = req.user.id;

    // Optional: Add validation to ensure the user owns the leave or is an admin
    const { rows } = await pool.query('SELECT user_id FROM leaves WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave not found.' });
    }
    if (rows[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to update this leave.' });
    }

    if (!moment(from_date).isValid() || !moment(to_date).isValid() || moment(from_date).isAfter(moment(to_date))) {
      return res.status(400).json({ message: 'Invalid date range provided for update.' });
    }

    await pool.query(
      'UPDATE leaves SET from_date = $1, to_date = $2 WHERE id = $3',
      [from_date, to_date, id]
    );
    res.json({ message: 'Leave dates updated successfully.' });
  } catch (error) {
    console.error('Error updating leave dates:', error);
    res.status(500).json({ message: 'Server error updating leave dates.' });
  }
});


// Get Holidays
app.get('/holidays', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || moment().tz('Asia/Kolkata').year();

    const { rows } = await pool.query('SELECT * FROM holidays WHERE EXTRACT(YEAR FROM date)=$1 ORDER BY date', [targetYear]);
    res.json(rows);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ message: 'Server error getting holidays.' });
  }
});

// Admin Controller Routes (using adminController for now, but extending functionality here)

// Admin: Register a new employee (only for admins)
app.post('/admin/register-employee', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { name, email, password, employee_id, role, shift_type } = req.body;

    if (!name || !email || !password || !employee_id || !role || !shift_type) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, employee_id, role, shift_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, employee_id, role, shift_type',
      [name, email, hashedPassword, employee_id, role, shift_type]
    );
    res.status(201).json({ message: 'Employee registered successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Admin registration error:', error);
    if (error.code === '23505') { // Unique violation code for PostgreSQL
      return res.status(409).json({ message: 'Employee ID or Email already exists.' });
    }
    res.status(500).json({ message: 'Server error during employee registration.' });
  }
});


// Admin: Get all correction requests
app.get('/admin/attendance/corrections', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ac.*, u.name as user_name, u.employee_id
      FROM corrections ac
      JOIN users u ON ac.user_id = u.id
      ORDER BY ac.date DESC, ac.status ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Admin get all corrections error:', error);
    res.status(500).json({ message: 'Server error getting all corrections.' });
  }
});


// Admin: Review attendance correction (approve/reject)
app.post('/admin/attendance/correction-review', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { id, status } = req.body;
    const adminName = req.user.name; 

    if (!id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid correction ID or status.' });
    }

    const { rows } = await pool.query('SELECT * FROM corrections WHERE id=$1', [id]);     if (rows.length === 0) {
      return res.status(404).json({ message: 'Correction request not found.' });
    }

    const correction = rows[0];
    if (correction.status !== 'pending') {
      return res.status(400).json({ message: 'Correction request already processed.' });
    }

    await pool.query(
      'UPDATE corrections SET status=$1, assigned_admin_name=$2 WHERE id=$3',
      [status, adminName, id]
    );

    // If approved, create or update attendance record
    if (status === 'approved') {
      const { user_id, date } = correction;
      const userResult = await pool.query('SELECT shift_type FROM users WHERE id = $1', [user_id]);
      const userShiftType = userResult.rows[0].shift_type;

      // Construct time strings in HH:mm:ss format for check_in and check_out
      const correctedDateMoment = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

      let defaultCheckIn;
      let defaultCheckOut;

      if (userShiftType === 'evening') {
        defaultCheckIn = moment(correctedDateMoment).hour(21).minute(0).second(0).format('HH:mm:ss'); // 9 PM IST
        defaultCheckOut = moment(correctedDateMoment).add(1, 'day').hour(5).minute(0).second(0).format('HH:mm:ss'); // 5 AM IST next day
      } else {
        defaultCheckIn = moment(correctedDateMoment).hour(9).minute(0).second(0).format('HH:mm:ss'); // 9 AM IST
        defaultCheckOut = moment(correctedDateMoment).hour(17).minute(0).second(0).format('HH:mm:ss'); // 5 PM IST
      }

      await pool.query(
        'INSERT INTO attendance (user_id, date, check_in, check_out, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, date) DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, status = EXCLUDED.status',
        [user_id, date, defaultCheckIn, defaultCheckOut, 'present']
      );

      // --- NEW LOGIC: Update overlapping approved leave records ---
      await pool.query(
          `UPDATE leaves
           SET status = 'overridden_by_correction', assigned_admin_name = $1
           WHERE user_id = $2
             AND $3 BETWEEN from_date AND to_date
             AND status = 'approved'`, // Only affect approved leaves
          [adminName, user_id, date]
      );
      // --- END NEW LOGIC ---
    }
    res.json({ message: `Correction request ${status}.` });
  } catch (error) {
    console.error('Correction review error:', error);
    res.status(500).json({ message: 'Server error processing correction: ' + error.message }); // More detailed error
  }
});

// Admin: Get all leave requests
app.get('/admin/leaves', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, u.name as user_name, u.employee_id
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.from_date DESC, l.status ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Admin get all leaves error:', error);
    res.status(500).json({ message: 'Server error getting all leaves.' });
  }
});

// Admin: Update leave status (approve/reject for initial application)
app.post('/admin/leaves/update', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { leave_id, status } = req.body;
    const adminName = req.user.name;

    if (!leave_id || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid leave ID or status.' });
    }

    const { rows } = await pool.query('SELECT * FROM leaves WHERE id=$1', [leave_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const leave = rows[0];
    // Only allow update if the current status is 'pending' and not a cancellation request
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave request already processed or is a cancellation request.' });
    }

    await pool.query(
      'UPDATE leaves SET status=$1, assigned_admin_name=$2 WHERE id=$3',
      [status, adminName, leave_id]
    );
    res.json({ message: `Leave request ${status}.` });
  } catch (error) {
    console.error('Leave approval error:', error);
    res.status(500).json({ message: 'Server error processing leave.' });
  }
});

// Admin: Update leave cancellation status
app.post('/admin/leaves/update-cancellation', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { leave_id, status } = req.body;
    const adminName = req.user.name;

    if (!leave_id || !['cancellation_approved', 'cancellation_rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid leave ID or cancellation status.' });
    }

    const { rows } = await pool.query('SELECT * FROM leaves WHERE id=$1', [leave_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const leave = rows[0];

    // Ensure it's a pending cancellation request
    if (leave.status !== 'cancellation_pending') {
      return res.status(400).json({ message: 'Not a pending cancellation request.' });
    }

    let finalStatus = leave.status;
    if (status === 'cancellation_approved') {
      finalStatus = 'cancelled';
    } else if (status === 'cancellation_rejected') {
      // If cancellation is rejected, revert to the previous approved status
      finalStatus = 'approved';
    }

    await pool.query(
      'UPDATE leaves SET status=$1, assigned_admin_name=$2 WHERE id=$3',
      [finalStatus, adminName, leave_id]
    );
    res.json({ message: `Leave cancellation ${status.replace('cancellation_', '')}.` });
  } catch (error) {
    console.error('Leave cancellation update error:', error);
    res.status(500).json({ message: 'Server error processing leave cancellation.' });
  }
});


// Admin: Get daily attendance for all employees
app.get('/admin/attendance/daily', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    // Fetch all active users
    const usersResult = await pool.query('SELECT id, name, employee_id, shift_type FROM users');
    const allUsers = usersResult.rows;

    // Fetch attendance for the target date
    const attendanceResult = await pool.query(
      'SELECT user_id, check_in, check_out, status FROM attendance WHERE date = $1',
      [targetDate]
    );
    const dailyAttendanceMap = new Map();
    attendanceResult.rows.forEach(att => {
      dailyAttendanceMap.set(att.user_id, att);
    });

    // Fetch leaves for the target date
    // Modified: Include 'overridden_by_correction' in the WHERE clause so these are explicitly skipped
    const leavesResult = await pool.query(
      `SELECT user_id, status FROM leaves WHERE $1 BETWEEN from_date AND to_date AND status IN ('approved', 'overridden_by_correction')`,
      [targetDate]
    );
    const dailyLeavesMap = new Map();
    leavesResult.rows.forEach(leave => {
      dailyLeavesMap.set(leave.user_id, leave);
    });

    // Determine status for each user
    const detailedAttendance = allUsers.map(user => {
      const attendanceRecord = dailyAttendanceMap.get(user.id);
      const leaveRecord = dailyLeavesMap.get(user.id); // This will include overridden leaves

      let status = 'absent'; // Default to absent
      let check_in = null;
      let check_out = null;

      if (attendanceRecord) {
        // If there's an attendance record, prioritize it
        status = String(attendanceRecord.status || 'unknown');
        check_in = attendanceRecord.check_in;
        check_out = attendanceRecord.check_out;
      } else if (leaveRecord && leaveRecord.status === 'approved') {
        status = 'on_leave'; // Custom status for approved leaves, not overridden
      } else if (leaveRecord && leaveRecord.status === 'overridden_by_correction') {
        // If there's an overridden leave, it means attendance was applied via correction
        // This case should ideally not be reached if attendanceRecord is already checked first.
        // But adding for robustness.
        status = 'present_by_correction'; // Indicate attendance due to correction
      }

      return {
        user_id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        shift_type: user.shift_type,
        status: String(status || 'unknown').replace(/_/g, ' ').toUpperCase(), // Ensure 'status' is a string before calling replace
        check_in: check_in ? moment(check_in, 'HH:mm:ss').format('hh:mm A') : null,
        check_out: check_out ? moment(check_out, 'HH:mm:ss').format('hh:mm A') : null,
      };
    });

    res.json(detailedAttendance);
  } catch (error) {
    console.error('Admin get daily attendance error:', error);
    res.status(500).json({ message: 'Server error getting daily attendance.' });
  }
});

// Admin: Get monthly summary (present days, leave days)
app.get('/admin/analytics/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { year, month } = req.query;
    console.log(`Analytics request for Year: ${year}, Month: ${month}`); // Added log
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required.' });
    }

    // Correct moment construction for year/month
    const startDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).startOf('month');
    const endDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).endOf('month');
    console.log(`Calculated Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`); // Added log


    // Fetch all users
    const usersResult = await pool.query('SELECT id, name, employee_id FROM users');
    const allUsers = usersResult.rows;
    console.log(`Found ${allUsers.length} users for analytics.`); // Added log

    const monthlySummary = [];

    for (const user of allUsers) {
      let presentDays = 0;
      let leaveDays = 0;

      // Count present/late days from attendance
      const attendanceCountResult = await pool.query(
        `SELECT COUNT(DISTINCT date) FROM attendance WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND (status = 'present' OR status = 'late')`,
        [user.id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
      );
      presentDays = parseInt(attendanceCountResult.rows[0].count, 10);

      // Count approved leave days - EXCLUDING those overridden by correction
      const leaveCountResult = await pool.query(
        `SELECT
           SUM(CASE
             WHEN from_date <= $3 AND to_date >= $2
             THEN LEAST($3, to_date) - GREATEST($2, from_date) + 1
             ELSE 0 -- Explicitly return 0 if no overlap to prevent NULL from SUM
           END) as total_leave_days
         FROM leaves
         WHERE user_id = $1
           AND status = 'approved' -- Only count explicitly approved leaves (not cancelled or overridden)
           AND (from_date <= $3 AND to_date >= $2)`,
        [user.id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
      );
      // Ensure total_leave_days is a number, default to 0 if null
      leaveDays = parseInt(leaveCountResult.rows[0].total_leave_days || 0, 10);

      console.log(`User ${user.name} (ID: ${user.employee_id}): Present Days = ${presentDays}, Leave Days = ${leaveDays}`); // Added log

      monthlySummary.push({
        user_id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        present_days: presentDays,
        leave_days: leaveDays,
      });
    }

    console.log('Final Monthly Summary:', monthlySummary); // Added log
    res.json(monthlySummary);
  } catch (error) {
    console.error('Admin get monthly summary error:', error);
    res.status(500).json({ message: 'Server error getting monthly summary.' });
  }
});


// Admin: Export attendance data to CSV (modified for per-employee filtering)
app.get('/admin/attendance/export', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { year, month, employee_id, employee_name } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required for export.' });
    }

    let userId = null;
    let empIdForHeader = ''; // For the header if employee_id is used
    let userNameForHeader = 'All Employees'; // For the header if no specific employee

    // Find user by employee_id or employee_name if provided
    if (employee_id) {
      const userResult = await pool.query('SELECT id, name, employee_id FROM users WHERE employee_id = $1', [employee_id]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        userNameForHeader = userResult.rows[0].name;
        empIdForHeader = userResult.rows[0].employee_id;
      } else {
        return res.status(404).json({ message: 'Employee ID not found.' });
      }
    } else if (employee_name) {
      const userResult = await pool.query('SELECT id, name, employee_id FROM users WHERE name ILIKE $1', [`%${employee_name}%`]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        userNameForHeader = userResult.rows[0].name;
        empIdForHeader = userResult.rows[0].employee_id; // Get employee_id for header
      } else {
        return res.status(404).json({ message: 'Employee name not found.' });
      }
    }

    // Correct moment construction for year/month
    const startDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).startOf('month');
    const endDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).endOf('month');

    // Fetch attendance records for the specified period and user (if applicable)
    let attendanceQuery = `SELECT * FROM attendance WHERE date BETWEEN $1 AND $2`;
    // Modified: Fetch only leaves that are explicitly 'approved' and not 'overridden_by_correction'
    let leaveQuery = `SELECT * FROM leaves WHERE status = 'approved' AND (from_date <= $2 AND to_date >= $1)`;
    let holidayQuery = `SELECT * FROM holidays WHERE date BETWEEN $1 AND $2`;

    const baseParams = [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')];
    const paramsWithUser = [...baseParams];

    if (userId) {
      attendanceQuery += ` AND user_id = $3`;
      leaveQuery += ` AND user_id = $3`;
      paramsWithUser.push(userId);
    }

    const attendanceResults = await pool.query(attendanceQuery, userId ? paramsWithUser : baseParams);
    const leaveResults = await pool.query(leaveQuery, userId ? paramsWithUser : baseParams);
    const holidayResults = await pool.query(holidayQuery, baseParams);

    const attendanceMap = new Map(); // date -> { check_in, check_out, status }
    attendanceResults.rows.forEach(row => {
      attendanceMap.set(moment(row.date).tz('Asia/Kolkata').format('YYYY-MM-DD'), row);
    });

    const leaveDaysMap = new Map(); // date -> { reason }
    leaveResults.rows.forEach(leave => {
      let currentDay = moment(leave.from_date).tz('Asia/Kolkata').startOf('day');
      const toDate = moment(leave.to_date).tz('Asia/Kolkata').startOf('day');
      while (currentDay.isSameOrBefore(toDate)) {
        if (currentDay.isBetween(startDate.clone().startOf('day'), endDate.clone().startOf('day'), null, '[]')) {
          leaveDaysMap.set(currentDay.format('YYYY-MM-DD'), leave.reason);
        }
        currentDay.add(1, 'day');
      }
    });

    const holidaysMap = new Map(); // date -> name
    holidayResults.rows.forEach(holiday => {
      holidaysMap.set(moment(holiday.date).tz('Asia/Kolkata').format('YYYY-MM-DD'), holiday.name);
    });

    let csvContent = `Date,Day of Week,Status,Check-in Time,Check-out Time,Leave Reason,Holiday Name\n`;

    let currentDay = startDate.clone();
    while (currentDay.isSameOrBefore(endDate)) {
      const dateFormatted = currentDay.format('YYYY-MM-DD');
      const dayOfWeek = currentDay.format('dddd');
      let status = 'Absent';
      let checkIn = '';
      let checkOut = '';
      let leaveReason = '';
      let holidayName = '';

      if (holidaysMap.has(dateFormatted)) {
        status = 'Holiday';
        holidayName = holidaysMap.get(dateFormatted);
      } else if (leaveDaysMap.has(dateFormatted)) {
        status = 'On Leave';
        leaveReason = leaveDaysMap.get(dateFormatted);
      } else if (attendanceMap.has(dateFormatted)) {
        const att = attendanceMap.get(dateFormatted);
        status = String(att.status || 'unknown') === 'present' ? 'Present' : (String(att.status || 'unknown') === 'late' ? 'Late' : 'Other');
        checkIn = att.check_in ? moment(att.check_in, 'HH:mm:ss').format('hh:mm A') : '';
        checkOut = att.check_out ? moment(att.check_out, 'HH:mm:ss').format('hh:mm A') : '';
      }

      csvContent += `${dateFormatted},${dayOfWeek},${status},"${checkIn}","${checkOut}","${leaveReason}","${holidayName}"\n`;
      currentDay.add(1, 'day');
    }

    // Add a header row for the employee name if a specific employee was selected
    let header = '';
    if (userId) {
      header = `Employee Name: ${userNameForHeader} (ID: ${empIdForHeader || 'N/A'})\nMonth: ${moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).format('MMMM')}\n\n`;
    } else {
      header = `Attendance Report for All Employees\nMonth: ${moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).format('MMMM')}\n\n`;
    }
    csvContent = header + csvContent;

    res.header('Content-Type', 'text/csv');
    // Ensure filename is safe and uses correct employee name/id if filtered
    const filenameSuffix = userId ? `${userNameForHeader.replace(/\s/g, '_')}_${empIdForHeader || ''}` : 'AllEmployees';
    res.attachment(`attendance_report_${filenameSuffix}_${year}_${month}.csv`);
    return res.send(csvContent);

  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ message: 'Server error exporting attendance data.' });
  }
});

// Admin: Get total employee count
app.get('/admin/employees/count', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const totalEmployeesResult = await pool.query(`SELECT COUNT(*) AS total_employees FROM users WHERE role = 'employee'`);
    const totalAdminsResult = await pool.query(`SELECT COUNT(*) AS total_admins FROM users WHERE role = 'admin'`);

    res.json({
      total_employees: parseInt(totalEmployeesResult.rows[0].total_employees, 10),
      total_admins: parseInt(totalAdminsResult.rows[0].total_admins, 10)
    });
  } catch (error) {
    console.error('Error fetching employee counts:', error);
    res.status(500).json({ message: 'Server error fetching employee counts.' });
  }
});

// Admin: Get pending leaves count
app.get('/admin/leaves/pending-count', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*) AS pending_leaves FROM leaves WHERE status = 'pending'`);
    res.json({ pending_leaves: parseInt(result.rows[0].pending_leaves, 10) });
  } catch (error) {
    console.error('Error fetching pending leaves count:', error);
    res.status(500).json({ message: 'Server error fetching pending leaves count.' });
  }
});

// Admin: Get pending corrections count
app.get('/admin/corrections/pending-count', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*) AS pending_corrections FROM corrections WHERE status = 'pending'`);
    res.json({ pending_corrections: parseInt(result.rows[0].pending_corrections, 10) });
  } catch (error) {
    console.error('Error fetching pending corrections count:', error);
    res.status(500).json({ message: 'Server error fetching pending corrections count.' });
  }
});


// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
