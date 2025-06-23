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
  // Dynamically set origin based on environment and request origin
  origin: (origin, callback) => {
    // Allow requests with no origin (like file:// for local development or Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'https://attendance.unitedsolutionsplus.in',
      'http://127.0.0.1:8081' // Added this origin for local http-server
    ];

    // In development, also specifically allow 'null' origin for local file system access
    // and other potential local development origins.
    // Ensure this logic is only for development to prevent security risks in production.
    if (process.env.NODE_ENV !== 'production') {
        // Explicitly allow 'null' origin when running from file://
        if (origin === 'null') {
            return callback(null, true);
        }
    }

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Important for sending cookies and authorization headers
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
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(403).json({ message: 'Invalid token.' });
  }
};

// Middleware to check if user is admin
const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
};

// --- Auth Routes ---

// User Registration
app.post('/register', async (req, res) => {
  const { name, email, password, employee_id, role, shift_type } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, employee_id, role, shift_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, email, hashedPassword, employee_id, role || 'employee', shift_type || 'day']
    );
    res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
  } catch (err) {
    console.error('Error during registration:', err);
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(400).json({ message: 'Email already registered.' });
    }
    if (err.code === '23505' && err.constraint === 'users_employee_id_key') {
      return res.status(400).json({ message: 'Employee ID already exists.' });
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ✅ Login Route
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Logged in successfully',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        shift_type: user.shift_type
      }
    });

  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});


// Token Refresh
// ✅ Refresh Route
app.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND refresh_token = $2', [decoded.id, refreshToken]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }

    const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        shift_type: user.shift_type
      }
    });

  } catch (err) {
    console.error('Refresh error:', err);
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });
    res.status(403).json({ message: 'Failed to refresh token: ' + err.message });
  }
});



// User Logout
// ✅ Logout Route
app.post('/auth/logout', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });

    res.status(200).json({ message: 'Logged out successfully.' });

  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ message: 'Server error during logout.' });
  }
});

// Change Password
app.post('/auth/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password incorrect.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ message: 'Server error during password change.' });
    }
});

