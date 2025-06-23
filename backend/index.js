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
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({ message: 'Server configuration error: JWT secret not found.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Middleware to authorize admin users
const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
};

// --- AUTH ROUTES ---

// Login route
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const payload = {
            id: user.rows[0].id,
            email: user.rows[0].email,
            role: user.rows[0].role,
            name: user.rows[0].name,
            employee_id: user.rows[0].employee_id,
            shift_type: user.rows[0].shift_type
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        // Store refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure in production
            sameSite: 'strict', // Adjust based on your CORS policy
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            accessToken,
            user: {
                id: user.rows[0].id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                role: user.rows[0].role,
                employee_id: user.rows[0].employee_id,
                shift_type: user.rows[0].shift_type
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Token refresh route
app.post('/auth/refresh', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await pool.query('SELECT id, name, email, role, employee_id, shift_type FROM users WHERE id = $1', [decoded.id]);

        if (user.rows.length === 0) {
            return res.status(403).json({ message: 'Invalid refresh token.' });
        }

        const payload = {
            id: user.rows[0].id,
            email: user.rows[0].email,
            role: user.rows[0].role,
            name: user.rows[0].name,
            employee_id: user.rows[0].employee_id,
            shift_type: user.rows[0].shift_type
        };

        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken: newAccessToken, user: user.rows[0] });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(403).json({ message: 'Invalid refresh token.' });
    }
});

// Logout route
app.post('/auth/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.status(200).json({ message: 'Logged out successfully.' });
});

// Change password route
app.post('/auth/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user.id]);
        res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// Reset password request (send email with token)
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const resetToken = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const resetUrl = `${process.env.FRONTEND_URL}/?view=resetPassword&token=${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <p>You requested a password reset. Please click on the link below to reset your password:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>This link will expire in 1 hour.</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Password reset link sent to your email.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error sending reset email.' });
    }
});

// Reset password endpoint (called with token from email)
app.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.id]);
        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(400).json({ message: 'Invalid or expired reset token.' });
    }
});


// --- ATTENDANCE ROUTES ---

// Check-in
app.post('/attendance/checkin', authenticate, async (req, res) => {
    const { id: user_id, employee_id, shift_type } = req.user;
    const current_date = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const check_in_time = moment().tz('Asia/Kolkata').format('HH:mm:ss');

    try {
        const existingAttendance = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [user_id, current_date]
        );

        if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].check_in) {
            return res.status(400).json({ message: 'Already checked in for today.' });
        }

        const expectedCheckInHour = shift_type === 'evening' ? 21 : 9; // 9 PM or 9 AM
        const expectedCheckInMoment = moment().tz('Asia/Kolkata').hour(expectedCheckInHour).minute(0).second(0);
        const actualCheckInMoment = moment().tz('Asia/Kolkata');

        let status = 'present';
        if (actualCheckInMoment.isAfter(expectedCheckInMoment.add(5, 'minutes'))) { // Allow 5 mins grace period
            status = 'late';
        }

        let result;
        if (existingAttendance.rows.length > 0) {
            // Update existing record (e.g., if created by admin or partial record)
            result = await pool.query(
                'UPDATE attendance SET check_in = $1, status = $2 WHERE user_id = $3 AND date = $4 RETURNING *',
                [check_in_time, status, user_id, current_date]
            );
        } else {
            // Insert new attendance record
            result = await pool.query(
                'INSERT INTO attendance (user_id, employee_id, date, check_in, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [user_id, employee_id, current_date, check_in_time, status]
            );
        }

        res.status(201).json({ message: 'Checked in successfully!', data: result.rows[0] });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ message: 'Server error during check-in.' });
    }
});

// Check-out
app.post('/attendance/checkout', authenticate, async (req, res) => {
    const { id: user_id } = req.user;
    const current_date = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const check_out_time = moment().tz('Asia/Kolkata').format('HH:mm:ss');

    try {
        const existingAttendance = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [user_id, current_date]
        );

        if (existingAttendance.rows.length === 0 || !existingAttendance.rows[0].check_in) {
            return res.status(400).json({ message: 'You must check in before checking out.' });
        }
        if (existingAttendance.rows[0].check_out) {
            return res.status(400).json({ message: 'Already checked out for today.' });
        }

        const result = await pool.query(
            'UPDATE attendance SET check_out = $1 WHERE user_id = $2 AND date = $3 RETURNING *',
            [check_out_time, user_id, current_date]
        );

        res.status(200).json({ message: 'Checked out successfully!', data: result.rows[0] });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ message: 'Server error during check-out.' });
    }
});

// Get user's attendance records
app.get('/attendance', authenticate, async (req, res) => {
    const { id: user_id } = req.user;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC',
            [user_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Server error fetching attendance.' });
    }
});

// Request attendance correction
app.post('/attendance/correction-request', authenticate, async (req, res) => {
    const { date, reason } = req.body;
    const { id: user_id, name: user_name, employee_id } = req.user;

    if (!date || !reason) {
        return res.status(400).json({ message: 'Date and reason are required.' });
    }

    try {
        // Prevent correction requests for future dates
        if (moment(date).isAfter(moment().tz('Asia/Kolkata'), 'day')) {
             return res.status(400).json({ message: 'Correction can only be requested for past or current dates.' });
        }

        const result = await pool.query(
            'INSERT INTO attendance_corrections (user_id, user_name, employee_id, date, reason, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user_id, user_name, employee_id, date, reason, 'pending']
        );
        res.status(201).json({ message: 'Correction request submitted!', data: result.rows[0] });
    } catch (error) {
        console.error('Error submitting correction request:', error);
        res.status(500).json({ message: 'Server error submitting correction request.' });
    }
});

// Get user's correction requests
app.get('/attendance/corrections/user', authenticate, async (req, res) => {
    const { id: user_id } = req.user;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM attendance_corrections WHERE user_id = $1 ORDER BY request_date DESC',
            [user_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching user corrections:', error);
        res.status(500).json({ message: 'Server error fetching user corrections.' });
    }
});


// --- LEAVE ROUTES ---

// Apply for leave
app.post('/leaves/apply', authenticate, async (req, res) => {
    const { from_date, to_date, reason } = req.body;
    const { id: user_id, name: user_name, employee_id } = req.user;

    if (!from_date || !to_date || !reason) {
        return res.status(400).json({ message: 'All leave fields are required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO leaves (user_id, user_name, employee_id, from_date, to_date, reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [user_id, user_name, employee_id, from_date, to_date, reason, 'pending']
        );
        res.status(201).json({ message: 'Leave application submitted!', data: result.rows[0] });
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ message: 'Server error applying for leave.' });
    }
});

// Get user's leave applications
app.get('/leaves', authenticate, async (req, res) => {
    const { id: user_id } = req.user;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM leaves WHERE user_id = $1 ORDER BY request_date DESC',
            [user_id]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ message: 'Server error fetching leaves.' });
    }
});

// Request leave cancellation
app.post('/leaves/cancel-request', authenticate, async (req, res) => {
    const { leave_id } = req.body;
    const { id: user_id } = req.user;

    try {
        const leave = await pool.query('SELECT * FROM leaves WHERE id = $1 AND user_id = $2', [leave_id, user_id]);

        if (leave.rows.length === 0) {
            return res.status(404).json({ message: 'Leave not found or not authorized.' });
        }
        if (leave.rows[0].status === 'cancelled' || leave.rows[0].status === 'cancellation_pending') {
            return res.status(400).json({ message: 'Leave is already cancelled or cancellation is pending.' });
        }

        await pool.query('UPDATE leaves SET status = $1 WHERE id = $2', ['cancellation_pending', leave_id]);
        res.status(200).json({ message: 'Leave cancellation request submitted.' });
    } catch (error) {
        console.error('Error requesting leave cancellation:', error);
        res.status(500).json({ message: 'Server error requesting leave cancellation.' });
    }
});


// --- HOLIDAY ROUTES ---
// Get all holidays (accessible to all authenticated users)
app.get('/holidays', authenticate, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM holidays ORDER BY date ASC');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ message: 'Server error fetching holidays.' });
    }
});


// --- ADMIN ROUTES ---

// Admin: Register new employee (frontend now uses this instead of public /register)
app.post('/admin/register-employee', authenticate, authorizeAdmin, async (req, res) => {
    const { name, email, password, employee_id, role, shift_type } = req.body;

    // Basic validation
    if (!name || !email || !password || !employee_id || !role || !shift_type) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (!['employee', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }
    if (!['day', 'evening'].includes(shift_type)) {
        return res.status(400).json({ message: 'Invalid shift type specified.' });
    }

    try {
        // Check if user already exists by email or employee_id
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR employee_id = $2',
            [email, employee_id]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'User with this email or employee ID already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (name, email, password_hash, employee_id, role, shift_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, employee_id, role, shift_type',
            [name, email, hashedPassword, employee_id, role, shift_type]
        );

        res.status(201).json({
            message: 'Employee registered successfully',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Error registering employee:', error);
        res.status(500).json({ message: 'Server error during employee registration.' });
    }
});

// Admin: Get all leave applications
app.get('/admin/leaves', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT l.*, u.name as user_name, u.employee_id FROM leaves l JOIN users u ON l.user_id = u.id ORDER BY request_date DESC'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching all leaves (admin):', error);
        res.status(500).json({ message: 'Server error fetching leaves.' });
    }
});

// Admin: Update leave status (approve/reject/cancellation_approved/cancellation_rejected)
app.post('/admin/leaves/update', authenticate, authorizeAdmin, async (req, res) => {
    const { leave_id, status } = req.body;
    const admin_id = req.user.id; // Admin performing the action
    const admin_name = req.user.name;

    if (!leave_id || !status || !['approved', 'rejected', 'cancellation_approved', 'cancellation_rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid request: leave_id and valid status are required.' });
    }

    try {
        const result = await pool.query(
            'UPDATE leaves SET status = $1, assigned_admin_id = $2, assigned_admin_name = $3 WHERE id = $4 RETURNING *',
            [status, admin_id, admin_name, leave_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }
        res.status(200).json({ message: `Leave status updated to ${status}`, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating leave status (admin):', error);
        res.status(500).json({ message: 'Server error updating leave status.' });
    }
});

// Admin: Update leave cancellation status
app.post('/admin/leaves/update-cancellation', authenticate, authorizeAdmin, async (req, res) => {
    const { leave_id, status } = req.body;
    const admin_id = req.user.id;
    const admin_name = req.user.name;

    if (!leave_id || !status || !['cancellation_approved', 'cancellation_rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid request: leave_id and valid cancellation status are required.' });
    }

    // Determine the final status after cancellation review
    let finalStatus;
    if (status === 'cancellation_approved') {
        finalStatus = 'cancelled';
    } else {
        // If cancellation is rejected, revert to previous status (e.g., 'approved')
        // This requires knowing the previous status, or setting a default.
        // For simplicity, we'll assume it reverts to 'approved' if it was 'cancellation_pending'.
        finalStatus = 'approved'; // Revert to approved if cancellation rejected
    }

    try {
        const result = await pool.query(
            'UPDATE leaves SET status = $1, assigned_admin_id = $2, assigned_admin_name = $3 WHERE id = $4 RETURNING *',
            [finalStatus, admin_id, admin_name, leave_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }
        res.status(200).json({ message: `Leave cancellation status updated to ${status}`, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating leave cancellation status (admin):', error);
        res.status(500).json({ message: 'Server error updating leave cancellation status.' });
    }
});


// Admin: Get all attendance correction requests
app.get('/admin/attendance/corrections', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT ac.*, u.name as user_name, u.employee_id FROM attendance_corrections ac JOIN users u ON ac.user_id = u.id ORDER BY request_date DESC'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching all corrections (admin):', error);
        res.status(500).json({ message: 'Server error fetching corrections.' });
    }
});

// Admin: Review attendance correction (approve/reject)
app.post('/admin/attendance/correction-review', authenticate, authorizeAdmin, async (req, res) => {
    const { id, status } = req.body;
    const admin_id = req.user.id;
    const admin_name = req.user.name;

    if (!id || !status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid request: id and valid status are required.' });
    }

    try {
        // Update correction request status
        const correctionResult = await pool.query(
            'UPDATE attendance_corrections SET status = $1, assigned_admin_id = $2, assigned_admin_name = $3 WHERE id = $4 RETURNING *',
            [status, admin_id, admin_name, id]
        );

        if (correctionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Correction request not found.' });
        }

        // If approved, apply the correction to attendance table
        if (status === 'approved') {
            const correction = correctionResult.rows[0];
            // Here you'd apply the actual attendance correction based on the reason.
            // This is a simplified example; a real system might have more detail in 'reason'
            // to understand what needs correcting (e.g., check-in time, check-out time, marking present).
            // For now, let's assume it marks the user as 'present' for that day if not already.
            await pool.query(
                'INSERT INTO attendance (user_id, employee_id, date, status) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status',
                [correction.user_id, correction.employee_id, correction.date, 'present'] // Example: force to present
            );
        }

        res.status(200).json({ message: `Correction ID ${id} ${status} successfully!`, data: correctionResult.rows[0] });
    } catch (error) {
        console.error('Error reviewing correction request (admin):', error);
        res.status(500).json({ message: 'Server error reviewing correction request.' });
    }
});

// Admin: Get daily attendance for all employees
app.get('/admin/attendance/daily', authenticate, authorizeAdmin, async (req, res) => {
    const { date } = req.query; // Date format: YYYY-MM-DD
    if (!date) {
        return res.status(400).json({ message: 'Date parameter is required.' });
    }

    try {
        // Fetch all users and their attendance for the given date
        const { rows } = await pool.query(
            `SELECT
                u.id as user_id,
                u.name,
                u.employee_id,
                u.shift_type,
                COALESCE(a.status, 'Absent') as status,
                a.check_in,
                a.check_out
            FROM
                users u
            LEFT JOIN
                attendance a ON u.id = a.user_id AND a.date = $1
            ORDER BY u.name ASC;`,
            [date]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching daily employee attendance (admin):', error);
        res.status(500).json({ message: 'Server error fetching daily attendance.' });
    }
});

// Admin: Get monthly summary for all employees
app.get('/admin/analytics/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        return res.status(400).json({ message: 'Year and month parameters are required.' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT
                u.id AS user_id,
                u.name,
                u.employee_id,
                COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) AS present_days,
                COUNT(CASE WHEN l.status = 'approved' THEN 1 END) AS leave_days
            FROM
                users u
            LEFT JOIN
                attendance a ON u.id = a.user_id AND EXTRACT(YEAR FROM a.date) = $1 AND EXTRACT(MONTH FROM a.date) = $2
            LEFT JOIN
                leaves l ON u.id = l.user_id AND EXTRACT(YEAR FROM l.from_date) <= $1 AND EXTRACT(YEAR FROM l.to_date) >= $1
                AND EXTRACT(MONTH FROM l.from_date) <= $2 AND EXTRACT(MONTH FROM l.to_date) >= $2
                AND l.status = 'approved'
            GROUP BY u.id, u.name, u.employee_id
            ORDER BY u.name ASC;`,
            [year, month]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching monthly summary (admin):', error);
        res.status(500).json({ message: 'Server error fetching monthly summary.' });
    }
});