// Forgot Password - Send Reset Email
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const resetToken = jwt.sign({ id: user.id }, process.env.RESET_PASSWORD_SECRET, { expiresIn: '1h' });
        await pool.query('UPDATE users SET reset_token = $1 WHERE id = $2', [resetToken, user.id]);

        const resetUrl = `${process.env.FRONTEND_URL}/?view=resetPassword&token=${resetToken}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `<p>Dear ${user.name},</p>
                   <p>You requested a password reset. Click this link to reset your password:</p>
                   <a href="${resetUrl}">${resetUrl}</a>
                   <p>This link is valid for 1 hour.</p>
                   <p>If you did not request this, please ignore this email.</p>`
        });

        res.status(200).json({ message: 'Password reset link sent to your email.' });
    } catch (err) {
        console.error('Error sending reset password email:', err);
        res.status(500).json({ message: 'Server error sending reset password email.' });
    }
});

// Reset Password - Using Token
app.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND reset_token = $2', [decoded.id, token]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1, reset_token = NULL WHERE id = $2', [hashedNewPassword, user.id]);

        res.status(200).json({ message: 'Password has been reset.' });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ message: 'Server error resetting password.' });
    }
});


// --- Attendance Routes ---

// Check-in
app.post('/attendance/checkin', authenticate, async (req, res) => {
    const userId = req.user.id;
    const now = moment().tz('Asia/Kolkata');
    const date = now.format('YYYY-MM-DD');
    const checkinTime = now.format('HH:mm:ss');

    try {
        const userResult = await pool.query('SELECT shift_type FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const existingAttendance = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].check_in) {
            return res.status(400).json({ message: 'You have already checked in today.' });
        }

        let status = 'present';
        const expectedCheckinHour = user.shift_type === 'evening' ? 21 : 9; // 9 PM for evening, 9 AM for day

        // Create a moment object for expected check-in time on the current date
        const expectedCheckinTimeMoment = now.clone().hour(expectedCheckinHour).minute(0).second(0).millisecond(0);

        if (now.isAfter(expectedCheckinTimeMoment)) {
            status = 'late';
        }

        if (existingAttendance.rows.length > 0) {
            await pool.query(
                'UPDATE attendance SET check_in = $1, status = $2 WHERE user_id = $3 AND date = $4 RETURNING *',
                [checkinTime, status, userId, date]
            );
        } else {
            await pool.query(
                'INSERT INTO attendance (user_id, date, check_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
                [userId, date, checkinTime, status]
            );
        }

        res.status(200).json({ message: 'Checked in successfully!', data: { date, check_in: checkinTime, status } });
    } catch (err) {
        console.error('Error during check-in:', err);
        res.status(500).json({ message: 'Server error during check-in.' });
    }
});

// Check-out
app.post('/attendance/checkout', authenticate, async (req, res) => {
    const userId = req.user.id;
    const now = moment().tz('Asia/Kolkata');
    const date = now.format('YYYY-MM-DD');
    const checkoutTime = now.format('HH:mm:ss');

    try {
        const attendanceRecord = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [userId, date]
        );

        if (attendanceRecord.rows.length === 0) {
            return res.status(400).json({ message: 'You have not checked in today.' });
        }
        if (attendanceRecord.rows[0].check_out) {
            return res.status(400).json({ message: 'You have already checked out today.' });
        }

        await pool.query(
            'UPDATE attendance SET check_out = $1 WHERE user_id = $2 AND date = $3 RETURNING *',
            [checkoutTime, userId, date]
        );

        res.status(200).json({ message: 'Checked out successfully!', data: { date, check_out: checkoutTime } });
    } catch (err) {
        console.error('Error during check-out:', err);
        res.status(500).json({ message: 'Server error during check-out.' });
    }
});

// Get User Attendance Records
app.get('/attendance', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC', [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching attendance records:', err);
        res.status(500).json({ message: 'Server error fetching attendance records.' });
    }
});

// Request Attendance Correction
app.post('/attendance/correction-request', authenticate, async (req, res) => {
    const userId = req.user.id;
    const { date, reason } = req.body;
    const requestedAt = moment().tz('Asia/Kolkata').toISOString();

    if (!moment(date).isValid()) {
        return res.status(400).json({ message: 'Invalid date format.' });
    }
    // Ensure the requested date is not in the future
    if (moment(date).isAfter(moment().tz('Asia/Kolkata'), 'day')) {
        return res.status(400).json({ message: 'Correction can only be requested for past or current dates.' });
    }

    try {
        // Optional: Check if a correction request for this date/user already exists
        const existingRequest = await pool.query(
            'SELECT * FROM attendance_corrections WHERE user_id = $1 AND date = $2 AND status = $3',
            [userId, date, 'pending']
        );
        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ message: 'A pending correction request for this date already exists.' });
        }

        const result = await pool.query(
            'INSERT INTO attendance_corrections (user_id, date, reason, status, requested_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, date, reason, 'pending', requestedAt]
        );
        res.status(201).json({ message: 'Correction request submitted successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('Error submitting correction request:', err);
        res.status(500).json({ message: 'Server error submitting correction request.' });
    }
});


// --- Leave Routes ---

// Apply for Leave
app.post('/leaves/apply', authenticate, async (req, res) => {
    const userId = req.user.id;
    const { from_date, to_date, reason } = req.body;
    const appliedAt = moment().tz('Asia/Kolkata').toISOString();

    if (!moment(from_date).isValid() || !moment(to_date).isValid()) {
        return res.status(400).json({ message: 'Invalid date format.' });
    }
    if (moment(from_date).isAfter(to_date)) {
        return res.status(400).json({ message: 'From date cannot be after to date.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO leaves (user_id, from_date, to_date, reason, status, applied_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, from_date, to_date, reason, 'pending', appliedAt]
        );
        res.status(201).json({ message: 'Leave application submitted successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('Error submitting leave application:', err);
        res.status(500).json({ message: 'Server error submitting leave application.' });
    }
});

// Get User Leave Applications
app.get('/leaves', authenticate, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT * FROM leaves WHERE user_id = $1 ORDER BY applied_at DESC', [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching leave applications:', err);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    }
});

// Request Leave Cancellation
app.post('/leaves/cancel-request', authenticate, async (req, res) => {
    const userId = req.user.id;
    const { leave_id } = req.body;

    try {
        const leaveResult = await pool.query('SELECT status FROM leaves WHERE id = $1 AND user_id = $2', [leave_id, userId]);
        const leave = leaveResult.rows[0];

        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found or you do not have permission.' });
        }
        if (leave.status === 'cancellation_pending' || leave.status === 'cancelled') {
            return res.status(400).json({ message: 'Leave is already pending cancellation or has been cancelled.' });
        }

        await pool.query(
            'UPDATE leaves SET status = $1 WHERE id = $2 AND user_id = $3',
            ['cancellation_pending', leave_id, userId]
        );
        res.status(200).json({ message: 'Leave cancellation request submitted.' });
    } catch (err) {
        console.error('Error submitting leave cancellation request:', err);
        res.status(500).json({ message: 'Server error submitting leave cancellation request.' });
    }
});

// --- Admin Routes (Requires authorizeAdmin middleware) ---

// Get All Pending Leave Applications for Admin
app.get('/admin/leaves', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.name as user_name, u.employee_id
            FROM leaves l
            JOIN users u ON l.user_id = u.id
            WHERE l.status IN ('pending', 'cancellation_pending')
            ORDER BY l.applied_at ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching all leave applications for admin:', err);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    }
});

// Update Leave Status by Admin
app.post('/admin/leaves/update', authenticate, authorizeAdmin, async (req, res) => {
    const { leave_id, status } = req.body; // status should be 'approved' or 'rejected'
    const adminId = req.user.id;
    const adminNameResult = await pool.query('SELECT name FROM users WHERE id = $1', [adminId]);
    const adminName = adminNameResult.rows[0]?.name || 'Admin';

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        await pool.query(
            'UPDATE leaves SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND status = $4',
            [status, adminId, leave_id, 'pending']
        );
        // If approved, add to attendance for all days in the leave period
        if (status === 'approved') {
            const leaveDetailsResult = await pool.query('SELECT user_id, from_date, to_date FROM leaves WHERE id = $1', [leave_id]);
            const leaveDetails = leaveDetailsResult.rows[0];

            if (leaveDetails) {
                let currentDate = moment(leaveDetails.from_date);
                const endDate = moment(leaveDetails.to_date);

                while (currentDate.isSameOrBefore(endDate)) {
                    const dateFormatted = currentDate.format('YYYY-MM-DD');
                    // Check if an attendance record already exists for this day (e.g., if they checked in before leave was approved)
                    const existingAttendance = await pool.query(
                        'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
                        [leaveDetails.user_id, dateFormatted]
                    );

                    if (existingAttendance.rows.length === 0) {
                        await pool.query(
                            'INSERT INTO attendance (user_id, date, status, check_in, check_out, admin_approved_leave_id) VALUES ($1, $2, $3, $4, $5, $6)',
                            [leaveDetails.user_id, dateFormatted, 'on_leave', null, null, leave_id]
                        );
                    } else {
                        // If exists, update its status to 'on_leave' if it was 'absent'
                        await pool.query(
                            'UPDATE attendance SET status = $1, admin_approved_leave_id = $2 WHERE user_id = $3 AND date = $4 AND status = $5',
                            ['on_leave', leave_id, leaveDetails.user_id, dateFormatted, 'absent']
                        );
                    }
                    currentDate.add(1, 'day');
                }
            }
        }
        res.status(200).json({ message: `Leave application ${status} successfully.` });
    } catch (err) {
        console.error('Error updating leave status:', err);
        res.status(500).json({ message: 'Server error updating leave status.' });
    }
});

// Update Leave Cancellation Status by Admin
app.post('/admin/leaves/update-cancellation', authenticate, authorizeAdmin, async (req, res) => {
    const { leave_id, status } = req.body; // status should be 'cancellation_approved' or 'cancellation_rejected'
    const adminId = req.user.id;
    const adminNameResult = await pool.query('SELECT name FROM users WHERE id = $1', [adminId]);
    const adminName = adminNameResult.rows[0]?.name || 'Admin';

    if (!['cancellation_approved', 'cancellation_rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided for cancellation.' });
    }

    try {
        await pool.query(
            'UPDATE leaves SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND status = $4',
            [status === 'cancellation_approved' ? 'cancelled' : 'approved', // If approved, set to cancelled; if rejected, set back to approved
             adminId, leave_id, 'cancellation_pending']
        );

        // If cancellation is approved, remove the 'on_leave' attendance records
        if (status === 'cancellation_approved') {
            const leaveDetailsResult = await pool.query('SELECT user_id, from_date, to_date FROM leaves WHERE id = $1', [leave_id]);
            const leaveDetails = leaveDetailsResult.rows[0];

            if (leaveDetails) {
                let currentDate = moment(leaveDetails.from_date);
                const endDate = moment(leaveDetails.to_date);

                while (currentDate.isSameOrBefore(endDate)) {
                    const dateFormatted = currentDate.format('YYYY-MM-DD');
                    await pool.query(
                        'DELETE FROM attendance WHERE user_id = $1 AND date = $2 AND status = $3 AND admin_approved_leave_id = $4',
                        [leaveDetails.user_id, dateFormatted, 'on_leave', leave_id]
                    );
                    currentDate.add(1, 'day');
                }
            }
        }
        res.status(200).json({ message: `Leave cancellation ${status.replace('cancellation_', '')} successfully.` });
    } catch (err) {
        console.error('Error updating leave cancellation status:', err);
        res.status(500).json({ message: 'Server error updating leave cancellation status.' });
    }
});


// Get All Pending Correction Requests for Admin
app.get('/admin/attendance/corrections', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ac.*, u.name as user_name, u.employee_id
            FROM attendance_corrections ac
            JOIN users u ON ac.user_id = u.id
            WHERE ac.status = 'pending'
            ORDER BY ac.requested_at ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching all correction requests for admin:', err);
        res.status(500).json({ message: 'Server error fetching correction requests.' });
    }
});

// Update Correction Request Status by Admin
app.post('/admin/attendance/correction-review', authenticate, authorizeAdmin, async (req, res) => {
    const { id, status } = req.body; // status should be 'approved' or 'rejected'
    const adminId = req.user.id;
    const adminNameResult = await pool.query('SELECT name FROM users WHERE id = $1', [adminId]);
    const adminName = adminNameResult.rows[0]?.name || 'Admin';

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const correctionResult = await pool.query('SELECT user_id, date, reason FROM attendance_corrections WHERE id = $1', [id]);
        const correction = correctionResult.rows[0];

        if (!correction) {
            return res.status(404).json({ message: 'Correction request not found.' });
        }

        await pool.query(
            'UPDATE attendance_corrections SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
            [status, adminId, id]
        );

        if (status === 'approved') {
            // Apply the correction: e.g., mark as present if previously absent, or adjust times.
            // This example simply changes status to 'present'. You might need more complex logic here
            // based on the 'reason' or if you want to allow check-in/out time adjustments.
            await pool.query(
                'INSERT INTO attendance (user_id, date, status, admin_corrected_request_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status, admin_corrected_request_id = EXCLUDED.admin_corrected_request_id',
                [correction.user_id, correction.date, 'present', id]
            );
        }

        res.status(200).json({ message: `Correction request ${status} successfully.` });
    } catch (err) {
        console.error('Error updating correction request status:', err);
        res.status(500).json({ message: 'Server error updating correction request status.' });
    }
});

// Admin: Get all employee attendance for a specific date
app.get('/admin/attendance/daily', authenticate, authorizeAdmin, async (req, res) => {
    const { date } = req.query;
    if (!date || !moment(date).isValid()) {
        return res.status(400).json({ message: 'Valid date is required.' });
    }

    try {
        const query = `
            SELECT
                u.id AS user_id,
                u.name,
                u.employee_id,
                u.shift_type,
                COALESCE(a.status, 'Absent') AS status,
                a.check_in,
                a.check_out
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = $1
            ORDER BY u.name ASC;
        `;
        const result = await pool.query(query, [date]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching all employee daily attendance:', err);
        res.status(500).json({ message: 'Server error fetching daily attendance.' });
    }
});

// Admin: Get monthly attendance summary for all employees
app.get('/admin/analytics/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ message: 'Year and month are required.' });
    }

    const startDate = moment.tz([year, month - 1, 1], 'Asia/Kolkata').startOf('month').format('YYYY-MM-DD');
    const endDate = moment.tz([year, month - 1, 1], 'Asia/Kolkata').endOf('month').format('YYYY-MM-DD');

    try {
        const query = `
            SELECT
                u.id AS user_id,
                u.name,
                u.employee_id,
                COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) AS present_days,
                COUNT(CASE WHEN a.status = 'on_leave' THEN 1 END) AS leave_days
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date BETWEEN $1 AND $2
            GROUP BY u.id, u.name, u.employee_id
            ORDER BY u.name ASC;
        `;
        const result = await pool.query(query, [startDate, endDate]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching monthly summary for admin:', err);
        res.status(500).json({ message: 'Server error fetching monthly summary.' });
    }
});

// Admin: Export attendance data to CSV
app.get('/admin/attendance/export', authenticate, authorizeAdmin, async (req, res) => {
    const { year, month, employee_id, employee_name } = req.query;

    if (!year || !month) {
        return res.status(400).json({ message: 'Year and month are required for export.' });
    }

    const startDate = moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').startOf('month');
    const endDate = moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').endOf('month');

    let query = `
        SELECT
            u.name AS employee_name,
            u.employee_id,
            u.shift_type,
            g.date AS attendance_date,
            a.check_in,
            a.check_out,
            COALESCE(a.status, 'Absent') AS status,
            l.reason AS leave_reason,
            h.name AS holiday_name
        FROM users u
        CROSS JOIN GENERATE_SERIES($1::date, $2::date, '1 day'::interval) AS g(date)
        LEFT JOIN attendance a ON u.id = a.user_id AND a.date = g.date
        LEFT JOIN leaves l ON u.id = l.user_id AND g.date BETWEEN l.from_date AND l.to_date AND l.status = 'approved'
        LEFT JOIN holidays h ON g.date = h.date
    `;
    const queryParams = [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')];
    let userFilter = '';
    let userNameForHeader = '';
    let empIdForHeader = '';

    if (employee_id) {
        userFilter = ` WHERE u.employee_id = $${queryParams.length + 1}`;
        queryParams.push(employee_id);
        const userDetails = await pool.query('SELECT name FROM users WHERE employee_id = $1', [employee_id]);
        userNameForHeader = userDetails.rows[0]?.name || 'Unknown Employee';
        empIdForHeader = employee_id;
    } else if (employee_name) {
        userFilter = ` WHERE u.name ILIKE $${queryParams.length + 1}`;
        queryParams.push(`%${employee_name}%`);
        const userDetails = await pool.query('SELECT employee_id FROM users WHERE name ILIKE $1', [`%${employee_name}%`]);
        userNameForHeader = employee_name;
        empIdForHeader = userDetails.rows[0]?.employee_id || '';
    }

    query += userFilter + ` ORDER BY u.name, g.date ASC;`;

    try {
        const result = await pool.query(query, queryParams);
        let csvContent = "Date,Day of Week,Status,Check-in,Check-out,Leave Reason,Holiday Name\n";

        // Group by user if no specific user filter was applied for the CSV content itself
        const groupedResults = employee_id || employee_name
            ? { 'single_user': result.rows }
            : result.rows.reduce((acc, row) => {
                const key = `${row.employee_name} (${row.employee_id})`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(row);
                return acc;
            }, {});

        if (employee_id || employee_name) {
            // If a specific employee was selected, use their name for the header
            const headerName = userNameForHeader || employee_name || 'Selected Employee';
            const headerId = empIdForHeader || employee_id || 'N/A';
            csvContent = `Employee Name: ${headerName} (ID: ${headerId})\nMonth: ${moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').format('MMMMEEEE')}\n\n`;
            csvContent += "Date,Day of Week,Status,Check-in,Check-out,Leave Reason,Holiday Name\n";

            for (let currentDay = startDate.clone(); currentDay.isSameOrBefore(endDate); currentDay.add(1, 'day')) {
                const dateFormatted = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.format('dddd');
                let status = 'Absent';
                let checkIn = 'N/A';
                let checkOut = 'N/A';
                let leaveReason = '';
                let holidayName = '';

                const att = result.rows.find(row => moment(row.attendance_date).tz('Asia/Kolkata').format('YYYY-MM-DD') === dateFormatted);

                if (att) {
                    status = att.status;
                    checkIn = att.check_in ? moment(att.check_in, 'HH:mm:ss').format('hh:mm A') : '';
                    checkOut = att.check_out ? moment(att.check_out, 'HH:mm:ss').format('hh:mm A') : '';
                    leaveReason = att.leave_reason || '';
                    holidayName = att.holiday_name || '';
                } else {
                    // Check for holidays or leaves if no attendance record
                    const holiday = (await pool.query('SELECT name FROM holidays WHERE date = $1', [dateFormatted])).rows[0];
                    if (holiday) {
                        status = 'Holiday';
                        holidayName = holiday.name;
                    }

                    const leave = (await pool.query('SELECT reason FROM leaves WHERE user_id = $1 AND $2 BETWEEN from_date AND to_date AND status = $3', [queryParams[2] || '', dateFormatted, 'approved'])).rows[0];
                    if (leave) {
                        status = 'On Leave';
                        leaveReason = leave.reason;
                    }
                }
                if (status === 'Absent' && (currentDay.day() === 0 || currentDay.day() === 6)) { // Sunday or Saturday
                  status = 'Weekly Off';
                }

                csvContent += `${dateFormatted},${dayOfWeek},${status},"${checkIn}","${checkOut}","${leaveReason}","${holidayName}"\n`;
            }

        } else {
            // Original logic for all employees, grouped by employee in CSV
            for (const userKey in groupedResults) {
                csvContent += `\nEmployee Name: ${userKey}\n`;
                csvContent += "Date,Day of Week,Status,Check-in,Check-out,Leave Reason,Holiday Name\n";
                const userRows = groupedResults[userKey];

                const userShiftResult = await pool.query('SELECT shift_type FROM users WHERE name = $1 AND employee_id = $2', [userRows[0].employee_name, userRows[0].employee_id]);
                const userShiftType = userShiftResult.rows[0]?.shift_type || 'day'; // Default to day if not found

                for (let currentDay = startDate.clone(); currentDay.isSameOrBefore(endDate); currentDay.add(1, 'day')) {
                    const dateFormatted = currentDay.format('YYYY-MM-DD');
                    const dayOfWeek = currentDay.format('dddd');
                    let status = 'Absent';
                    let checkIn = 'N/A';
                    let checkOut = 'N/A';
                    let leaveReason = '';
                    let holidayName = '';

                    const att = userRows.find(row => moment(row.attendance_date).tz('Asia/Kolkata').format('YYYY-MM-DD') === dateFormatted);

                    if (att) {
                        status = att.status;
                        checkIn = att.check_in ? moment(att.check_in, 'HH:mm:ss').format('hh:mm A') : '';
                        checkOut = att.check_out ? moment(att.check_out, 'HH:mm:ss').format('hh:mm A') : '';
                        leaveReason = att.leave_reason || '';
                        holidayName = att.holiday_name || '';
                    } else {
                        // Check for holidays or leaves if no attendance record for this user on this day
                        const holiday = (await pool.query('SELECT name FROM holidays WHERE date = $1', [dateFormatted])).rows[0];
                        if (holiday) {
                            status = 'Holiday';
                            holidayName = holiday.name;
                        }
                        const leave = (await pool.query('SELECT reason FROM leaves WHERE user_id = $1 AND $2 BETWEEN from_date AND to_date AND status = $3', [userRows[0].user_id, dateFormatted, 'approved'])).rows[0];
                        if (leave) {
                            status = 'On Leave';
                            leaveReason = leave.reason;
                        }
                    }

                    if (status === 'Absent' && (currentDay.day() === 0 || currentDay.day() === 6)) { // Sunday or Saturday
                      status = 'Weekly Off';
                    }

                    csvContent += `${dateFormatted},${dayOfWeek},${status},"${checkIn}","${checkOut}","${leaveReason}","${holidayName}"\n`;
                }
            }
        }
        res.header('Content-Type', 'text/csv');
        const filenameSuffix = employee_id ? `${userNameForHeader.replace(/\s/g, '_')}_${empIdForHeader || ''}` : 'AllEmployees';
        res.attachment(`attendance_report_${filenameSuffix}_${year}_${month}.csv`);
        return res.send(csvContent);

    } catch (err) {
        console.error('Error exporting attendance data:', err);
        res.status(500).json({ message: 'Server error exporting attendance data.' });
    }
});

// Fetch holidays
app.get('/holidays', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, date, name FROM holidays ORDER BY date ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching holidays:', err);
        res.status(500).json({ message: 'Server error fetching holidays.' });
    }
});


// Add a holiday (Admin only)
app.post('/admin/holidays', authenticate, authorizeAdmin, async (req, res) => {
    const { date, name } = req.body;
    if (!date || !name) {
        return res.status(400).json({ message: 'Date and name are required.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO holidays (date, name) VALUES ($1, $2) RETURNING *',
            [date, name]
        );
        res.status(201).json({ message: 'Holiday added successfully.', holiday: result.rows[0] });
    } catch (err) {
        console.error('Error adding holiday:', err);
        res.status(500).json({ message: 'Server error adding holiday.' });
    }
});

// Delete a holiday (Admin only)
app.delete('/admin/holidays/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Holiday not found.' });
        }
        res.status(200).json({ message: 'Holiday deleted successfully.', deletedId: id });
    } catch (err) {
        console.error('Error deleting holiday:', err);
        res.status(500).json({ message: 'Server error deleting holiday.' });
    }
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