// Admin: Export attendance data to CSV
app.get('/admin/attendance/export', authenticate, authorizeAdmin, async (req, res) => {
    const { year, month, employee_id, employee_name } = req.query;

    if (!year || !month) {
        return res.status(400).json({ message: 'Year and month are required for export.' });
    }

    try {
        let query = `
            SELECT
                u.name AS employee_name,
                u.employee_id,
                a.date,
                a.check_in,
                a.check_out,
                a.status AS attendance_status,
                l.reason AS leave_reason,
                l.status AS leave_status,
                h.name AS holiday_name
            FROM
                users u
            LEFT JOIN
                attendance a ON u.id = a.user_id AND EXTRACT(YEAR FROM a.date) = $1 AND EXTRACT(MONTH FROM a.date) = $2
            LEFT JOIN
                leaves l ON u.id = l.user_id
                AND (a.date BETWEEN l.from_date AND l.to_date) -- Join leaves to attendance dates
            LEFT JOIN
                holidays h ON a.date = h.date -- Join holidays to attendance dates
        `;
        const queryParams = [year, month];
        let paramIndex = 3;

        if (employee_id) {
            query += ` WHERE u.employee_id = $${paramIndex++}`;
            queryParams.push(employee_id);
        } else if (employee_name) {
            query += ` WHERE LOWER(u.name) LIKE $${paramIndex++}`;
            queryParams.push(`%${employee_name.toLowerCase()}%`);
        }

        query += ` ORDER BY u.name, a.date ASC;`;

        const { rows: data } = await pool.query(query, queryParams);

        let csvContent = 'Date,Day of Week,Status,Check-in,Check-out,Leave Reason,Holiday Name\n';

        let userNameForHeader = 'All Employees';
        let empIdForHeader = '';

        if (employee_id && data.length > 0) {
            userNameForHeader = data[0].employee_name;
            empIdForHeader = data[0].employee_id;
        } else if (employee_name && data.length > 0) {
            userNameForHeader = data[0].employee_name;
            empIdForHeader = data[0].employee_id; // May or may not be available depending on data
        }

        let currentDay = moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata');
        const endOfMonth = moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').endOf('month');

        while (currentDay.isSameOrBefore(endOfMonth)) {
            const dateFormatted = currentDay.format('YYYY-MM-DD');
            const dayOfWeek = currentDay.format('dddd');

            let status = 'Absent';
            let checkIn = 'N/A';
            let checkOut = 'N/A';
            let leaveReason = 'N/A';
            let holidayName = 'N/A';

            // Find matching data for the current day
            const att = data.find(row => moment(row.date).tz('Asia/Kolkata').format('YYYY-MM-DD') === dateFormatted);

            if (att) {
                if (att.attendance_status) {
                    status = att.attendance_status;
                } else if (att.leave_status === 'approved') {
                    status = `On Leave`;
                    leaveReason = att.leave_reason;
                } else if (att.holiday_name) {
                    status = `Holiday`;
                    holidayName = att.holiday_name;
                }
                checkIn = att.check_in ? moment(att.check_in, 'HH:mm:ss').format('hh:mm A') : '';
                checkOut = att.check_out ? moment(att.check_out, 'HH:mm:ss').format('hh:mm A') : '';
            } else if (currentDay.day() === 0 || currentDay.day() === 6) {
                 status = 'Weekly Off';
            }


            csvContent += `${dateFormatted},${dayOfWeek},${status},\"${checkIn}\",\"${checkOut}\",\"${leaveReason}\",\"${holidayName}\"\\n`;
            currentDay.add(1, 'day');
        }

        // Add a header row for the employee name if a specific employee was selected
        let header = '';
        if (employee_id || employee_name) {
          header = `Employee Name: ${userNameForHeader} (ID: ${empIdForHeader || 'N/A'})\\nMonth: ${moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').format('MMMM YYYY')}\\n\\n`;
        } else {
          header = `Attendance Report for All Employees\\nMonth: ${moment.tz([parseInt(year), parseInt(month) - 1, 1], 'Asia/Kolkata').format('MMMM YYYY')}\\n\\n`;
        }
        csvContent = header + csvContent;


        res.header('Content-Type', 'text/csv');
        const filenameSuffix = employee_id ? `${userNameForHeader.replace(/\s/g, '_')}_${employee_id || ''}` : (employee_name ? `${employee_name.replace(/\s/g, '_')}` : 'AllEmployees');
        res.attachment(`attendance_report_${filenameSuffix}_${year}_${month}.csv`);
        return res.send(csvContent);

    } catch (error) {
        console.error('Error exporting attendance:', error);
        res.status(500).json({ message: 'Server error during attendance export.' });
    }
});


// Admin: Analytics endpoints (PLACEHOLDERS - YOU NEED TO IMPLEMENT THE QUERIES)
app.get('/admin/employees/count', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*) AS total_employees,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins
            FROM users;
        `);
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching employee counts:', error);
        res.status(500).json({ message: 'Server error fetching employee counts.' });
    }
});

app.get('/admin/leaves/pending-count', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*) AS pending_leaves FROM leaves WHERE status = 'pending';
        `);
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching pending leave count:', error);
        res.status(500).json({ message: 'Server error fetching pending leave count.' });
    }
});

app.get('/admin/corrections/pending-count', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*) AS pending_corrections FROM attendance_corrections WHERE status = 'pending';
        `);
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching pending corrections count:', error);
        res.status(500).json({ message: 'Server error fetching pending corrections count.' });
    }
});


const PORT = process.env.PORT || 5000; // Use PORT from environment variable or default to 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
