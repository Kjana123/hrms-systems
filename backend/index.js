// index.js

console.log(`[FILE_LOAD_CHECK] index.js loaded at ${new Date().toISOString()}`);

require('dotenv').config(); // Load environment variables

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone'); // Use moment-timezone
const { Pool } = require('pg'); // Explicitly import Pool
const cors = require('cors');
const cookieParser = require('cookie-parser');
const useragent = require('express-useragent');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Import fs for directory creation
const PDFDocument = require('pdfkit'); // For PDF generation

// Ensure environment variables are loaded
// Now checking for DATABASE_URL instead of individual DB_* variables
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET || !process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.FRONTEND_URL || !process.env.DATABASE_URL) {
  console.error('FATAL ERROR: One or more environment variables (JWT_SECRET, REFRESH_TOKEN_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL, DATABASE_URL) are not defined.');
  process.exit(1); // Exit the process if critical environment variables are missing
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// PostgreSQL Pool Configuration - Now using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some cloud providers like Neon
  }
});

// Configure multer for file uploads (user photos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/profile_photos';
    // Create the directory if it doesn't exist
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating upload directory:', err);
        return cb(err); // Pass the error to multer
      }
      cb(null, uploadPath);
    });
  },
  filename: (req, file, cb) => {
    // Ensure req.user is available for authenticated routes
    const userId = req.user && req.user.id ? req.user.id : 'unknown';
    cb(null, `user_${userId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images are allowed'));
  },
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(useragent.express());
app.use(cors({
  origin: ['https://attendance.unitedsolutionsplus.in'],
  credentials: true,
}));

// Serve static profile photos
app.use('/uploads/profile_photos', express.static('uploads/profile_photos'));
// Serve static payslip files
app.use('/uploads/payslips', express.static('uploads/payslips'));


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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // If access token expired, try to refresh using the refresh token from cookies
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const decodedRefresh = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
          const { rows } = await pool.query('SELECT id, name, email, role, employee_id, shift_type FROM users WHERE id = $1', [decodedRefresh.id]);
          if (rows.length === 0) {
            return res.status(403).json({ message: 'Invalid refresh token.' });
          }
          const user = rows[0];
          const newAccessToken = jwt.sign(
            { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name, shift_type: user.shift_type },
            JWT_SECRET,
            { expiresIn: '1h' }
          );
          res.setHeader('X-New-Access-Token', newAccessToken); // Send new token in a custom header
          req.user = user; // Set req.user with refreshed data
          return next();
        } catch (refreshError) {
          console.error('Refresh token verification failed:', refreshError.message, refreshError.stack);
          return res.status(403).json({ message: 'Invalid or expired refresh token. Please log in again.' });
        }
      }
      return res.status(401).json({ message: 'Access token expired. Please log in again.' });
    }
    console.error('Token verification failed:', error.message, error.stack);
    res.status(401).json({ message: 'Invalid token.' });
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

// Device detection function
function getDeviceType(userAgent) {
  if (!userAgent) return 'Unknown';
  userAgent = userAgent.toLowerCase();
  const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|rim)|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
  const mobileShortRegex = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|er)|ai(ko|ob)|al(av|ca|co)|amoi|an(d|ex)|android|anni|appleinc|aurora|azumi|bb(cd|me)|bd(eg|me|ul)|bi(lo|mr)|bn(w|r)|bq(mo|ro|sm)|br(ex|me)|bs(at|lo)|ebsm|bw(n|v)|c55|capi|ccwa|cdm|cell|chtm|cldc|cmd|co(mp|nd)|craw|da(it|ul)|dc(ad|dc)|dm(f|f)|di(or|od)|ds(ad|at|ed)|el(at|fl)|er(c|l)|es(ad|eo)|ez([4-7]0|os|wa|ze)|fetc|fly(|_)|g1 u|g560|gene|gf5|gmo|go(\.w|od)|gr(ad|un)|haie|hcit|hd(ad|at)|hell|hf-pd|hg(ar|ht|lg)|htc(| pro4|omg)|hu(aw|xe)|i-de|id(gu|hn)|ip(ao|im)|iq(|12|ty)|is(go|ro)|joda|kddi|keji|kgt(| eg)|klon|kpt |kwc|kyo(| m)|le(no|xi)|lg( g|¹5|³0|uqa|v)|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(ad|ev)|me(wa|on)|mwbp|mi(0a|th|v4a)|mz(go|nk)|ne(|ro|on)|nokia|op(ti|nv)|oran|owg1|pda|pg(13|g1)|pl(ay|ox)|pn-up|po(ck|fe)|py(g|re)|qatek|qc(07|12|21|32|60|61|71|ia)|qv-gf|ndc|rd(c|st|wf)|rh(no|pt)|ri(co|gr)|rm9d|rp(l|sl)|rw(er|as)|s55\/|sa(ge|ma|mm)|s([46]|g[56]0|h4)|sc(01|h1|st|tp)|sdk\/|se(c(|0|1)|47|mc|up|si|em)|sgh(| tu)|shar|sie(|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(us|v1)|sy(01|mb)|t2(mo|v2)|tdg|tel(i|m)|tim |t-mo|tkwa|tcl|tdg|tele|tfen|th(lb|ty)|ti-mo|top(mo|la)|tr(ad|ev)|ts(d|r)|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[03]|v1)|vm40|voda|vulc|w3c |wapa|wc(p|es)|webc|whit|wi(g |nw)|wmlb|wonu|x700|yas |your|zeto|zte-/i;
  if (mobileRegex.test(userAgent) || mobileShortRegex.test(userAgent.substring(0, 4))) {
    return 'Mobile';
  }
  if (/ipad|tablet|android(?!.*mobile)|kindle|playbook|silk/i.test(userAgent)) {
    return 'Tablet';
  }
  if (/windows|macintosh|linux|x11|cros/i.test(userAgent)) {
    return 'Desktop';
  }
  if (/bot|crawl|spider|mediapartners|adsbot|headless/i.test(userAgent)) {
    return 'Bot/Crawler';
  }
  if (/smarttv|googletv|appletv/i.test(userAgent)) {
    return 'Smart TV';
  }
  if (/console|playstation|xbox|nintendo/i.test(userAgent)) {
    return 'Gaming Console';
  }
  return 'Other';
}

// Authentication Endpoints
app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, employee_id, shift_type, address, mobile_number, kyc_details, personal_details, family_history, profile_photo FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = rows[0];
    res.json({
      ...user,
      profile_photo: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
    });
  } catch (error) {
    console.error('Error fetching user profile in /auth/me:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const user = rows[0];

    // Ensure password_hash is a string and not empty
    if (typeof user.password_hash !== 'string' || !user.password_hash.trim()) {
      console.error('Login error: Invalid password_hash for user:', user.email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name, shift_type: user.shift_type },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name, shift_type: user.shift_type },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax', // Adjust as needed for cross-site requests
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        shift_type: user.shift_type,
        profile_photo: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
      }
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const { rows } = await pool.query('SELECT id, name, email, role, employee_id, shift_type, profile_photo FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Invalid refresh token.' });
    }
    const user = rows[0];
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role, employee_id: user.employee_id, name: user.name, shift_type: user.shift_type },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        shift_type: user.shift_type,
        profile_photo: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error.message, error.stack);
    res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
});

// User Logout
app.post('/auth/logout', authenticate, async (req, res) => {
  const refreshToken = req.cookies.refreshToken; // Get refresh token from cookie
  const userId = req.user.id; // Get user ID from authenticated request
  const userAgent = req.useragent.source; // Use express-useragent for consistency

  // If no refresh token is present in the cookie, nothing to do on the server side (already logged out or session expired)
  if (!refreshToken) {
    // Clear the cookie anyway, just in case a stale one exists
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Changed to 'strict' for better security
    });
    return res.status(204).send(); // No content to send, but success
  }

  try {
    // CRITICAL: Delete the refresh token from the database to invalidate the session
    // Assuming you have a 'sessions' table or similar for refresh tokens
    // If not, this line might cause an error. You might need to add a sessions table or remove this.
    // await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);

    // Clear the HTTP-only cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Changed to 'strict' for better security
    });

    // Update user's last logout time and device in the users table
    // Ensure 'last_logout_device' in your 'users' table is VARCHAR(255) or larger
    await pool.query(
      'UPDATE users SET last_logout = CURRENT_TIMESTAMP, last_logout_device = $1 WHERE id = $2',
      [userAgent, userId]
    );

    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: 'Server error logging out.' });
  }
});

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
    console.error('Change password error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error changing password.' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Email not found.' });
    }
    const userId = rows[0].id;
    const resetToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.FRONTEND_URL}/?view=resetPassword&token=${resetToken}`;
    await transporter.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.`,
    });
    res.json({ message: 'Password reset link sent to email.' });
  } catch (error) {
    console.error('Reset password error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error sending reset link.' });
  }
});

app.post('/auth/reset-password/confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET); // This will throw if token is invalid/expired
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { rowCount } = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed.id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'User not found or token invalid.' });
    }
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Confirm reset password error:', error.message, error.stack);
    res.status(400).json({ message: 'Invalid or expired reset token.' });
  }
});

// Employee attendance history and details
// Employee attendance history and details
app.get('/api/attendance', authenticate, async (req, res) => {
    const user_id = req.user.id;
    const { date, month, year } = req.query;

    console.log(`[ATTENDANCE_API_DEBUG] Received GET /api/attendance request for user ${user_id}`);
    console.log(`[ATTENDANCE_API_DEBUG] Query params - date: ${date}, month: ${month}, year: ${year}`);

    let client = null;
    try {
        client = await pool.connect();

        let startDate, endDate;

        if (date) {
            const parsedDate = moment(date, 'YYYY-MM-DD', true);
            if (!parsedDate.isValid()) {
                return res.status(400).json({ message: 'Invalid date format provided.' });
            }
            startDate = parsedDate.tz('Asia/Kolkata').startOf('day');
            endDate = startDate.clone().endOf('day');
            console.log(`[ATTENDANCE_API_DEBUG] Fetching attendance for specific date: ${startDate.format('YYYY-MM-DD')}`);
        } else {
            const validMonth = month && parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 ? parseInt(month, 10) : moment().tz('Asia/Kolkata').month() + 1;
            const validYear = year && parseInt(year, 10) >= 2000 && parseInt(year, 10) <= 2099 ? parseInt(year, 10) : moment().tz('Asia/Kolkata').year();
            startDate = moment([validYear, validMonth - 1, 1]).tz('Asia/Kolkata').startOf('month');
            endDate = startDate.clone().endOf('month');
            console.log(`[ATTENDANCE_API_DEBUG] Fetching attendance for month ${validMonth}, year ${validYear}. Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
        }

        // Fetch raw attendance data
        const attendanceResult = await client.query(
            `SELECT
                id, user_id, date, check_in, check_out, status, late_time,
                working_hours, extra_hours, check_in_latitude, check_in_longitude,
                check_out_latitude, check_out_longitude, check_in_device, check_out_device,
                reason, admin_comment, created_at, updated_at
            FROM attendance
            WHERE user_id = $1 AND date BETWEEN $2 AND $3
            ORDER BY date ASC`,
            [user_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );

        console.log(`[ATTENDANCE_API_DEBUG] Raw attendance query returned ${attendanceResult.rows.length} rows.`);

        const attendanceMap = new Map(
            attendanceResult.rows.map(att => [moment(att.date).format('YYYY-MM-DD'), att])
        );

        // Fetch holidays
        const holidayResult = await client.query(
            `SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1 AND $2`,
            [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );
        const holidays = new Set(holidayResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));
        console.log(`[ATTENDANCE_API_DEBUG] Holidays in period:`, Array.from(holidays));


        // Fetch weekly off configurations for the employee that are relevant to the period
        const weeklyOffsConfigResult = await client.query(
            `SELECT weekly_off_days, effective_date, end_date FROM weekly_offs
             WHERE user_id = $1
             AND effective_date <= $2 -- Configuration must be effective on or before the end of the period
             ORDER BY effective_date DESC`,
            [user_id, endDate.format('YYYY-MM-DD')]
        );
        const weeklyOffsConfigs = weeklyOffsConfigResult.rows;
        console.log(`[ATTENDANCE_API_DEBUG] Raw weekly_offs_configs from DB (${weeklyOffsConfigs.length} rows):`, weeklyOffsConfigs);


        // Create a set of weekly off dates for the current period, considering effective dates
        const employeeSpecificWeeklyOffDates = new Set();
        for (let d = startDate.clone(); d.isSameOrBefore(endDate); d.add(1, 'day')) {
            const currentMomentDayOfWeek = d.day(); // 0 for Sunday, 6 for Saturday
            const formattedDate = d.format('YYYY-MM-DD');

            // Find the most recent weekly off configuration applicable to 'd'
            const relevantWeeklyOffConfig = weeklyOffsConfigs
                .find(row => {
                    const woEffectiveDate = moment.utc(row.effective_date);
                    const woEndDate = row.end_date ? moment.utc(row.end_date) : null;
                    // Check if 'd' is within the effective range of this config
                    return d.isSameOrAfter(woEffectiveDate, 'day') && (!woEndDate || d.isSameOrBefore(woEndDate, 'day'));
                });

            let isWeeklyOffForThisDay = false;
            if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(currentMomentDayOfWeek);
            }

            if (isWeeklyOffForThisDay) {
                employeeSpecificWeeklyOffDates.add(formattedDate);
            }
        }
        console.log(`[ATTENDANCE_API_DEBUG] Calculated employeeSpecificWeeklyOffDates:`, Array.from(employeeSpecificWeeklyOffDates));


        // Fetch leave applications
        const leaveResult = await client.query(
            `SELECT from_date, to_date, status, is_half_day, leave_type_id FROM leave_applications
             WHERE user_id = $1 AND (
                 from_date BETWEEN $2 AND $3 OR
                 to_date BETWEEN $2 AND $3 OR
                 $2 BETWEEN from_date AND to_date
             ) AND status IN ('approved', 'overridden_by_correction', 'cancellation_pending')`,
            [user_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );

        // Fetch leave types to get is_paid status
        const leaveTypesResult = await client.query('SELECT id, is_paid FROM leave_types');
        const leaveTypesMap = new Map(leaveTypesResult.rows.map(lt => [lt.id, lt.is_paid]));

        const records = [];
        const userShiftResult = await client.query('SELECT shift_type FROM users WHERE id = $1', [user_id]);
        const userShiftType = userShiftResult.rows[0]?.shift_type || 'day';
        const EXPECTED_SHIFT_START_TIME_DAY = '09:00:00';
        const EXPECTED_SHIFT_START_TIME_EVENING = '18:00:00';
        const STANDARD_WORKING_HOURS = 8.5;

        for (let d = startDate.clone(); d.isSameOrBefore(endDate); d.add(1, 'day')) {
            const targetDate = d.format('YYYY-MM-DD');
            const dayOfWeek = d.format('dddd');

            let record = {
                id: null,
                date: targetDate,
                day: dayOfWeek,
                shift: userShiftType,
                check_in: null,
                check_out: null,
                late_time: 0,
                working_hours: 0,
                extra_hours: 0,
                status: 'ABSENT', // Default status
                check_in_device: null,
                check_out_device: null,
                reason: null,
                admin_comment: null,
                created_at: null,
                updated_at: null
            };

            // --- REVISED LOGIC: Prioritize Holiday/Weekly Off/Leave status over attendance records ---
            if (holidays.has(targetDate)) {
                record.status = 'HOLIDAY';
            } else if (employeeSpecificWeeklyOffDates.has(targetDate)) {
                record.status = 'WEEKLY OFF';
            } else {
                // If not a holiday or weekly off, then check for approved leave
                const leave = leaveResult.rows.find(l =>
                    moment(targetDate).isBetween(l.from_date, l.to_date, 'day', '[]') && l.status === 'approved'
                );

                if (leave) {
                    const isLeavePaid = leaveTypesMap.get(leave.leave_type_id);
                    if (isLeavePaid === false) {
                        record.status = 'LOP';
                    } else {
                        record.status = leave.is_half_day ? 'HALF DAY LEAVE' : 'ON LEAVE';
                    }
                } else {
                    // If not a holiday, weekly off, or approved leave, check actual attendance record
                    const attendance = attendanceMap.get(targetDate);
                    if (attendance) {
                        const checkInMoment = attendance.check_in ? moment.tz(`${targetDate} ${attendance.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
                        let checkOutMoment = attendance.check_out ? moment.tz(`${targetDate} ${attendance.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

                        const shiftStart = userShiftType === 'evening'
                            ? moment.tz(`${targetDate} ${EXPECTED_SHIFT_START_TIME_EVENING}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata')
                            : moment.tz(`${targetDate} ${EXPECTED_SHIFT_START_TIME_DAY}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');

                        let lateTimeMinutes = 0;
                        let currentStatus = 'ABSENT';

                        if (checkInMoment) {
                            if (checkInMoment.isAfter(shiftStart)) {
                                lateTimeMinutes = Math.floor(moment.duration(checkInMoment.diff(shiftStart)).asMinutes());
                                currentStatus = 'LATE';
                            } else {
                                currentStatus = 'PRESENT';
                            }
                        }

                        let workingHours = 0;
                        let extraHours = 0;
                        if (checkInMoment && checkOutMoment) {
                            if (checkOutMoment.isBefore(checkInMoment)) {
                                checkOutMoment = checkOutMoment.add(1, 'day');
                            }
                            workingHours = parseFloat((checkOutMoment.diff(checkInMoment, 'minutes') / 60).toFixed(2));
                            if (workingHours > STANDARD_WORKING_HOURS) {
                                extraHours = parseFloat((workingHours - STANDARD_WORKING_HOURS).toFixed(2));
                            }
                        }

                        record = {
                            ...record,
                            id: attendance.id,
                            check_in: checkInMoment ? checkInMoment.utc().format() : null,
                            check_out: checkOutMoment ? checkOutMoment.utc().format() : null,
                            late_time: lateTimeMinutes,
                            working_hours: workingHours,
                            extra_hours: extraHours,
                            status: ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'LOP', 'HALF-DAY'].includes(attendance.status.toUpperCase()) ?
                                    String(attendance.status).replace(/_/g, ' ').toUpperCase() : currentStatus,
                            check_in_device: attendance.check_in_device || null,
                            check_out_device: attendance.check_out_device || null,
                            reason: attendance.reason || null,
                            admin_comment: attendance.admin_comment || null,
                            created_at: attendance.created_at || null,
                            updated_at: attendance.updated_at || null
                        };
                    } else {
                        record.status = 'ABSENT';
                    }
                }
            }
            if (['HOLIDAY', 'WEEKLY OFF', 'ON LEAVE', 'HALF DAY LEAVE', 'LOP'].includes(record.status)) {
                record.check_in = null;
                record.check_out = null;
                record.late_time = 0;
                record.working_hours = 0;
                record.extra_hours = 0;
            }

            records.push(record);
        }

        console.log(`[ATTENDANCE_API_DEBUG] Final records array size before sending: ${records.length}`);

        if (date) {
            const singleRecord = records.find(r => r.date === date);
            console.log(`[ATTENDANCE_API_DEBUG] Single record found for date ${date}:`, singleRecord);
            res.status(200).json(singleRecord || null);
        } else {
            res.status(200).json(records);
        }

    } catch (error) {
        console.error('[ATTENDANCE_API_ERROR] Error in /api/attendance GET route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error fetching attendance data: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});


// Employee check-in endpoint (Already updated for UTC ISO in response)
app.post('/api/attendance/check-in', authenticate, async (req, res) => {
    let client = null; // Initialize client to null
    try {
        client = await pool.connect(); // Assign client here

        const { latitude, longitude } = req.body;
        const user_id = req.user.id;
        const shiftType = req.user.shift_type;
        const device = req.useragent ? req.useragent.source : 'Unknown Device';
        const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const currentTime = moment().tz('Asia/Kolkata').format('HH:mm:ss'); // Store time as HH:mm:ss in DB

        console.log(`Backend: Check-in request for user ${user_id} on ${today} at ${currentTime}`);
        console.log(`Backend: Latitude: ${latitude}, Longitude: ${longitude}, Device: ${device}`);

        await client.query('BEGIN');

        const expectedShiftStartTime = shiftType === 'evening' ? '18:00:00' : '09:00:00';
        const shiftStartMoment = moment(expectedShiftStartTime, 'HH:mm:ss');
        const checkInMoment = moment(currentTime, 'HH:mm:ss');

        let lateTimeMinutes = 0;
        if (checkInMoment.isAfter(shiftStartMoment)) {
            lateTimeMinutes = Math.floor(moment.duration(checkInMoment.diff(shiftStartMoment)).asMinutes());
        }

        const upsertQuery = `
            INSERT INTO attendance (
                user_id, date, check_in, status, late_time,
                check_in_latitude, check_in_longitude, check_in_device
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, date) DO UPDATE SET
                check_in = COALESCE(attendance.check_in, EXCLUDED.check_in),
                status = COALESCE(attendance.status, EXCLUDED.status),
                late_time = COALESCE(attendance.late_time, EXCLUDED.late_time),
                check_in_latitude = COALESCE(attendance.check_in_latitude, EXCLUDED.check_in_latitude),
                check_in_longitude = COALESCE(attendance.check_in_longitude, EXCLUDED.check_in_longitude),
                check_in_device = COALESCE(attendance.check_in_device, EXCLUDED.check_in_device),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        console.log(`[CHECK-IN DB WRITE DEBUG] Attempting to write check_in: ${currentTime} for date: ${today}`);
        const upsertResult = await client.query(upsertQuery, [
            user_id,
            today,
            currentTime,
            lateTimeMinutes > 0 ? 'LATE' : 'PRESENT',
            lateTimeMinutes,
            latitude,
            longitude,
            device
        ]);

        const attendanceRecord = upsertResult.rows[0];
        console.log('Backend: UPSERT result attendanceRecord:', attendanceRecord);

        if (!attendanceRecord) {
            await client.query('ROLLBACK');
            console.error('Backend: CRITICAL ERROR: UPSERT operation for check-in did not return a row. User ID:', user_id, 'Date:', today);
            return res.status(500).json({ message: 'Internal server error: Failed to record attendance due to an unexpected database response.' });
        }

        const returnedCheckInTime = attendanceRecord.check_in ? moment(attendanceRecord.check_in, 'HH:mm:ss').format('HH:mm:ss') : null;
        console.log(`Backend: Returned check-in time from DB: ${returnedCheckInTime}, Current attempt time: ${currentTime}`);

        if (returnedCheckInTime && returnedCheckInTime !== currentTime) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-in rejected - Already checked in today.');
            return res.status(400).json({ message: 'You have already checked in today.' });
        }

        await client.query('COMMIT');
        console.log('Backend: Check-in successful, transaction committed.');

        // Convert times to UTC ISO 8601 strings before sending to frontend
        const checkInMomentIST = attendanceRecord.check_in ? moment.tz(`${today} ${attendanceRecord.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
        const checkOutMomentIST = attendanceRecord.check_out ? moment.tz(`${today} ${attendanceRecord.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

        res.status(201).json({
            message: 'Checked in successfully.',
            attendance: {
                ...attendanceRecord,
                check_in: checkInMomentIST ? checkInMomentIST.utc().format() : null,
                check_out: checkOutMomentIST ? checkOutMomentIST.utc().format() : null,
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/attendance/check-in (caught in catch block):', error.message, error.stack, error);
        // Ensure only one response is sent
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error during check-in: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Check-out endpoint (Already updated for UTC ISO in response)
app.post('/api/attendance/check-out', authenticate, async (req, res) => {
    let client = null; // Initialize client to null
    try {
        client = await pool.connect(); // Assign client here

        const { latitude, longitude } = req.body;
        const user_id = req.user.id;
        const device = req.useragent ? req.useragent.source : 'Unknown Device';
        const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const currentTime = moment().tz('Asia/Kolkata').format('HH:mm:ss'); // Store time as HH:mm:ss in DB

        console.log(`Backend: Check-out request for user ${user_id} on ${today} at ${currentTime}`);
        console.log(`Backend: Latitude: ${latitude}, Longitude: ${longitude}, Device: ${device}`);

        await client.query('BEGIN');

        const result = await client.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [user_id, today]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - No check-in record found for today.');
            return res.status(400).json({ message: 'You must check in before checking out.' });
        }

        const attendanceRecord = result.rows[0];

        if (!attendanceRecord.check_in) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - Check-in time is null.');
            return res.status(400).json({ message: 'You must check in before checking out.' });
        }

        if (attendanceRecord.check_out) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - Already checked out today.');
            return res.status(400).json({ message: 'You have already checked out today.' });
        }

        const checkInTimeStr = attendanceRecord.check_in;
        const checkOutTimeStr = currentTime;

        // Correctly parse time strings by combining with today's date for moment objects
        const checkInMomentWithDate = moment.tz(`${today} ${checkInTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');
        let checkOutMomentWithDate = moment.tz(`${today} ${checkOutTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');

        if (checkOutMomentWithDate.isBefore(checkInMomentWithDate)) {
            checkOutMomentWithDate.add(1, 'day');
        }

        let workingHours = 0;
        if (checkOutMomentWithDate.isAfter(checkInMomentWithDate)) {
            workingHours = parseFloat((checkOutMomentWithDate.diff(checkInMomentWithDate, 'minutes') / 60).toFixed(2));
        }

        const STANDARD_WORKING_HOURS = 8.5;
        let extraHours = workingHours > STANDARD_WORKING_HOURS ? parseFloat((workingHours - STANDARD_WORKING_HOURS).toFixed(2)) : 0;

        const updateResult = await client.query(
            `UPDATE attendance
             SET check_out = $1, working_hours = $2, extra_hours = $3,
                 check_out_latitude = $4, check_out_longitude = $5, check_out_device = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [
                currentTime,
                workingHours,
                extraHours,
                latitude,
                longitude,
                device,
                attendanceRecord.id
            ]
        );

        await client.query('COMMIT');
        console.log('Backend: Check-out successful, transaction committed.');

        // Convert times to UTC ISO 8601 strings before sending to frontend
        const updatedAttendanceRecord = updateResult.rows[0];
        const checkInMomentIST = updatedAttendanceRecord.check_in ? moment.tz(`${today} ${updatedAttendanceRecord.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
        const checkOutMomentIST = updatedAttendanceRecord.check_out ? moment.tz(`${today} ${updatedAttendanceRecord.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

        res.status(200).json({
            message: 'Checked out successfully.',
            attendance: {
                ...updatedAttendanceRecord,
                check_in: checkInMomentIST ? checkInMomentIST.utc().format() : null,
                check_out: checkOutMomentIST ? checkOutMomentIST.utc().format() : null,
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/attendance/check-out (caught in catch block):', error.message, error.stack, error);
        // Ensure only one response is sent
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error during check-out: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Correction Endpoints
// Employee submits attendance correction request
app.post('/api/attendance/correction-request', authenticate, async (req, res) => {
  const { date, expected_check_in, expected_check_out, reason } = req.body;
  const user_id = req.user.id;
  const userName = req.user.name; // Get user name from authenticated user
  const employeeId = req.user.employee_id; // Get employee ID from authenticated user

  if (!date || !expected_check_in || !reason) {
    return res.status(400).json({ message: 'Date, expected check-in, and reason are required.' });
  }

  try {
    // Check if a pending correction request already exists for this user and date
    const existingRequest = await pool.query(
      'SELECT id FROM corrections WHERE user_id = $1 AND date = $2 AND status = $3',
      [user_id, date, 'pending']
    );

    if (existingRequest.rows.length > 0) {
      return res.status(409).json({ message: 'A pending correction request for this date already exists.' });
    }

    const result = await pool.query(
      'INSERT INTO corrections (user_id, user_name, employee_id, date, expected_check_in, expected_check_out, reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_id, userName, employeeId, date, expected_check_in, expected_check_out || null, reason, 'pending']
    );

    // Notify admin about new correction request (optional, could be a separate notification system)
    await pool.query(
      'INSERT INTO notifications (user_id, message, is_admin_notification) VALUES ($1, $2, $3)',
      [user_id, `New attendance correction request from ${userName} (${employeeId}) for ${date}.`, true] // Notify admin
    );

    res.status(201).json({ message: 'Correction request submitted successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Error submitting correction request:', error);
    res.status(500).json({ message: 'Server error submitting correction request: ' + error.message });
  }
});

app.get('/api/corrections', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { rows } = await client.query(
      'SELECT id, user_id, user_name, employee_id, date, expected_check_in, expected_check_out, reason, status, assigned_admin_name, created_at FROM corrections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get user corrections error:', error.message, error.stack);
    res.status(500).json({ message: `Server error getting user corrections: ${error.message}` });
  } finally {
    client.release();
  }
});


// Leave Application
app.post('/api/leaves/apply', authenticate, async (req, res) => {
    const client = await pool.connect(); // Use client for transaction
    try {
        const { leave_type_id, from_date, to_date, reason, is_half_day } = req.body;
        const user_id = req.user.id;
        const userName = req.user.name;
        const employeeId = req.user.employee_id;

        if (!leave_type_id || !from_date || !to_date || !reason) {
            return res.status(400).json({ message: 'All leave application fields are required.' });
        }
        if (!moment(from_date).isValid() || !moment(to_date).isValid() || moment(from_date).isAfter(moment(to_date))) {
            return res.status(400).json({ message: 'Invalid date range provided.' });
        }

        await client.query('BEGIN'); // Start transaction

        const leaveTypeResult = await client.query('SELECT name, is_paid FROM leave_types WHERE id = $1', [leave_type_id]);
        if (leaveTypeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid leave type.' });
        }
        const leaveType = leaveTypeResult.rows[0];

        // Calculate duration excluding weekends and holidays
        let duration;
        if (is_half_day) {
            duration = 0.5; // If it's a half-day application, the duration is simply 0.5
        } else {
            let currentDay = moment(from_date);
            let calculatedDays = 0;
            // Fetch holidays using the correct column name
            const holidaysResult = await client.query('SELECT holiday_date FROM holidays');
            const holidayDates = new Set(holidaysResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));

            // Fetch weekly offs for the user
            const weeklyOffsConfigResult = await client.query(
                `SELECT weekly_off_days, effective_date FROM weekly_offs WHERE user_id = $1 ORDER BY effective_date DESC`,
                [user_id]
            );

            while (currentDay.isSameOrBefore(moment(to_date))) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.day(); // 0 for Sunday, 6 for Saturday

                let isWeekend = false;
                // Determine the most recent weekly off configuration for the current date
                const relevantWeeklyOffConfig = weeklyOffsConfigResult.rows
                    .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                    .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                    isWeekend = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                } else {
                    // Fallback to default weekends if no specific config found or invalid
                    isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // Default to Sunday and Saturday
                }

                const isHoliday = holidayDates.has(dateStr);

                if (!isWeekend && !isHoliday) {
                    calculatedDays += 1; // Count full working days
                }
                currentDay.add(1, 'day');
            }
            duration = calculatedDays;
        }

        // Allow application irrespective of balance. Balance check and deduction happens on approval.
        const result = await client.query(
            'INSERT INTO leave_applications (user_id, user_name, employee_id, leave_type_id, from_date, to_date, reason, is_half_day, status, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [user_id, userName, employeeId, leave_type_id, from_date, to_date, reason, is_half_day || false, 'pending', duration]
        );

        // Notify the user about their application
        await client.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [user_id, `Your leave application for ${leaveType.name} from ${from_date} to ${to_date} (${duration} days) has been submitted for approval.`]
        );

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: 'Leave application submitted!', data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error applying for leave:', error.message, error.stack);
        res.status(500).json({ message: 'Server error applying for leave.' });
    } finally {
        client.release();
    }
});



// Employee view of their leave applications
app.get('/api/leaves/my', authenticate, async (req, res) => {
    const user_id = req.user.id;
    let client; // Declare client here
    try {
        client = await pool.connect(); // Assign client here
        const result = await client.query(
            `SELECT
                la.id,
                la.user_id,
                la.leave_type_id,
                la.from_date,
                la.to_date,
                la.reason,
                la.status,
                la.is_half_day,
                la.admin_comment,
                la.cancellation_reason,
                la.created_at,
                la.updated_at,
                lt.name AS leave_type_name,
                lt.is_paid
            FROM leave_applications la
            JOIN leave_types lt ON CAST(la.leave_type_id AS INTEGER) = lt.id
            WHERE la.user_id = $1
            ORDER BY la.created_at DESC`,
            [user_id]
        );

        // Map over the results to calculate duration_days on the fly
        const leaveApplications = result.rows.map(app => {
            const fromDate = moment(app.from_date);
            const toDate = moment(app.to_date);

            // Calculate duration in days, including both start and end dates
            // Add 1 to the difference because diff() is exclusive of the end date
            let calculatedDurationDays = toDate.diff(fromDate, 'days') + 1;

            // Adjust for half-day if applicable
            if (app.is_half_day && calculatedDurationDays === 1) {
                calculatedDurationDays = 0.5;
            } else if (app.is_half_day && calculatedDurationDays > 1) {
                console.warn(`[LEAVE_DURATION_WARNING] Multi-day leave (${app.id}) is marked as half-day.
                                Review if this is intended or if half-day applies to a specific part of the leave.`);
            }

            return {
                ...app,
                // Assign the calculated duration to the 'duration' field,
                // which your frontend table expects.
                duration: parseFloat(calculatedDurationDays.toFixed(2))
            };
        });

        res.status(200).json(leaveApplications);
    } catch (error) {
        console.error('Error fetching user leave applications:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// NEW: Public/Employee route to get all leave types (no admin auth required)
app.get('/api/leaves/types', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description, is_paid, default_days_per_year FROM leave_types ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching public leave types:', error);
        res.status(500).json({ message: 'Server error fetching leave types for employees.' });
    }
});

app.post('/leaves/cancel-request', authenticate, async (req, res) => {
  const client = await pool.connect();
    try {
        const leave_id = req.params.id; // Get ID from path parameters
        const userId = req.user.id;

        await client.query('BEGIN'); // Start transaction

        const { rows } = await client.query('SELECT * FROM leave_applications WHERE id = $1 AND user_id = $2 FOR UPDATE', [leave_id, userId]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Leave request not found or you do not have permission.' });
        }
        const leave = rows[0];

        if (leave.status !== 'approved') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Only approved leaves can be requested for cancellation.' });
        }
        if (leave.status === 'cancellation_pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cancellation request already pending.' });
        }

        await client.query('UPDATE leave_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['cancellation_pending', leave_id]);

        // Notify admin about cancellation request (optional, but good practice)
        await client.query(
            'INSERT INTO notifications (user_id, message) VALUES (NULL, $1)', // NULL user_id for global/admin notification
            [`Leave cancellation request from ${req.user.name} (${req.user.employee_id}) for ${leave.from_date} to ${leave.to_date} is pending.`]
        );

        await client.query('COMMIT'); // Commit transaction
        res.json({ message: 'Leave cancellation request submitted successfully.' });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Leave cancellation request error:', error.message, error.stack);
        res.status(500).json({ message: 'Server error processing cancellation request.' });
    } finally {
        client.release();
    }
});


// Holiday Endpoints
app.get('/api/holidays', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || moment().tz('Asia/Kolkata').year();
    // Corrected column name to holiday_date
    const { rows } = await pool.query('SELECT * FROM holidays WHERE EXTRACT(YEAR FROM holiday_date)=$1 ORDER BY holiday_date', [targetYear]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching holidays:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching holidays.' });
  }
});

// Notification Endpoints
app.get('/api/notifications/my', authenticate, async (req, res) => {
  const user_id = req.user.id;
  const { unreadOnly } = req.query;
  let queryText = 'SELECT id, user_id, message, created_at, is_read FROM notifications WHERE user_id = $1 OR user_id IS NULL';
  const queryParams = [user_id];
  if (unreadOnly === 'true') {
    queryText += ' AND is_read = FALSE';
  }
  queryText += ' ORDER BY created_at DESC';
  try {
    const { rows } = await pool.query(queryText, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user notifications:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching notifications.' });
  }
});

app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  try {
    const checkNotification = await pool.query('SELECT user_id FROM notifications WHERE id = $1', [id]);
    if (checkNotification.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    const notificationOwnerId = checkNotification.rows[0].user_id;
    // Allow owner or admin to mark as read
    if (notificationOwnerId !== null && notificationOwnerId !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only mark your own or global notifications as read.' });
    }
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error.message, error.stack);
    res.status(500).json({ message: 'Server error marking notification as read.' });
  }
});

// User Photo Upload
app.post('/api/users/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded.' });
    }
    const photoFilename = req.file.filename; // Just the filename
    await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [photoFilename, req.user.id]);
    res.json({ message: 'Profile photo uploaded successfully.', photo_url: `/uploads/profile_photos/${photoFilename}` });
  } catch (error) {
    console.error('Error uploading profile photo:', error.message, error.stack);
    res.status(500).json({ message: 'Server error uploading profile photo.' });
  }
});

// Employee Analytics Endpoint
app.get('/api/analytics', authenticate, async (req, res) => {
    const { year, month } = req.query;
    const user_id = req.user.id; // Get user ID from authenticated request

    if (!year || !month) {
        console.error('[ANALYTICS ERROR] Year and month are required.');
        return res.status(400).json({ message: 'Year and month are required.' });
    }
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || parseInt(month) < 1 || parseInt(month) > 12) {
        console.error(`[ANALYTICS ERROR] Invalid year or month format: Year=${year}, Month=${month}`);
        return res.status(400).json({ message: 'Invalid year or month format.' });
    }

    const client = await pool.connect();
    try {
        // CALL THE SHARED HELPER FUNCTION
        const attendanceSummary = await calculateAttendanceSummary(user_id, parseInt(year), parseInt(month), client);

        // Map the output from calculateAttendanceSummary to the keys expected by your frontend
        const responseData = {
            presentDays: attendanceSummary.presentDays,
            lateDays: attendanceSummary.lateDays,
            leaveDays: attendanceSummary.leaveDays, // This is onLeaveDays (paid leaves)
            lopDays: attendanceSummary.lopDays, // This is unpaid leaves
            holidays: attendanceSummary.holidaysCount,
            weeklyOffs: attendanceSummary.actualWeeklyOffDays,
            absentDays: attendanceSummary.absentDays, // Unaccounted absent working days
            totalWorkingDays: attendanceSummary.totalWorkingDaysInMonth, // Total expected working days
            totalWorkingHours: attendanceSummary.totalWorkingHours,
            averageDailyHours: attendanceSummary.averageDailyHours,
            dailyStatusMap: attendanceSummary.dailyStatusMap // Pass the daily status map
        };

        console.log(`[ANALYTICS DEBUG] Final Analytics Data (from calculateAttendanceSummary):`, responseData);

        res.json(responseData);

    } catch (error) {
        console.error('Error in /api/analytics:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching analytics: ${error.message}` });
    } finally {
        client.release();
    }
});

// Leave Balance Endpoint (Employee)
app.get('/api/leaves/my-balances', authenticate, async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(`
            SELECT
                lb.user_id,
                u.name AS user_name,
                u.employee_id,
                lb.leave_type,
                lb.current_balance,
                lb.total_days_allocated,
                lt.description,
                lt.is_paid,
                lt.default_days_per_year,
                lb.last_updated AS updated_at
            FROM leave_balances lb
            JOIN users u ON lb.user_id = u.id
            LEFT JOIN leave_types lt ON lb.leave_type = lt.name
            WHERE lb.user_id = $1
            ORDER BY lb.leave_type ASC
        `, [user_id]);

        // Filter out LOP if current_balance is 0 or less, or if it's not explicitly requested
        const filteredBalances = result.rows.filter(balance => {
            if (balance.leave_type === 'LOP') {
                // Only include LOP if its balance is positive (meaning outstanding LOP days)
                return parseFloat(balance.current_balance) > 0;
            }
            return true; // Include all other leave types
        });

        res.status(200).json(filteredBalances);
    } catch (error) {
        console.error('Error in /api/leaves/my-balances:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching leave balances: ${error.message}` });
    }
});

// Admin Endpoints
app.post('/admin/register-employee', authenticate, authorizeAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { name, email, password, employee_id, role, shift_type, address, mobile_number, kyc_details } = req.body;
    if (!name || !email || !password || !employee_id || !role || !shift_type) {
      return res.status(400).json({ message: 'Name, email, password, employee ID, role, and shift type are required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const photoFilename = req.file ? req.file.filename : null; // Store just the filename

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, employee_id, role, shift_type, address, mobile_number, kyc_details, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, email, employee_id, role, shift_type, address, mobile_number, kyc_details, profile_photo',
      [name, email, hashedPassword, employee_id, role, shift_type, address || '', mobile_number || '', kyc_details || '', photoFilename]
    );
    const newUser = result.rows[0];
    res.status(201).json({
      message: 'Employee registered successfully',
      user: {
        ...newUser,
        profile_photo: newUser.profile_photo ? `/uploads/profile_photos/${newUser.profile_photo}` : null,
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error.message, error.stack);
    if (error.code === '23505') { // Unique violation error code
      return res.status(409).json({ message: 'Employee ID or Email already exists.' });
    }
    res.status(500).json({ message: 'Server error during employee registration.' });
  }
});

// Admin: Get all users with their full profile details
app.get('/api/admin/users', authenticate, authorizeAdmin, async (req, res) => {
    const client = await pool.connect(); // Get a client from the pool for transaction
    try {
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'users'
            ) AS table_exists
        `);
        if (!tableCheck.rows[0].table_exists) {
            throw new Error('Users table is missing.');
        }

        const { rows } = await client.query(`
            SELECT
                id,
                name,
                email,
                employee_id,
                role,
                shift_type,
                address,
                mobile_number,
                kyc_details,
                personal_details,
                family_history,
                profile_photo,
                created_at,
                updated_at
            FROM users
            ORDER BY name ASC
        `);
        res.json(rows.map(user => ({
            ...user,
            profile_photo_url: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
        })));
    } catch (error) {
        console.error('Error in /api/admin/users:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching users: ${error.message}` });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

app.put('/admin/users/:id', authenticate, authorizeAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, employee_id, role, shift_type, address, mobile_number, kyc_details, personal_details, family_history, password } = req.body;
    const photoFilename = req.file ? req.file.filename : null;

    let query = 'UPDATE users SET name=$1, email=$2, employee_id=$3, role=$4, shift_type=$5, address=$6, mobile_number=$7, kyc_details=$8, personal_details=$9, family_history=$10';
    const queryParams = [
      name,
      email,
      employee_id,
      role,
      shift_type,
      address || '',
      mobile_number || '',
      kyc_details || '',
      personal_details || '',
      family_history || ''
    ];
    let paramIndex = queryParams.length + 1;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password_hash = $${paramIndex++}`;
      queryParams.push(hashedPassword);
    }
    if (photoFilename) {
      query += `, profile_photo = $${paramIndex++}`;
      queryParams.push(photoFilename);
    }

    query += ` WHERE id=$${paramIndex} RETURNING *`;
    queryParams.push(id);

    const { rowCount, rows } = await pool.query(query, queryParams);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const updatedUser = rows[0];
    res.json({
      message: 'User profile updated successfully.',
      user: {
        ...updatedUser,
        profile_photo: updatedUser.profile_photo ? `/uploads/profile_photos/${updatedUser.profile_photo}` : null,
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error.message, error.stack);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Employee ID or Email already exists for another user.' });
    }
    res.status(500).json({ message: 'Server error updating user profile.' });
  }
});

app.delete('/admin/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    // Delete associated data first to avoid foreign key constraints
    await client.query('DELETE FROM attendance WHERE user_id = $1', [id]);
    await client.query('DELETE FROM leave_applications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM corrections WHERE user_id = $1', [id]);
    await client.query('DELETE FROM leave_balances WHERE user_id = $1', [id]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM weekly_offs WHERE user_id = $1', [id]); // Delete weekly offs
    await client.query('DELETE FROM profile_update_requests WHERE user_id = $1', [id]);
    // If you have a password_reset_tokens table, uncomment this:
    // await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [id]);

    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, profile_photo', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found.' });
    }

    // Delete profile photo file from disk if it exists
    const deletedUser = result.rows[0];
    if (deletedUser.profile_photo) {
      const photoPath = path.join(__dirname, 'uploads', 'profile_photos', deletedUser.profile_photo);
      fs.unlink(photoPath, (err) => {
        if (err) console.error(`Error deleting profile photo file ${photoPath}:`, err);
      });
    }

    await client.query('COMMIT'); // Commit transaction
    res.json({ message: 'User and all associated data deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('Admin delete user error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting user and associated data.' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/holidays', authenticate, authorizeAdmin, async (req, res) => {
  const { holiday_date, holiday_name } = req.body; // Corrected to holiday_date, holiday_name
  if (!holiday_date || !holiday_name) {
    return res.status(400).json({ message: 'Date and name are required for a holiday.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO holidays (holiday_date, holiday_name) VALUES ($1, $2) RETURNING *',
      [holiday_date, holiday_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding holiday:', error.message, error.stack);
    res.status(500).json({ message: 'Server error adding holiday.' });
  }
});

app.get('/api/admin/holidays', authenticate, authorizeAdmin, async (req, res) => {
  try {
    // Corrected to holiday_date
    const { rows } = await pool.query('SELECT * FROM holidays ORDER BY holiday_date ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching holidays:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching holidays.' });
  }
});

app.delete('/api/admin/holidays/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }
    res.json({ message: 'Holiday deleted successfully.' });
  } catch (error) {
    console.error('Error deleting holiday:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting holiday.' });
  }
});

app.post('/api/admin/leave-types', authenticate, authorizeAdmin, async (req, res) => {
  const { name, description, is_paid, default_days_per_year } = req.body;
  if (!name || typeof is_paid === 'undefined') {
    return res.status(400).json({ message: 'Name and is_paid status are required for a leave type.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO leave_types (name, description, is_paid, default_days_per_year) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || null, is_paid, default_days_per_year || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding leave type:', error.message, error.stack);
    res.status(500).json({ message: 'Server error adding leave type.' });
  }
});

app.get('/api/admin/leave-types', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leave_types ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave types:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching leave types.' });
  }
});

app.delete('/api/admin/leave-types/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leave_types WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }
    res.json({ message: 'Leave type deleted successfully.' });
  } catch (error) {
    console.error('Error deleting leave type:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting leave type.' });
  }
});

app.get('/api/admin/leaves', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                la.id,
                la.user_id,
                u.name AS user_name,
                u.employee_id,
                la.leave_type_id,
                lt.name AS leave_type_name,
                lt.is_paid,
                la.from_date,
                la.to_date,
                la.duration,
                la.reason,
                la.is_half_day,
                la.status,
                la.admin_comment,
                la.cancellation_reason,
                la.created_at,
                la.updated_at
            FROM leave_applications la
            JOIN users u ON la.user_id = u.id
            JOIN leave_types lt ON CAST(la.leave_type_id AS INTEGER) = lt.id
            ORDER BY la.created_at DESC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching all leave applications (admin):', error);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    }
});



app.put('/api/admin/leaves/:id/status', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, admin_comment } = req.body;
    const adminId = req.user.id; // ID of the admin performing the action

    // Validate incoming status
    if (!status || !['approved', 'rejected', 'cancelled', 'cancellation_rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    const client = await pool.connect(); // Get a client from the pool for transaction
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Fetch the current leave application details and lock the row
        const leaveAppResult = await client.query('SELECT * FROM leave_applications WHERE id = $1 FOR UPDATE', [id]);
        if (leaveAppResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Leave application not found.' });
        }
        const leaveApplication = leaveAppResult.rows[0];
        const userId = leaveApplication.user_id;
        const employeeId = leaveApplication.employee_id; // Assuming employee_id is directly on leave_applications table
        const fromDate = moment(leaveApplication.from_date, 'YYYY-MM-DD');
        const toDate = moment(leaveApplication.to_date, 'YYYY-MM-DD');

        // Fetch leave type details - Ensure leave_type_id from leave_applications is cast to INTEGER to match leave_types.id
        const leaveTypeResult = await client.query('SELECT name, is_paid FROM leave_types WHERE id = CAST($1 AS INTEGER)', [leaveApplication.leave_type_id]);
        if (leaveTypeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Associated leave type not found.' });
        }
        const leaveType = leaveTypeResult.rows[0];
        const leaveTypeName = leaveType.name;
        let isPaidLeave = leaveType.is_paid; // Use 'let' as we might modify this
        const leaveDuration = parseFloat(leaveApplication.duration); // Ensure duration is a number
        console.log(typeof leaveDuration, leaveDuration); // Should say: number 1.5 (or whatever)

        if (isNaN(leaveDuration)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid leave duration found for application.' });
        }

        // Fetch holidays and user's weekly offs for the leave period
        const holidaysResult = await client.query('SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1 AND $2', [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]);
        const holidayDates = new Set(holidaysResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));

        // Fetch weekly offs for the user that are active during the leave period
        const userWeeklyOffsResult = await client.query(
            `SELECT weekly_off_days, effective_date FROM weekly_offs WHERE user_id = $1 AND effective_date <= $2 ORDER BY effective_date DESC`,
            [userId, toDate.format('YYYY-MM-DD')]
        );

        let newLeaveStatus = status;
        let notificationMessage = '';
        let notificationType = '';
        let processedAsPaidFlag = null; // New flag to store final paid/unpaid status for the leave application

        // --- Handle Status Transitions and Balance Adjustments ---
        if (status === 'approved') {
            // Only deduct balance if the leave was pending (not already approved)
            if (leaveApplication.status === 'pending') {
                // --- START LOGIC: Check balance for paid leaves and convert to LOP if insufficient ---
                if (isPaidLeave) { // Only perform balance check if the leave type is inherently paid
                    const balanceResult = await client.query(
                        'SELECT current_balance FROM leave_balances WHERE user_id = $1 AND leave_type = $2',
                        [userId, leaveTypeName]
                    );

                    let employeeCurrentBalance = 0;
                    if (balanceResult.rows.length > 0) {
                        employeeCurrentBalance = parseFloat(balanceResult.rows[0].current_balance);
                    }
                    console.log(`[LEAVE_APPROVAL_DEBUG] User ${userId}, Leave Type: ${leaveTypeName}, Current Balance: ${employeeCurrentBalance}, Duration: ${leaveDuration}`);

                    // If employee balance is less than the leave duration, convert to unpaid leave
                    if (employeeCurrentBalance < leaveDuration) {
                        isPaidLeave = false; // Force it to be unpaid leave (LOP) for this approval
                        console.log(`[LEAVE_APPROVAL_DEBUG] Insufficient balance. Leave for user ${userId} (${leaveDuration} days) converted to unpaid (LOP).`);
                    }
                }
                // --- END LOGIC ---

                if (isPaidLeave) { // This 'isPaidLeave' now reflects the actual status after balance check
                    // Deduct from the specific leave type balance
                    await client.query(
                        `INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
                         VALUES ($1, $2, -$3, 0) -- If new record, current_balance starts as negative of leaveDuration
                         ON CONFLICT (user_id, leave_type) DO UPDATE SET
                             current_balance = leave_balances.current_balance - $3, -- Subtract leaveDuration from existing balance
                             last_updated = CURRENT_TIMESTAMP;`,
                        [userId, leaveTypeName, leaveDuration] // $3 is leaveDuration
                    );
                    processedAsPaidFlag = true; // Mark as processed as paid
                } else {
                    processedAsPaidFlag = false; // Mark as processed as unpaid (LOP)
                }

                // Mark attendance for each day of the leave
                let currentDay = fromDate.clone();
                while (currentDay.isSameOrBefore(toDate)) {
                    const dateStr = currentDay.format('YYYY-MM-DD');
                    const dayOfWeek = currentDay.day(); // 0 for Sunday, 6 for Saturday

                    // Determine the most recent weekly off configuration for the current date
                    const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                        .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                        .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                    let isWeeklyOffForThisDay = false;
                    if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                        const woEffectiveDate = moment.utc(relevantWeeklyOffConfig.effective_date);
                        const woEndDate = relevantWeeklyOffConfig.end_date ? moment.utc(relevantWeeklyOffConfig.end_date) : null;

                        isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek) &&
                                                currentDay.isSameOrAfter(woEffectiveDate, 'day') &&
                                                (!woEndDate || currentDay.isSameOrBefore(woEndDate, 'day'));
                    }

                    const isHoliday = holidayDates.has(dateStr);

                    if (!isWeeklyOffForThisDay && !isHoliday) { // Only mark attendance for actual working days
                        await client.query(
                            `INSERT INTO attendance (user_id, employee_id, date, status)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status
                             WHERE attendance.status != 'present';`, // Only update if current status is not 'present'
                            [userId, employeeId, dateStr, (isPaidLeave ? 'on_leave' : 'lop')] // Use 'lop' for unpaid leave
                        );
                    }
                    currentDay.add(1, 'day');
                }
            }
            notificationMessage = `Your leave application for ${leaveApplication.from_date} to ${leaveApplication.to_date} (${leaveTypeName}) has been approved.`;
            notificationType = 'leave_approved';

        } else if (status === 'rejected') {
            notificationMessage = `Your leave application for ${leaveApplication.from_date} to ${leaveApplication.to_date} (${leaveTypeName}) has been rejected. Admin comment: ${admin_comment || 'No comment provided.'}`;
            notificationType = 'leave_rejected';

            // If rejected, mark all affected working days as 'absent' if they were not already present
            let currentDay = fromDate.clone();
            while (currentDay.isSameOrBefore(toDate)) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.day();

                // Determine the most recent weekly off configuration for the current date
                const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                    .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                    .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                let isWeeklyOffForThisDay = false;
                if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                    isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                }

                const isHoliday = holidayDates.has(dateStr);

                if (!isWeeklyOffForThisDay && !isHoliday) {
                    await client.query(
                        `INSERT INTO attendance (user_id, employee_id, date, status) VALUES ($1, $2, $3, $4)
                         ON CONFLICT (user_id, date) DO UPDATE SET status = $4 WHERE attendance.status != 'present'`,
                        [userId, employeeId, dateStr, 'absent']
                    );
                }
                currentDay.add(1, 'day');
            }

        } else if (status === 'cancelled') {
            // This status is typically set when an 'approved' leave is cancelled by admin or employee request is approved
            // Only refund balance if the leave was previously approved (or cancellation pending for an approved leave)
            if (leaveApplication.status === 'approved' || leaveApplication.status === 'cancellation_pending') {
                // Check if the leave was originally processed as paid
                if (leaveApplication.is_processed_as_paid === true) { // Only refund if it was actually paid
                    // Refund to the specific leave type balance
                    await client.query(
                        `INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
                         VALUES ($1, $2, $3, 0) -- If new record, add duration for refund
                         ON CONFLICT (user_id, leave_type) DO UPDATE SET
                             current_balance = leave_balances.current_balance + EXCLUDED.current_balance,
                             last_updated = CURRENT_TIMESTAMP;`,
                        [userId, leaveTypeName, leaveDuration] // Add leaveDuration back
                    );
                }
                // Delete 'on_leave' or 'lop' attendance records for the cancelled period
                let currentDay = fromDate.clone();
                while (currentDay.isSameOrBefore(toDate)) {
                    const dateStr = currentDay.format('YYYY-MM-DD');
                    const dayOfWeek = currentDay.day();

                    // Determine the most recent weekly off configuration for the current date
                    const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                        .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                        .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                    let isWeeklyOffForThisDay = false;
                    if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                        isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                    }

                    const isHoliday = holidayDates.has(dateStr);

                    if (!isWeeklyOffForThisDay && !isHoliday) {
                        await client.query(
                            `DELETE FROM attendance WHERE user_id = $1 AND date = $2 AND status IN ('on_leave', 'lop')`,
                            [userId, dateStr]
                        );
                    }
                    currentDay.add(1, 'day');
                }
            }
            notificationMessage = `Your leave application for ${leaveApplication.from_date} to ${leaveApplication.to_date} (${leaveTypeName}) has been cancelled.`;
            notificationType = 'leave_cancelled';

        } else if (status === 'cancellation_rejected') {
            // If cancellation is rejected, revert the leave status back to 'approved'
            newLeaveStatus = 'approved';
            notificationMessage = `Your leave cancellation request for ${leaveApplication.from_date} to ${leaveApplication.to_date} (${leaveTypeName}) has been rejected. Your leave remains approved. Admin comment: ${admin_comment || 'No comment provided.'}`;
            notificationType = 'cancellation_rejected';
            // No balance or attendance changes needed as it reverts to approved state
        }

        // 2. Update the leave application status in the 'leaves' table
        // IMPORTANT: Also update the new is_processed_as_paid flag
        const updateLeaveQuery = `
            UPDATE leave_applications
            SET status = $1, admin_comment = $2, is_processed_as_paid = $4
            WHERE id = $3
            RETURNING *;
        `;
        const result = await client.query(updateLeaveQuery, [newLeaveStatus, admin_comment || null, id, processedAsPaidFlag]);

        // 3. Create a notification for the employee
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
             VALUES ($1, $2, FALSE, TRUE, $3);`,
            [userId, notificationMessage, notificationType]
        );

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: 'Leave application status updated successfully.', leave: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error updating leave application status:', error);
        res.status(500).json({ message: 'Server error updating leave application status: ' + (error.message || 'unknown error') });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

// Admin: Get all leave balances for all employees
app.get('/api/admin/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT lb.*, u.name, u.employee_id
            FROM leave_balances lb
            JOIN users u ON lb.user_id = u.id
            ORDER BY u.name
        `);
        console.log("DEBUG Backend: Successfully fetched all leave balances."); // ADD THIS DEBUG LOG
        res.json(result.rows);
    } catch (err) {
        console.error("ERROR Backend: Admin Fetch All Leave Balances Error:", err.message, err.stack); // ENHANCED ERROR LOGGING
        res.status(500).json({ message: 'Server error fetching all leave balances.' });
    }
});



// Admin: Update an employee's leave balance
app.put('/api/admin/leave-balances/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params; // Get userId from URL parameter
    const { casual_leave, sick_leave, earned_leave } = req.body; // Get updated balances from request body

    console.log(`DEBUG Backend: Received PUT request to update leave balance for userId: ${userId}`);
    console.log("DEBUG Backend: Received data:", { casual_leave, sick_leave, earned_leave });

    try {
        const result = await pool.query(
            'UPDATE leave_balances SET casual_leave = $1, sick_leave = $2, earned_leave = $3 WHERE user_id = $4 RETURNING *',
            [casual_leave, sick_leave, earned_leave, userId]
        );

        if (result.rows.length === 0) {
            // This means no record was found for the given user_id in leave_balances
            console.log(`DEBUG Backend: No existing leave balance record found for user_id: ${userId}.`);
            // Consider adding a POST route for initial creation if it's not handled during user registration
            return res.status(404).json({ message: 'Leave balance not found for this user. Ensure an initial balance record exists.' });
        }

        console.log("DEBUG Backend: Leave balance updated successfully:", result.rows[0]);
        res.status(200).json({ message: 'Leave balances updated successfully!', balance: result.rows[0] });
    } catch (err) {
        console.error("ERROR Backend: Admin Update Leave Balance Error:", err.message, err.stack);
        res.status(500).json({ message: 'Server error updating leave balances.' });
    }
});

// Employee: Request cancellation of an approved leave
app.put('/api/leaves/:id/request-cancellation', authenticate, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id; // User making the request
    const { cancellation_reason } = req.body || {};

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch the leave application to ensure it belongs to the user and is in 'approved' status
        const leaveAppResult = await client.query(
            'SELECT * FROM leave_applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
            [id, user_id]
        );

        if (leaveAppResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Leave application not found or does not belong to you.' });
        }

        const leaveApplication = leaveAppResult.rows[0];

        // Only allow cancellation request for 'approved' leaves
        if (leaveApplication.status !== 'approved') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Only approved leaves can be requested for cancellation.' });
        }

        // Update the leave application status to 'cancellation_pending'
        const updateLeaveQuery = `
            UPDATE leave_applications
            SET status = 'cancellation_pending', cancellation_reason = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const result = await client.query(updateLeaveQuery, [cancellation_reason || null, id]);

        // Notify all admins about the pending cancellation request
        const adminsResult = await client.query('SELECT id FROM users WHERE role = \'admin\'');
        const adminIds = adminsResult.rows.map(row => row.id);

        for (const adminId of adminIds) {
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'leave_cancellation_request');`,
                [adminId, `Employee ${req.user.name} (${req.user.employee_id}) has requested to cancel their leave from ${leaveApplication.from_date} to ${leaveApplication.to_date} (Type: ${leaveApplication.leave_type_name || 'N/A'}).`]
            );
        }

        // Also notify the user that their cancellation request has been submitted
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
             VALUES ($1, $2, FALSE, FALSE, 'leave_cancellation_submitted');`,
            [user_id, `Your cancellation request for leave from ${leaveApplication.from_date} to ${leaveApplication.to_date} has been submitted for admin review.`]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Leave cancellation request submitted successfully!', leave: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error requesting leave cancellation:', error.message, error.stack);
        res.status(500).json({ message: 'Server error requesting leave cancellation.' });
    } finally {
        client.release();
    }
});

app.post('/api/admin/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
  const { user_id, leave_type, amount, total_days_allocated, operation } = req.body;

  console.log(`DEBUG Backend: Received POST request to adjust leave balance for user_id: ${user_id}`);
  console.log("DEBUG Backend: Received data:", { leave_type, amount, total_days_allocated, operation });

  if (!user_id || !leave_type || amount === undefined || total_days_allocated === undefined) {
    return res.status(400).json({ message: 'User ID, leave type, amount, and total_days_allocated are required.' });
  }

  try {
    await pool.query('BEGIN');

    const existingBalance = await pool.query(
      'SELECT * FROM leave_balances WHERE user_id = $1 AND leave_type = $2 FOR UPDATE',
      [user_id, leave_type]
    );

    if (existingBalance.rows.length > 0) {
      const updateQuery = `
        UPDATE leave_balances
        SET current_balance = $1, total_days_allocated = $2, last_updated = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND leave_type = $4
        RETURNING *;
      `;
      await pool.query(updateQuery, [amount, total_days_allocated, user_id, leave_type]);
    } else {
      const insertQuery = `
        INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
        VALUES ($1, $2, $3, $4) RETURNING *;
      `;
      await pool.query(insertQuery, [user_id, leave_type, amount, total_days_allocated]);
    }

    await pool.query('COMMIT');

    console.log("DEBUG Backend: Leave balance adjusted successfully.");
    res.status(200).json({ message: 'Leave balance adjusted successfully!' });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("ERROR Backend: Adjust Leave Balance Error:", error.message, error.stack);
    res.status(500).json({ message: 'Server error adjusting leave balance.' });
  }
});


// Admin: Delete a leave balance record
// Admin: Delete a specific leave balance record
// This endpoint now expects user_id and leave_type in the request body for deletion.
app.delete('/api/admin/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
    // Expect user_id and leave_type from the request body
    const { userId, leaveType } = req.body; 

    if (!userId || !leaveType) {
        return res.status(400).json({ message: 'User ID and Leave Type are required to delete a leave balance record.' });
    }

    const client = await pool.connect();
    try {
        const { rowCount } = await client.query(
            'DELETE FROM leave_balances WHERE user_id = $1 AND leave_type = $2',
            [userId, leaveType]
        );
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Leave balance record not found for the specified user and leave type.' });
        }
        res.status(200).json({ message: 'Leave balance record deleted successfully.' });
    } catch (error) {
        console.error('Error deleting leave balance record:', error.message, error.stack);
        res.status(500).json({ message: 'Server error deleting leave balance record.' });
    } finally {
        client.release();
    }
});

app.post('/api/admin/notifications/send', authenticate, authorizeAdmin, async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ message: 'User ID and message are required for a specific notification.' });
  }
  try {
    // Verify user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const result = await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
      [userId, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending specific notification:', error.message, error.stack);
    res.status(500).json({ message: 'Server error sending specific notification.' });
  }
});


app.get('/api/admin/corrections', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status, userId } = req.query;
    let queryText = `
      SELECT ac.*, u.name as user_name, u.employee_id
      FROM corrections ac
      JOIN users u ON ac.user_id = u.id
    `;
    const params = [];
    const conditions = [];
    if (status) {
      conditions.push(`ac.status = $${params.length + 1}`);
      params.push(status);
    }
    if (userId) {
      conditions.push(`ac.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
    }
    queryText += ` ORDER BY ac.created_at DESC`;

    const { rows } = await pool.query(queryText, params);
    res.json(rows);
  } catch (error) {
    console.error('Admin get all corrections error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error getting all corrections.' });
  }
});

const calculateAttendanceMetrics = (checkInTimeStr, checkOutTimeStr, expectedShiftStartTimeStr) => {
    let lateTime = 0;
    let workingHours = 0;
    let extraHours = 0;
    let status = 'ABSENT'; // Default, will be updated to PRESENT/LATE if check-in/out exist

    const expectedShiftStartMoment = moment(expectedShiftStartTimeStr, 'HH:mm:ss');

    let checkInMoment = null;
    let checkOutMoment = null;

    if (checkInTimeStr) {
        checkInMoment = moment(checkInTimeStr, 'HH:mm:ss');
    }
    if (checkOutTimeStr) {
        checkOutMoment = moment(checkOutTimeStr, 'HH:mm:ss');
    }

    if (checkInMoment) {
        // Calculate Late Time
        if (checkInMoment.isAfter(expectedShiftStartMoment)) {
            lateTime = parseFloat((checkInMoment.diff(expectedShiftStartMoment, 'minutes')).toFixed(2));
            status = 'LATE'; // Mark as LATE if checked in after expected time
        } else {
            status = 'PRESENT'; // Otherwise, if checked in, it's PRESENT
        }
    }

    if (checkInMoment && checkOutMoment) {
        // Calculate Working Hours
        if (checkOutMoment.isAfter(checkInMoment)) {
            workingHours = parseFloat((checkOutMoment.diff(checkInMoment, 'minutes') / 60).toFixed(2));
        } else {
            // Handle overnight shifts if necessary, or set to 0 for simplicity
            workingHours = 0;
        }

        // Calculate Extra Hours (assuming 8.5 standard working hours)
        const standardWorkingHours = 8.5;
        if (workingHours > standardWorkingHours) {
            extraHours = parseFloat((workingHours - standardWorkingHours).toFixed(2));
        }
    }

    return { lateTime, workingHours, extraHours, status };
};


// Admin: Review and approve/reject attendance correction requests
app.post('/admin/attendance/correction-review', authenticate, authorizeAdmin, async (req, res) => {
    const { id, status, admin_comment, date, userId, expected_check_in, expected_check_out } = req.body; // Added date, userId, expected_check_in, expected_check_out

    if (!id || !status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Correction request ID and a valid status (approved/rejected) are required.' });
    }

    const client = await pool.connect(); // Get a client from the pool for transaction
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Update the correction request status
        const updateCorrectionQuery = `
            UPDATE corrections
            SET status = $1, admin_comment = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND status = 'pending'
            RETURNING *;
        `;
        const updateCorrectionResult = await client.query(updateCorrectionQuery, [status, admin_comment || null, req.user.id, id]);

        if (updateCorrectionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Correction request not found or already reviewed.' });
        }

        const reviewedCorrection = updateCorrectionResult.rows[0];

        // 2. If approved, update or insert into the attendance table
        if (status === 'approved') {
            // Fetch the user's shift type to determine expected check-in time
            const userShiftResult = await client.query('SELECT shift_type FROM users WHERE id = $1', [reviewedCorrection.user_id]);
            const userShiftType = userShiftResult.rows[0]?.shift_type || 'day'; // Default to 'day'

            // Define expected shift start time based on shift type (customize as needed)
            let expectedShiftStartTime = '09:00:00'; // Default for 'day' shift
            if (userShiftType === 'evening') {
                expectedShiftStartTime = '17:00:00'; // Example for 'evening' shift
            }

            // Calculate metrics based on requested times
            const { lateTime, workingHours, extraHours, status: newAttendanceStatus } = calculateAttendanceMetrics(
                expected_check_in,
                expected_check_out,
                expectedShiftStartTime
            );

            // Check if an attendance record already exists for this user and date
            const existingAttendance = await client.query(
                `SELECT * FROM attendance WHERE user_id = $1 AND date = $2`,
                [reviewedCorrection.user_id, reviewedCorrection.date]
            );

            if (existingAttendance.rows.length > 0) {
                // Update existing attendance record
                const updateAttendanceQuery = `
                    UPDATE attendance
                    SET
                        check_in = $1,
                        check_out = $2,
                        status = $3,
                        late_time = $4,
                        working_hours = $5,
                        extra_hours = $6,
                        admin_corrected_request_id = $7,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $8 AND date = $9
                    RETURNING *;
                `;
                await client.query(updateAttendanceQuery, [
                    expected_check_in,
                    expected_check_out,
                    newAttendanceStatus,
                    lateTime,
                    workingHours,
                    extraHours,
                    reviewedCorrection.id, // Link to the approved correction
                    reviewedCorrection.user_id,
                    reviewedCorrection.date
                ]);
            } else {
                // Insert new attendance record
                const insertAttendanceQuery = `
                    INSERT INTO attendance (
                        user_id, date, check_in, check_out, status,
                        late_time, working_hours, extra_hours, admin_corrected_request_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *;
                `;
                await client.query(insertAttendanceQuery, [
                    reviewedCorrection.user_id,
                    reviewedCorrection.date,
                    expected_check_in,
                    expected_check_out,
                    newAttendanceStatus,
                    lateTime,
                    workingHours,
                    extraHours,
                    reviewedCorrection.id // Link to the approved correction
                ]);
            }

            // 3. Create a notification for the employee
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'correction_approved');`,
                [reviewedCorrection.user_id, `Your attendance correction request for ${reviewedCorrection.date} has been approved. Your attendance record has been updated.`]
            );

        } else { // status === 'rejected'
            // 3. Create a notification for the employee
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'correction_rejected');`,
                [reviewedCorrection.user_id, `Your attendance correction request for ${reviewedCorrection.date} has been rejected. Admin comment: ${admin_comment || 'No comment provided.'}`]
            );
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: `Correction request ${status} successfully.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error reviewing correction request:', error);
        res.status(500).json({ message: 'Server error reviewing correction request.' });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

app.get('/api/admin/attendance', authenticate, authorizeAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { date } = req.query;
    const targetDate = date && moment(date).isValid() ? moment(date).format('YYYY-MM-DD') : moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    // Fetch all employees
    const usersResult = await client.query('SELECT id, name, employee_id, shift_type FROM users WHERE role = $1', ['employee']);
    const allEmployees = usersResult.rows;

    // Fetch attendance for the target date
    const attendanceResult = await client.query(
      'SELECT user_id, check_in, check_out, status, check_in_device, check_out_device, working_hours, late_time, extra_hours FROM attendance WHERE date = $1',
      [targetDate]
    );
    const dailyAttendanceMap = new Map(attendanceResult.rows.map(att => [att.user_id, att]));

    // Fetch leaves for the target date
    const leavesResult = await client.query(
      `SELECT user_id, status, is_half_day FROM leave_applications WHERE $1 BETWEEN from_date AND to_date AND status IN ('approved', 'overridden_by_correction', 'cancellation_pending')`,
      [targetDate]
    );
    const dailyLeavesMap = new Map(leavesResult.rows.map(leave => [leave.user_id, leave]));

    // Fetch holidays for the target date
    // Corrected column name to holiday_date
    const holidayResult = await client.query('SELECT 1 FROM holidays WHERE holiday_date = $1', [targetDate]);
    const isHoliday = holidayResult.rows.length > 0;

    // Fetch weekly offs for all employees for the target day of week, considering effective dates
    const dayOfWeekNum = moment(targetDate).day(); // 0 for Sunday, 6 for Saturday
    const weeklyOffsResult = await client.query(
      `SELECT user_id, weekly_off_days, effective_date FROM weekly_offs WHERE effective_date <= $1`,
      [targetDate]
    );
    const weeklyOffUsersMap = new Map(); // Map user_id to their relevant weekly_off_days array
    weeklyOffsResult.rows.forEach(row => {
        const userId = row.user_id;
        const effectiveDate = moment(row.effective_date);
        // Only keep the most recent effective config for each user
        if (!weeklyOffUsersMap.has(userId) || effectiveDate.isAfter(weeklyOffUsersMap.get(userId).effectiveDate)) {
            weeklyOffUsersMap.set(userId, {
                effectiveDate: effectiveDate,
                weeklyOffDays: row.weekly_off_days
            });
        }
    });


    const detailedAttendance = allEmployees.map(user => {
      const attendanceRecord = dailyAttendanceMap.get(user.id);
      const leaveRecord = dailyLeavesMap.get(user.id);

      let status = 'ABSENT';
      let check_in = null;
      let check_out = null;
      let late_time = '0 min';
      let working_hours = '0 hrs';
      let extra_hours = '0 hrs';
      let check_in_device = null;
      let check_out_device = null;

      // Determine if the current day is a weekly off for this user
      let isUserWeeklyOff = false;
      const userWeeklyOffConfig = weeklyOffUsersMap.get(user.id);
      if (userWeeklyOffConfig && Array.isArray(userWeeklyOffConfig.weeklyOffDays)) {
          isUserWeeklyOff = userWeeklyOffConfig.weeklyOffDays.includes(dayOfWeekNum);
      }

      // Determine status based on hierarchy: Holiday/Weekly Off > Leave > Attendance
      if (isHoliday) {
        status = 'HOLIDAY';
      } else if (isUserWeeklyOff) {
        status = 'WEEKLY OFF';
      } else if (leaveRecord) {
        if (leaveRecord.status === 'approved') {
          status = leaveRecord.is_half_day ? 'HALF DAY LEAVE' : 'ON LEAVE';
        } else if (leaveRecord.status === 'cancellation_pending') {
          status = 'LEAVE CANCELLATION PENDING';
        } else if (leaveRecord.status === 'overridden_by_correction') {
          status = 'PRESENT BY CORRECTION'; // Correction overrides leave for that day
        }
      }

      // If there's an attendance record, it provides actual check-in/out times and potentially overrides status
      if (attendanceRecord) {
        const checkInMoment = attendanceRecord.check_in ? moment(attendanceRecord.check_in, 'HH:mm:ss') : null;
        const checkOutMoment = attendanceRecord.check_out ? moment(attendanceRecord.check_out, 'HH:mm:ss') : null;

        check_in = checkInMoment ? checkInMoment.format('hh:mm A') : 'N/A';
        check_out = checkOutMoment ? checkOutMoment.format('hh:mm A') : 'N/A';
        check_in_device = attendanceRecord.check_in_device || 'N/A';
        check_out_device = attendanceRecord.check_out_device || 'N/A';

        late_time = `${attendanceRecord.late_time || 0} min`;
        working_hours = `${attendanceRecord.working_hours || 0} hrs`;
        extra_hours = `${attendanceRecord.extra_hours || 0} hrs`;

        // Use attendance status if it's not a holiday, weekly off, or leave
        if (!isHoliday && !isUserWeeklyOff && !leaveRecord) {
          status = String(attendanceRecord.status || 'unknown').replace(/_/g, ' ').toUpperCase();
        }
      }

      return {
        user_id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        shift_type: user.shift_type,
        status: status,
        check_in: check_in,
        check_out: check_out,
        late_time: late_time,
        working_hours: working_hours,
        extra_hours: extra_hours,
        check_in_device: check_in_device,
        check_out_device: check_out_device,
      };
    });

    res.json(detailedAttendance);
  } catch (error) {
    console.error('Error in /api/admin/attendance:', error.message, error.stack);
    res.status(500).json({ message: `Server error fetching admin attendance: ${error.message}` });
  } finally {
    client.release();
  }
});

// Admin: Get monthly attendance summary for all employees
app.get('/api/admin/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required for monthly summary.' });
    }

    const client = await pool.connect();
    try {
        const targetMonth = parseInt(month, 10);
        const targetYear = parseInt(year, 10);

        if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12 || isNaN(targetYear)) {
            return res.status(400).json({ message: 'Invalid month or year provided.' });
        }

        // Fetch all users
        const usersResult = await client.query('SELECT id, name, employee_id, shift_type FROM users ORDER BY name ASC');
        const users = usersResult.rows;

        const monthlySummary = [];

        for (const user of users) {
            const userId = user.id;
            const employeeId = user.employee_id;
            const userName = user.name;

            // Use the shared calculateAttendanceSummary helper
            const summary = await calculateAttendanceSummary(userId, targetYear, targetMonth, client);

            monthlySummary.push({
                user_id: userId,
                user_name: userName,
                employee_id: employeeId,
                present_days: summary.presentDays,
                late_days: summary.lateDays,
                absent_days: summary.absentDays,
                leave_days: summary.leaveDays, // Paid leaves
                lop_days: summary.lopDays,     // Unpaid leaves
                holidays: summary.holidaysCount,
                weekly_offs: summary.actualWeeklyOffDays,
                total_working_hours: summary.totalWorkingHours,
                average_daily_hours: summary.averageDailyHours,
                total_expected_working_days: summary.totalWorkingDaysInMonth,
                paid_days_for_payroll: summary.paidDays, // This is the crucial one for payroll
                unpaid_leaves_for_payroll: summary.unpaidLeaves // This is the crucial one for payroll
            });
        }

        res.status(200).json(monthlySummary);

    } catch (error) {
        console.error('Error fetching monthly summary (admin):', error);
        res.status(500).json({ message: 'Server error fetching monthly summary.' });
    } finally {
        client.release();
    }
});


app.get('/api/admin/export-attendance', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { year, month, employee_id } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required for export.' });
    }

    let userId = null;
    let empIdForHeader = '';
    let userNameForHeader = 'All Employees';

    if (employee_id) {
      const userResult = await pool.query('SELECT id, name, employee_id FROM users WHERE employee_id = $1', [employee_id]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        empIdForHeader = userResult.rows[0].employee_id;
        userNameForHeader = userResult.rows[0].name;
      } else {
        return res.status(404).json({ message: 'Employee not found.' });
      }
    }

    const startDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).startOf('month');
    const endDate = startDate.clone().endOf('month');

    // Fetch all users (or specific user if filtered)
    let usersQuery = 'SELECT id, name, employee_id, shift_type FROM users';
    const usersQueryParams = [];
    if (userId) {
      usersQuery += ' WHERE id = $1';
      usersQueryParams.push(userId);
    }
    usersQuery += ' ORDER BY name';
    const usersResult = await pool.query(usersQuery, usersQueryParams);
    const usersToExport = usersResult.rows;

    let csvContent = `Employee Name,Employee ID,Date,Day,Check-In,Check-Out,Late Time,Working Hours,Extra Hours,Status,Check-In Device,Check-Out Device\n`;

    for (const user of usersToExport) {
        // Use the calculateAttendanceSummary to get daily statuses for the month
        const summary = await calculateAttendanceSummary(user.id, parseInt(year), parseInt(month), pool);
        const dailyStatusMap = summary.dailyStatusMap;

        let currentDay = startDate.clone();
        while (currentDay.isSameOrBefore(endDate)) {
            const dateStr = currentDay.format('YYYY-MM-DD');
            const dayOfWeek = currentDay.format('dddd');
            const status = dailyStatusMap[dateStr] || 'N/A'; // Get status from the map

            // Fetch actual attendance record for this specific day to get times and devices
            const attendanceRecordResult = await pool.query(
                `SELECT check_in, check_out, late_time, working_hours, extra_hours, check_in_device, check_out_device
                 FROM attendance WHERE user_id = $1 AND date = $2`,
                [user.id, dateStr]
            );
            const record = attendanceRecordResult.rows[0] || {};

            const check_in = record.check_in ? moment(record.check_in, 'HH:mm:ss').format('hh:mm A') : '';
            const check_out = record.check_out ? moment(record.check_out, 'HH:mm:ss').format('hh:mm A') : '';
            const late_time = record.late_time ? `${record.late_time} min` : '0 min';
            const working_hours = record.working_hours ? `${record.working_hours} hrs` : '0 hrs';
            const extra_hours = record.extra_hours ? `${record.extra_hours} hrs` : '0 hrs';
            const check_in_device = record.check_in_device || 'N/A';
            const check_out_device = record.check_out_device || 'N/A';

            csvContent += `"${user.name}","${user.employee_id}","${dateStr}","${dayOfWeek}","${check_in}","${check_out}","${late_time}","${working_hours}","${extra_hours}","${status}","${check_in_device}","${check_out_device}"\n`;
            currentDay.add(1, 'day');
        }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${year}_${month}${empIdForHeader ? `_${empIdForHeader}` : ''}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting attendance:', error.message, error.stack);
    res.status(500).json({ message: 'Server error exporting attendance.' });
  }
});

app.post('/admin/attendance/mark-absent-forgotten-checkout', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { date, userId, adminReason } = req.body;
    const targetDate = date || moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    console.log('--- DEBUGGING mark-absent-forgotten-checkout ---');
    console.log('Received date (req.body.date):', date);
    console.log('Received userId (req.body.userId):', userId);
    console.log('Received adminReason (req.body.adminReason):', adminReason);
    console.log('Constructed targetDate:', targetDate, ' (Type:', typeof targetDate, ')');
    console.log('UserId being pushed to params:', userId, ' (Type:', typeof userId, ')');

    let queryText = `
      UPDATE attendance
      SET status = 'absent',
          check_out = NULL,
          working_hours = 0, -- Reset working hours
          extra_hours = 0,   -- Reset extra hours
          admin_comment = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE date = $1
        AND check_in IS NOT NULL
        AND check_out IS NULL
        AND status NOT IN ('on_leave', 'lop', 'half-day')
    `;

    const queryParams = [targetDate, adminReason];

    if (userId) {
      queryText += ` AND user_id = $3`;
      queryParams.push(userId);
    }

    queryText += ` RETURNING user_id, date, status`;

    console.log('Final queryText sent to DB:', queryText);
    console.log('Final queryParams sent to DB:', queryParams);

    const result = await pool.query(queryText, queryParams);

    console.log('Notification successful, rows updated:', result.rows.length);
    console.log('--- END DEBUGGING ---');

    for (const row of result.rows) {
      const notificationMessage = `Your attendance for ${row.date} was marked as absent due to forgotten checkout by admin. Reason: ${adminReason || 'Not specified'}.`;
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [row.user_id, notificationMessage]
      );
    }
    res.json({ message: `Marked ${result.rows.length} records as absent for ${targetDate}${userId ? ` for user ${userId}` : ''}.` });
  } catch (error) {
    console.error('Error marking forgotten checkouts:', error.message, error.stack);
    res.status(500).json({ message: 'Server error marking forgotten checkouts.' });
  }
});

// Admin: Manually Add/Update Attendance Record
app.post('/api/admin/manual-attendance-entry', authenticate, authorizeAdmin, async (req, res) => {
  const {
    user_id, date, check_in, check_out, status, late_time,
    working_hours, extra_hours, check_in_device, check_out_device,
    reason, admin_comment
  } = req.body;

  if (!user_id || !date || !check_in || !status) {
    return res.status(400).json({ message: 'User ID, date, check-in, and status are required for manual entry.' });
  }

  try {
    // Check if a record for this user and date already exists
    const existingRecord = await pool.query(
      'SELECT id FROM attendance WHERE user_id = $1 AND date = $2',
      [user_id, date]
    );

    if (existingRecord.rows.length > 0) {
      // Update existing record
      await pool.query(
        `UPDATE attendance SET
           check_in = $3, check_out = $4, status = $5, late_time = $6,
           working_hours = $7, extra_hours = $8, check_in_device = $9,
           check_out_device = $10, reason = $11, admin_comment = $12,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND date = $2 RETURNING *`,
        [user_id, date, check_in, check_out, status, late_time,
         working_hours, extra_hours, check_in_device, check_out_device,
         reason, admin_comment]
      );
      res.status(200).json({ message: 'Attendance record updated successfully.' });
    } else {
      // Insert new record
      await pool.query(
        `INSERT INTO attendance (
           user_id, date, check_in, check_out, status, late_time,
           working_hours, extra_hours, check_in_device, check_out_device,
           reason, admin_comment
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [user_id, date, check_in, check_out, status, late_time,
         working_hours, extra_hours, check_in_device, check_out_device,
         reason, admin_comment]
      );
      res.status(201).json({ message: 'Attendance record added successfully.' });
    }
  } catch (error) {
    console.error('Error in manual attendance entry:', error);
    res.status(500).json({ message: 'Server error in manual attendance entry.' });
  }
});

app.get('/api/admin/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const totalEmployeesResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['employee']);
    const totalAdminsResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
    const pendingLeavesResult = await pool.query('SELECT COUNT(*) FROM leave_applications WHERE status = $1', ['pending']);
    const pendingCorrectionsResult = await pool.query('SELECT COUNT(*) FROM corrections WHERE status = $1', ['pending']);

    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    // Count present today (status 'present' or 'late')
    const presentTodayResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date = $1 AND (status = 'present' OR status = 'late')`,
      [today]
    );

    // Count on leave today (status 'approved' and date falls within leave range)
    const onLeaveTodayResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) FROM leave_applications WHERE $1 BETWEEN from_date AND to_date AND status = 'approved'`,
      [today]
    );

    // Count total employees to calculate absent
    const totalActiveEmployeesResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['employee']);
    const totalActiveEmployees = parseInt(totalActiveEmployeesResult.rows[0].count, 10);

    // Get users who are present, on leave, holiday, or weekly off today
    const coveredUsers = new Set();

    // Add present/late users
    const presentLateUsers = await pool.query(`SELECT user_id FROM attendance WHERE date = $1 AND (status = 'present' OR status = 'late')`, [today]);
    presentLateUsers.rows.forEach(row => coveredUsers.add(row.user_id));

    // Add users on approved leave
    const leaveUsers = await pool.query(`SELECT user_id FROM leave_applications WHERE $1 BETWEEN from_date AND to_date AND status = 'approved'`, [today]);
    leaveUsers.rows.forEach(row => coveredUsers.add(row.user_id));

    // Add users on holiday (if today is a holiday)
    // Corrected column name to holiday_date
    const isTodayHolidayResult = await pool.query('SELECT 1 FROM holidays WHERE holiday_date = $1', [today]);
    if (isTodayHolidayResult.rows.length > 0) {
        const allEmployeeIdsResult = await pool.query('SELECT id FROM users WHERE role = $1', ['employee']);
        allEmployeeIdsResult.rows.forEach(row => coveredUsers.add(row.id));
    }

    // Add users on weekly off
    const dayOfWeekTodayNum = moment().tz('Asia/Kolkata').day(); // 0 for Sunday, 6 for Saturday
    const weeklyOffUsersToday = await pool.query(`SELECT user_id, weekly_off_days, effective_date FROM weekly_offs WHERE effective_date <= $1`, [today]);
    weeklyOffUsersToday.rows.forEach(row => {
        const effectiveDate = moment(row.effective_date);
        // Check if this config is the most recent for the user and if today's day of week is in their weekly_off_days
        if (row.weekly_off_days.includes(dayOfWeekTodayNum) &&
            (!coveredUsers.has(row.user_id) || effectiveDate.isAfter(moment(coveredUsers.get(row.user_id).effectiveDate)))) { // Simplified check
            coveredUsers.add(row.user_id);
        }
    });

    // Calculate absent users: total employees - covered users
    const absentToday = totalActiveEmployees - coveredUsers.size;


    const stats = {
      total_employees: parseInt(totalEmployeesResult.rows[0].count, 10),
      total_admins: parseInt(totalAdminsResult.rows[0].count, 10),
      pending_leave_requests: parseInt(pendingLeavesResult.rows[0].count, 10),
      pending_correction_requests: parseInt(pendingCorrectionsResult.rows[0].count, 10),
      presentToday: parseInt(presentTodayResult.rows[0].count, 10),
      onLeaveToday: parseInt(onLeaveTodayResult.rows[0].count, 10),
      absentToday: absentToday < 0 ? 0 : absentToday, // Ensure non-negative
    };
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching admin stats.' });
  }
});



// Admin: Add a weekly off for an employee (MODIFIED)
app.post('/api/admin/weekly-offs', authenticate, authorizeAdmin, async (req, res) => {
    const { user_id, weekly_off_days, effective_date, end_date } = req.body; // ADD end_date here

    if (!user_id || !Array.isArray(weekly_off_days) || weekly_off_days.length === 0 || !effective_date) {
        return res.status(400).json({ message: 'User ID, an array of day numbers (0-6), and an effective date are required.' });
    }

    if (!moment(effective_date).isValid()) {
        return res.status(400).json({ message: 'Invalid effective date provided.' });
    }

    try {
        const result = await pool.query(
    `INSERT INTO weekly_offs (user_id, weekly_off_days, effective_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *`, // ADD end_date column
    [user_id, weekly_off_days, effective_date, end_date || null] // ADD end_date parameter (use null if not provided)
);
        res.status(201).json({ message: 'Weekly off assigned successfully.', weeklyOff: result.rows[0] });
    } catch (error) {
        console.error('Error adding weekly off:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ message: 'A weekly off assignment for this user on this effective date already exists.' });
        }
        res.status(500).json({ message: 'Server error assigning weekly off.' });
    }
});

// Admin: Get all assigned weekly offs (MODIFIED)
app.get('/api/admin/weekly-offs', authenticate, authorizeAdmin, async (req, res) => {
    try {
        // Include weekly_off_days (array) and effective_date in the select query
   const result = await pool.query(`
    SELECT wo.id, wo.user_id, u.name AS user_name, u.employee_id, wo.weekly_off_days, wo.effective_date, wo.end_date
    FROM weekly_offs wo
    JOIN users u ON wo.user_id = u.id
    ORDER BY u.name ASC, wo.effective_date DESC
`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching weekly offs:', error);
        res.status(500).json({ message: 'Server error fetching weekly offs.' });
    }
});

// Admin: Delete a weekly off record (No change needed here)
app.delete('/api/admin/weekly-offs/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM weekly_offs WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Weekly off record not found.' });
        }
        res.status(200).json({ message: 'Weekly off record deleted successfully.' });
    } catch (error) {
        console.error('Error deleting weekly off:', error);
        res.status(500).json({ message: 'Server error deleting weekly off.' });
    }
});

// NEW ENDPOINT: Handle profile update requests
app.post('/api/profile-update-requests', authenticate, async (req, res) => {
    const user_id = req.user.id;
    const { requested_data } = req.body; // requested_data should be a JSON object of changes

    let client = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Insert the profile update request into the new table
        const insertQuery = `
            INSERT INTO profile_update_requests (user_id, requested_data, status)
            VALUES ($1, $2, 'pending')
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [user_id, requested_data]);

        await client.query('COMMIT');
        console.log(`Backend: Profile update request submitted for user ${user_id}:`, result.rows[0]);
        res.status(201).json({
            message: 'Profile update request submitted successfully for admin approval.',
            request: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/profile-update-requests POST route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error submitting profile update request: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// NEW ADMIN ENDPOINT: Approve a profile update request
app.post('/api/admin/profile-update-requests/:requestId/approve', authenticate, authorizeAdmin, async (req, res) => {
    const { requestId } = req.params;
    const admin_id = req.user.id; // ID of the admin performing the action

    let client = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the request to ensure it's pending and get the requested_data and user_id
        const requestResult = await client.query(
            `SELECT user_id, requested_data FROM profile_update_requests
             WHERE id = $1 AND status = 'pending'`,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Profile update request not found or not pending.' });
        }

        const { user_id, requested_data } = requestResult.rows[0];

        // 2. Apply the requested changes to the users table
        // Dynamically build the SET clause for the UPDATE query
        const updateFields = Object.keys(requested_data).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const updateValues = Object.values(requested_data);

        // Ensure user_id is the first parameter for the WHERE clause
        const updateUserQuery = `
            UPDATE users
            SET ${updateFields}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        // Combine user_id with the requested_data values for the query parameters
        await client.query(updateUserQuery, [user_id, ...updateValues]);

        // 3. Update the status of the profile_update_request to 'approved'
        const updateRequestQuery = `
            UPDATE profile_update_requests
            SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const updatedRequest = await client.query(updateRequestQuery, [admin_id, requestId]);

        await client.query('COMMIT');
        console.log(`Backend: Profile update request ${requestId} approved by admin ${admin_id}. User ${user_id} updated.`);
        res.status(200).json({
            message: 'Profile update request approved and user profile updated successfully.',
            request: updatedRequest.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/admin/profile-update-requests/:requestId/approve POST route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error approving profile update request: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// NEW ADMIN ENDPOINT: Reject a profile update request
app.post('/api/admin/profile-update-requests/:requestId/reject', authenticate, authorizeAdmin, async (req, res) => {
    const { requestId } = req.params;
    const admin_id = req.user.id; // ID of the admin performing the action
    const { admin_comment } = req.body; // Optional: reason for rejection

    let client = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Fetch the request to ensure it's pending
        const requestResult = await client.query(
            `SELECT id FROM profile_update_requests
             WHERE id = $1 AND status = 'pending'`,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Profile update request not found or not pending.' });
        }

        // 2. Update the status of the profile_update_request to 'rejected'
        const updateRequestQuery = `
            UPDATE profile_update_requests
            SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, admin_comment = $2
            WHERE id = $3
            RETURNING *;
        `;
        const updatedRequest = await client.query(updateRequestQuery, [admin_id, admin_comment, requestId]);

        await client.query('COMMIT');
        console.log(`Backend: Profile update request ${requestId} rejected by admin ${admin_id}.`);
        res.status(200).json({
            message: 'Profile update request rejected successfully.',
            request: updatedRequest.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/admin/profile-update-requests/:requestId/reject POST route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error rejecting profile update request: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// NEW ADMIN ENDPOINT: Get all pending profile update requests
app.get('/api/admin/profile-update-requests', authenticate, authorizeAdmin, async (req, res) => {
    let client = null;
    try {
        client = await pool.connect();

        const query = `
            SELECT
                pur.id,
                pur.user_id,
                u.name AS user_name,
                u.email AS user_email,
                pur.requested_data,
                pur.status,
                pur.requested_at
            FROM
                profile_update_requests pur
            JOIN
                users u ON pur.user_id = u.id
            WHERE
                pur.status = 'pending'
            ORDER BY
                pur.requested_at ASC;
        `;
        const result = await client.query(query);

        console.log(`Backend: Fetched ${result.rows.length} pending profile update requests.`);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Backend: Error in /api/admin/profile-update-requests GET route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error fetching profile update requests: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// --- PAYROLL MANAGEMENT ROUTES (ADMIN ONLY) ---

// POST /api/admin/payroll/settings - Configure company-wide payroll settings
// Body: { setting_name: 'EPF_EMPLOYEE_RATE', setting_value: '0.12', description: '...' }
app.post('/api/admin/payroll/settings', authenticate, authorizeAdmin, async (req, res) => {
    const { setting_name, setting_value, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO payroll_settings (setting_name, setting_value, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (setting_name) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [setting_name, setting_value, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving payroll setting:', error.message, error.stack);
        res.status(500).json({ message: 'Server error saving payroll setting.' });
    }
});

// GET /api/admin/payroll/settings - Get all payroll settings
app.get('/api/admin/payroll/settings', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_settings ORDER BY setting_name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payroll settings:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching payroll settings.' });
    }
});

// DELETE /api/admin/payroll/settings/:id - Delete a specific payroll setting
app.delete('/api/admin/payroll/settings/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM payroll_settings WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payroll setting not found.' });
        }
        res.json({ message: 'Payroll setting deleted successfully.', deletedSetting: result.rows[0] });
    } catch (error) {
        console.error('Error deleting payroll setting:', error.message, error.stack);
        res.status(500).json({ message: 'Server error deleting payroll setting.' });
    }
});


// POST /api/admin/salary-structures - Set/Update an employee's salary structure
// Body: { userId: 'uuid', effectiveDate: 'YYYY-MM-DD', basicSalary: 15000, hra: 7500, ... }
app.post('/api/admin/salary-structures', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, effectiveDate, basicSalary, hra, conveyanceAllowance, medicalAllowance, specialAllowance, lta, otherEarnings, grossSalary } = req.body;

    // Basic validation
    if (!userId || !effectiveDate || !basicSalary || !hra || !grossSalary) {
        return res.status(400).json({ message: 'Missing required salary structure fields.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO salary_structures (user_id, effective_date, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, lta, other_earnings, gross_salary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id, effective_date) DO UPDATE SET
                basic_salary = EXCLUDED.basic_salary,
                hra = EXCLUDED.hra,
                conveyance_allowance = EXCLUDED.conveyance_allowance,
                medical_allowance = EXCLUDED.medical_allowance,
                special_allowance = EXCLUDED.special_allowance,
                lta = EXCLUDED.lta,
                other_earnings = EXCLUDED.other_earnings,
                gross_salary = EXCLUDED.gross_salary,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, effectiveDate, basicSalary, hra, conveyanceAllowance || 0, medicalAllowance || 0, specialAllowance || 0, lta || 0, otherEarnings || {}, grossSalary]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving salary structure:', error.message, error.stack);
        res.status(500).json({ message: 'Server error saving salary structure.' });
    }
});

// GET /api/admin/salary-structures/:userId - Get an employee's salary structures (latest first)
app.get('/api/admin/salary-structures/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching salary structures:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching salary structures.' });
    }
});


// Helper function to map day names to Moment.js day numbers (0-6)
const dayNameToMomentDay = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
};

// Helper function to calculate attendance summary (used by both summary and payroll calculation)
async function calculateAttendanceSummary(userId, year, month, client) {
    console.log(`[CODE_VERSION_CHECK] Running calculateAttendanceSummary v8.15 (July 7, 2025 - Analytics Fix)`);
    // Ensure month is always two digits for consistent parsing
    const formattedMonth = String(month).padStart(2, '0');
    const startDateOfMonth = moment.utc(`${year}-${formattedMonth}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');
    const totalCalendarDays = endDateOfMonth.date(); // Number of days in the month

    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Calculating for User ID: ${userId}, Month: ${formattedMonth}, Year: ${year}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Period: ${startDateOfMonth.format('YYYY-MM-DD')} to ${endDateOfMonth.format('YYYY-MM-DD')}`);

    // Fetch all weekly off configurations for the employee that are relevant to the month
    const weeklyOffsConfigResult = await client.query(
        `SELECT weekly_off_days, effective_date, end_date FROM weekly_offs
         WHERE user_id = $1
         AND effective_date <= $2`, // Weekly off config is effective from this date onwards
        [userId, endDateOfMonth.format('YYYY-MM-DD')]
    );
    const weeklyOffsConfig = weeklyOffsConfigResult.rows;
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Raw weekly_offs_config from DB (${weeklyOffsConfig.length} rows):`, weeklyOffsConfig);

    // Fetch all public holidays for the month
    const holidaysResult = await client.query(
        `SELECT holiday_date FROM holidays
         WHERE holiday_date BETWEEN $1 AND $2`,
        [startDateOfMonth.format('YYYY-MM-DD'), endDateOfMonth.format('YYYY-MM-DD')]
    );
    const publicHolidayDates = new Set(holidaysResult.rows.map(row => moment.utc(row.holiday_date).format('YYYY-MM-DD')));
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Public Holiday Dates for month:`, Array.from(publicHolidayDates));

    // Fetch attendance records for the month
    const attendanceRecords = (await client.query(
        `SELECT date, status, check_in, check_out, working_hours, late_time, extra_hours FROM attendance
         WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`,
        [userId, month, year]
    )).rows;
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Raw attendance records from DB (${attendanceRecords.length} rows):`, attendanceRecords);

    const attendanceMap = new Map(
        attendanceRecords.map(att => [moment.utc(att.date).format('YYYY-MM-DD'), att])
    );

    let presentDays = 0;
    let lateDays = 0;
    let onLeaveDays = 0; // This will count *paid* leaves from attendance status
    let lopDays = 0; // This will count *unpaid* leaves from attendance status
    let absentWorkingDays = 0; // Days that should have been worked but weren't present/leave/lop
    let totalActualWorkingHours = 0;
    let actualWeeklyOffDays = 0;
    let holidaysCount = 0;
    let totalExpectedWorkingDays = 0; // Days employee was expected to work (not WO, not Holiday)

    const today = moment.utc().startOf('day');

    // Map to store daily statuses for the attendance history table / analytics display
    const dailyStatusMap = new Map();


    for (let day = 1; day <= totalCalendarDays; day++) {
        const currentDate = moment.utc(`${year}-${formattedMonth}-${String(day).padStart(2, '0')}`);
        const formattedDate = currentDate.format('YYYY-MM-DD');
        const currentMomentDayOfWeek = currentDate.day(); // 0 for Sunday, 6 for Saturday

        // Determine the most recent weekly off configuration for the current date
        const relevantWeeklyOffConfig = weeklyOffsConfig
            .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDate, 'day'))
            .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0]; // Get the latest one

        let isWeeklyOffForThisDay = false;
        if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
            const woEffectiveDate = moment.utc(relevantWeeklyOffConfig.effective_date);
            const woEndDate = relevantWeeklyOffConfig.end_date ? moment.utc(relevantWeeklyOffConfig.end_date) : null;

            isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(currentMomentDayOfWeek) &&
                                    currentDate.isSameOrAfter(woEffectiveDate, 'day') &&
                                    (!woEndDate || currentDate.isSameOrBefore(woEndDate, 'day'));
        }

        const isPublicHoliday = publicHolidayDates.has(formattedDate);

        // Skip if it's a holiday or weekly off
        if (isPublicHoliday) {
            holidaysCount++;
            dailyStatusMap.set(formattedDate, 'HOLIDAY');
            continue;
        }
        if (isWeeklyOffForThisDay) {
            actualWeeklyOffDays++;
            dailyStatusMap.set(formattedDate, 'WEEKLY OFF');
            continue;
        }

        // This is an expected working day (not holiday or weekly off)
        totalExpectedWorkingDays++; // Increment here for accurate total working days

        const record = attendanceMap.get(formattedDate);
        let dayCategorized = false; // Flag to ensure a day is categorized only once

        // --- NEW LOGIC: Directly use attendance.status for counts ---
        if (record) {
            switch (record.status.toUpperCase()) {
                case 'PRESENT':
                    presentDays++;
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'PRESENT');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as PRESENT (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'LATE':
                    presentDays++; // Still a present day
                    lateDays++;
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'LATE');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as LATE/PRESENT (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'ON_LEAVE': // This is the paid leave status from attendance table
                    onLeaveDays++;
                    dailyStatusMap.set(formattedDate, 'ON LEAVE');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ON LEAVE (Paid)`);
                    dayCategorized = true;
                    break;
                case 'LOP': // This is the unpaid leave status from attendance table
                    lopDays++;
                    dailyStatusMap.set(formattedDate, 'LOP');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as LOP (Unpaid)`);
                    dayCategorized = true;
                    break;
                case 'HALF-DAY':
                    presentDays += 0.5; // Count as half present
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'HALF-DAY');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as HALF-DAY ATTENDANCE (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'ABSENT':
                    absentWorkingDays++;
                    dailyStatusMap.set(formattedDate, 'ABSENT');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ABSENT (from attendance record)`);
                    dayCategorized = true;
                    break;
                default:
                    // If it's a past/current day and not explicitly handled by a known status, it's an absent day
                    if (currentDate.isSameOrBefore(today, 'day')) {
                        absentWorkingDays++;
                        dailyStatusMap.set(formattedDate, 'ABSENT');
                        console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Defaulted to ABSENT (unhandled status in record)`);
                    } else {
                        dailyStatusMap.set(formattedDate, 'N/A'); // Future days are N/A
                        console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Future day with no record, not counted as absent.`);
                    }
                    dayCategorized = true; // Still categorized, even if unknown status
                    break;
            }
        }

        // If no attendance record, and not categorized by holiday/weekly off, and it's a past/current working day
        if (!dayCategorized && !record && currentDate.isSameOrBefore(today, 'day')) {
            absentWorkingDays++;
            dailyStatusMap.set(formattedDate, 'ABSENT');
            console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ABSENT (no attendance record found for past/current working day)`);
        } else if (!dayCategorized && !record && currentDate.isAfter(today, 'day')) {
            dailyStatusMap.set(formattedDate, 'N/A'); // Future days without records are N/A
            console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Future day with no record, not counted as absent.`);
        }
    }

    // Final calculation adjustments
    // paidDays now explicitly counts days marked as 'on_leave' in attendance
    // unpaidLeaves now explicitly counts days marked as 'lop' or 'absent' in attendance
    const totalUnpaidLeaves = lopDays + absentWorkingDays; // LOP days + general absent days

    // paidDays should be the sum of present, late, and on_leave days
    // This needs to be carefully defined for payroll purposes.
    // For general analytics, `onLeaveDays` is your "Paid Leave Days"
    // `lopDays` is your "LOP Days"
    // `absentWorkingDays` are unapproved absences.
    // `presentDays` includes 'PRESENT' and 'LATE' statuses.

    // For payroll, "Paid Days" are typically Present + Late + On_Leave
    const paidDaysForPayroll = presentDays + onLeaveDays;

    const totalDaysForAvgHours = presentDays + onLeaveDays; // Sum of physically present days and paid leave days
    const averageDailyHours = totalDaysForAvgHours > 0 ? parseFloat((totalActualWorkingHours / totalDaysForAvgHours).toFixed(2)) : 0;


    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Final Counts:`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Present Days: ${presentDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Late Days (from attendance): ${lateDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   On Leave Days (Paid Approved Leaves from Attendance): ${onLeaveDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   LOP Days (Unpaid Leaves from Attendance): ${lopDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Absent Working Days (from Attendance): ${absentWorkingDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Unpaid Leaves (LOP + Absent): ${totalUnpaidLeaves}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Paid Days (for Payroll): ${paidDaysForPayroll}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Actual Working Hours: ${totalActualWorkingHours.toFixed(2)}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Average Daily Hours: ${averageDailyHours}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Holidays Count: ${holidaysCount}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Actual Weekly Off Days: ${actualWeeklyOffDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Expected Working Days in Month: ${totalExpectedWorkingDays}`);


    return {
        totalCalendarDays,
        totalWorkingDaysInMonth: totalExpectedWorkingDays,
        actualWeeklyOffDays,
        holidaysCount,
        presentDays: parseFloat(presentDays.toFixed(2)),
        lateDays: parseFloat(lateDays.toFixed(2)),
        leaveDays: parseFloat(onLeaveDays.toFixed(2)), // This is the count of 'on_leave' days from attendance
        lopDays: parseFloat(lopDays.toFixed(2)),     // This is the count of 'lop' days from attendance
        absentDays: parseFloat(absentWorkingDays.toFixed(2)), // Unaccounted absences
        paidDays: parseFloat(paidDaysForPayroll.toFixed(2)), // Total paid days for salary calculation
        unpaidLeaves: parseFloat(totalUnpaidLeaves.toFixed(2)), // Total unpaid for salary calculation
        totalWorkingHours: parseFloat(totalActualWorkingHours.toFixed(2)),
        averageDailyHours: averageDailyHours,
        dailyStatusMap: Object.fromEntries(dailyStatusMap) // Convert Map to plain object for JSON serialization
    };
}

// GET /api/admin/attendance/summary/:userId/:year/:month - Get attendance summary for a specific employee and month
app.get('/api/admin/attendance/summary/:userId/:year/:month', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, year, month } = req.params;
    const client = await pool.connect();
    try {
        const summary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);
        res.json(summary);
    } catch (error) {
        console.error('Error fetching employee attendance summary:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching attendance summary.' });
    } finally {
        client.release();
    }
});


// GET /api/admin/payroll/preview/:userId/:year/:month - Preview payslip calculation for a single employee
app.get('/api/admin/payroll/preview/:userId/:year/:month', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, year, month } = req.params;
    const client = await pool.connect();

    try {
        // Fetch necessary payroll settings
        const payrollSettings = (await client.query('SELECT setting_name, setting_value FROM payroll_settings')).rows.reduce((acc, s) => {
            acc[s.setting_name] = s.setting_value;
            return acc;
        }, {});

        const EPF_EMPLOYEE_RATE = parseFloat(payrollSettings.EPF_EMPLOYEE_RATE || '0.12');
        const EPF_EMPLOYER_RATE = parseFloat(payrollSettings.EPF_EMPLOYER_RATE || '0.12');
        const EPF_MAX_SALARY_LIMIT = parseFloat(payrollSettings.EPF_MAX_SALARY_LIMIT || '15000');
        const ESI_EMPLOYEE_RATE = parseFloat(payrollSettings.ESI_EMPLOYEE_RATE || '0.0075');
        const ESI_EMPLOYER_RATE = parseFloat(payrollSettings.ESI_EMPLOYER_RATE || '0.0325');
        const ESI_WAGE_LIMIT = parseFloat(payrollSettings.ESI_WAGE_LIMIT || '21000');
        const PROFESSIONAL_TAX_WEST_BENGAL_RATE = parseFloat(payrollSettings.PROFESSIONAL_TAX_WEST_BENGAL || '200');

        // Fetch Employee's Latest Salary Structure
        let salaryStructure = null;
        const salaryStructureResult = await client.query(
            'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC LIMIT 1',
            [userId]
        );
        salaryStructure = salaryStructureResult.rows[0];


        if (!salaryStructure) {
            return res.status(404).json({ message: 'No salary structure found for this employee.' });
        }

        // Get detailed attendance summary using the helper function
        const attendanceSummary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);

        const totalDaysInMonth = attendanceSummary.totalCalendarDays; // Calendar days, for pro-rata denominator
        const paidDays = attendanceSummary.paidDays; // Actual paid days for salary calculation
        const totalUnpaidDays = attendanceSummary.unpaidLeaves;


        // Earnings Calculation (Pro-rata based on paidDays)
        const proRataFactor = (attendanceSummary.totalWorkingDaysInMonth > 0) ? (paidDays / attendanceSummary.totalWorkingDaysInMonth) : 0;

        let basicSalaryMonthly = salaryStructure.basic_salary * proRataFactor;
        let hraMonthly = salaryStructure.hra * proRataFactor;
        let conveyanceAllowanceMonthly = salaryStructure.conveyance_allowance * proRataFactor;
        let medicalAllowanceMonthly = salaryStructure.medical_allowance * proRataFactor;
        let specialAllowanceMonthly = salaryStructure.special_allowance * proRataFactor;
        let ltaMonthly = salaryStructure.lta * proRataFactor;

        let grossEarnings = basicSalaryMonthly + hraMonthly + conveyanceAllowanceMonthly + medicalAllowanceMonthly + specialAllowanceMonthly + ltaMonthly;

        let otherEarningsParsed = {};
        if (salaryStructure.other_earnings) {
            try {
                otherEarningsParsed = salaryStructure.other_earnings;
                for (const key in otherEarningsParsed) {
                    grossEarnings += (parseFloat(otherEarningsParsed[key]) || 0) * proRataFactor;
                }
            } catch (e) {
                console.error(`Error parsing other_earnings for user ${userId} during preview:`, e);
            }
        }


        // Statutory Deductions Calculation
        let totalDeductions = 0;
        let epfEmployee = 0;
        let epfEmployer = 0;
        let esiEmployee = 0;
        let esiEmployer = 0;
        let professionalTax = 0;
        let tds = 0;
        let loanDeduction = 0;
        let otherDeductions = {};

        // EPF Calculation
        const epfApplicableSalary = Math.min(basicSalaryMonthly, EPF_MAX_SALARY_LIMIT);
        epfEmployee = epfApplicableSalary * EPF_EMPLOYEE_RATE;
        epfEmployer = epfApplicableSalary * EPF_EMPLOYER_RATE;
        totalDeductions += epfEmployee;

        // ESI Calculation
        if (grossEarnings <= ESI_WAGE_LIMIT) {
            esiEmployee = grossEarnings * ESI_EMPLOYEE_RATE;
            esiEmployer = grossEarnings * ESI_EMPLOYER_RATE;
            totalDeductions += esiEmployee;
        }

        // Professional Tax Calculation for West Bengal (Fixed ₹200 if gross earnings > 0)
        if (grossEarnings > 0) {
            professionalTax = PROFESSIONAL_TAX_WEST_BENGAL_RATE;
        } else {
            professionalTax = 0;
        }
        totalDeductions += professionalTax;

        tds = 0; // Placeholder
        totalDeductions += tds;

        loanDeduction = 0; // Placeholder
        totalDeductions += loanDeduction;

        // Net Pay Calculation
        let netPay = grossEarnings - totalDeductions;

        // Round all numeric values to 2 decimal places
        const previewResult = {
            payslip_month: parseInt(month),
            payslip_year: parseInt(year),
            gross_earnings: parseFloat(grossEarnings.toFixed(2)),
            basic_salary: parseFloat(basicSalaryMonthly.toFixed(2)),
            hra: parseFloat(hraMonthly.toFixed(2)),
            conveyance_allowance: parseFloat(conveyanceAllowanceMonthly.toFixed(2)),
            medical_allowance: parseFloat(medicalAllowanceMonthly.toFixed(2)),
            special_allowance: parseFloat(specialAllowanceMonthly.toFixed(2)),
            lta: parseFloat(ltaMonthly.toFixed(2)),
            other_earnings: otherEarningsParsed,
            total_deductions: parseFloat(totalDeductions.toFixed(2)),
            epf_employee: parseFloat(epfEmployee.toFixed(2)),
            epf_employer: parseFloat(epfEmployer.toFixed(2)),
            esi_employee: parseFloat(esiEmployee.toFixed(2)),
            esi_employer: parseFloat(esiEmployer.toFixed(2)),
            professional_tax: parseFloat(professionalTax.toFixed(2)),
            tds: parseFloat(tds.toFixed(2)),
            loan_deduction: parseFloat(loanDeduction.toFixed(2)),
            other_deductions: otherDeductions,
            net_pay: parseFloat(netPay.toFixed(2)),
            paid_days: parseFloat(paidDays.toFixed(2)),
            unpaid_leaves: parseFloat(totalUnpaidDays.toFixed(2)),
            // Include more detailed attendance summary for transparency
            attendance_summary: {
                totalCalendarDays: attendanceSummary.totalCalendarDays,
                totalWorkingDaysInMonth: attendanceSummary.totalWorkingDaysInMonth,
                actualWeeklyOffDays: attendanceSummary.actualWeeklyOffDays,
                presentDays: attendanceSummary.presentDays,
                lateDays: attendanceSummary.lateDays,
                leaveDays: attendanceSummary.leaveDays,
                lopDays: attendanceSummary.lopDays,
                absentDays: attendanceSummary.absentDays,
                totalWorkingHours: attendanceSummary.totalWorkingHours,
                averageDailyHours: attendanceSummary.averageDailyHours
            }
        };

        res.json(previewResult);

    } catch (error) {
        console.error('Error previewing payroll:', error.message, error.stack);
        res.status(500).json({ message: 'Server error previewing payroll.', error: error.message });
    } finally {
        client.release();
    }
});


// POST /api/admin/payroll/run - Initiate a payroll calculation for a month/year
// This endpoint will now also generate PDF payslips and store their paths.
app.post('/api/admin/payroll/run', authenticate, authorizeAdmin, async (req, res) => {
    const { month, year } = req.body;
    const adminId = req.user.id; // Admin performing the run
    const client = await pool.connect();

    if (!month || !year) {
        return res.status(400).json({ message: 'Payroll month and year are required.' });
    }

    try {
        await client.query('BEGIN');

        // Check if a payroll run for this month/year already exists
        let payrollRunResult = await client.query(
            'SELECT id FROM payroll_runs WHERE payroll_month = $1 AND payroll_year = $2',
            [month, year]
        );
        let payrollRunId;

        if (payrollRunResult.rows.length > 0) {
            payrollRunId = payrollRunResult.rows[0].id;
            // Optionally, update status to 'Recalculating' or similar
            await client.query(
                `UPDATE payroll_runs SET status = 'Recalculating', updated_at = CURRENT_TIMESTAMP, processed_by = $1
                 WHERE id = $2`,
                [adminId, payrollRunId]
            );
            // Delete existing payslips for this run to recalculate
            await client.query('DELETE FROM payslips WHERE payroll_run_id = $1', [payrollRunId]);
        } else {
            // Create a new payroll run record
            const newRunResult = await client.query(
                `INSERT INTO payroll_runs (payroll_month, payroll_year, status, processed_by)
                 VALUES ($1, $2, 'Calculating', $3) RETURNING id`,
                [month, year, adminId]
            );
            payrollRunId = newRun.rows[0].id;
        }

        // --- FETCH NECESSARY PAYROLL SETTINGS ---
        const payrollSettings = (await client.query('SELECT setting_name, setting_value FROM payroll_settings')).rows.reduce((acc, s) => {
            acc[s.setting_name] = s.setting_value;
            return acc;
        }, {});

        const EPF_EMPLOYEE_RATE = parseFloat(payrollSettings.EPF_EMPLOYEE_RATE || '0.12');
        const EPF_EMPLOYER_RATE = parseFloat(payrollSettings.EPF_EMPLOYER_RATE || '0.12');
        const EPF_MAX_SALARY_LIMIT = parseFloat(payrollSettings.EPF_MAX_SALARY_LIMIT || '15000'); // Usually Basic + DA
        const ESI_EMPLOYEE_RATE = parseFloat(payrollSettings.ESI_EMPLOYEE_RATE || '0.0075');
        const ESI_EMPLOYER_RATE = parseFloat(payrollSettings.ESI_EMPLOYER_RATE || '0.0325');
        const ESI_WAGE_LIMIT = parseFloat(payrollSettings.ESI_WAGE_LIMIT || '21000');
        const PROFESSIONAL_TAX_WEST_BENGAL_RATE = parseFloat(payrollSettings.PROFESSIONAL_TAX_WEST_BENGAL || '200');


        // --- FETCH ALL ACTIVE EMPLOYEES ---
        const employees = (await client.query('SELECT id, name, employee_id, email FROM users WHERE role IN ($1, $2)', ['employee', 'admin'])).rows; // Include admins if they get payslips

        for (const employee of employees) {
            const userId = employee.id;
            console.log(`Processing payroll for: ${employee.name} (ID: ${userId})`);

            // 1. Fetch Employee's Latest Salary Structure
            let salaryStructure = (await client.query(
                'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC LIMIT 1',
                [userId]
            )).rows[0];

            if (!salaryStructure) {
                console.warn(`No salary structure found for user ${employee.name} (${userId}). Skipping payslip generation.`);
                continue; // Skip if no salary structure defined
            }

            // 2. Get detailed attendance summary using the helper function
            const attendanceSummary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);

            const totalDaysInMonth = attendanceSummary.totalCalendarDays; // Calendar days, for pro-rata denominator
            const paidDays = attendanceSummary.paidDays; // Actual paid days for salary calculation
            const unpaidLeaves = attendanceSummary.unpaidLeaves;


            // 3. Earnings Calculation (Pro-rata based on paidDays)
            const proRataFactor = (attendanceSummary.totalWorkingDaysInMonth > 0) ? (paidDays / attendanceSummary.totalWorkingDaysInMonth) : 0;

            let basicSalaryMonthly = salaryStructure.basic_salary * proRataFactor;
            let hraMonthly = salaryStructure.hra * proRataFactor;
            let conveyanceAllowanceMonthly = salaryStructure.conveyance_allowance * proRataFactor;
            let medicalAllowanceMonthly = salaryStructure.medical_allowance * proRataFactor;
            let specialAllowanceMonthly = salaryStructure.special_allowance * proRataFactor;
            let ltaMonthly = salaryStructure.lta * proRataFactor;

            let grossEarnings = basicSalaryMonthly + hraMonthly + conveyanceAllowanceMonthly + medicalAllowanceMonthly + specialAllowanceMonthly + ltaMonthly;

            let otherEarningsParsed = {};
            if (salaryStructure.other_earnings) {
                try {
                    otherEarningsParsed = salaryStructure.other_earnings; // Already JSONB, no need to parse again
                    for (const key in otherEarningsParsed) {
                        grossEarnings += (parseFloat(otherEarningsParsed[key]) || 0) * proRataFactor;
                    }
                } catch (e) {
                    console.error(`Error parsing other_earnings for user ${userId}:`, e);
                }
            }


            // 4. Statutory Deductions Calculation
            let totalDeductions = 0;
            let epfEmployee = 0;
            let epfEmployer = 0; // Employer contribution is usually displayed on payslip
            let esiEmployee = 0;
            let esiEmployer = 0;
            let professionalTax = 0;
            let tds = 0; // Tax Deducted at Source
            let loanDeduction = 0; // Placeholder for future loan deductions
            let otherDeductions = {}; // Placeholder for other custom deductions

            // EPF Calculation (Employee & Employer Share)
            const epfApplicableSalary = Math.min(basicSalaryMonthly, EPF_MAX_SALARY_LIMIT);
            epfEmployee = epfApplicableSalary * EPF_EMPLOYEE_RATE;
            epfEmployer = epfApplicableSalary * EPF_EMPLOYER_RATE; // Employer share, often shown for transparency
            totalDeductions += epfEmployee;

            // ESI Calculation
            if (grossEarnings <= ESI_WAGE_LIMIT) {
                esiEmployee = grossEarnings * ESI_EMPLOYEE_RATE;
                esiEmployer = grossEarnings * ESI_EMPLOYER_RATE;
                totalDeductions += esiEmployee;
            }

            // Professional Tax Calculation for West Bengal (Fixed ₹200 if gross earnings > 0)
            if (grossEarnings > 0) {
                professionalTax = PROFESSIONAL_TAX_WEST_BENGAL_RATE;
            } else {
                professionalTax = 0;
            }
            totalDeductions += professionalTax;

            tds = 0; // **IMPORTANT: Implement actual TDS calculation here based on full Indian IT rules**
            totalDeductions += tds;

            loanDeduction = 0; // Example: fetch from a 'employee_loans' table
            totalDeductions += loanDeduction;

            // 5. Net Pay Calculation
            let netPay = grossEarnings - totalDeductions;

            // Round all numeric values to 2 decimal places for storage
            grossEarnings = parseFloat(grossEarnings.toFixed(2));
            basicSalaryMonthly = parseFloat(basicSalaryMonthly.toFixed(2));
            hraMonthly = parseFloat(hraMonthly.toFixed(2));
            conveyanceAllowanceMonthly = parseFloat(conveyanceAllowanceMonthly.toFixed(2));
            medicalAllowanceMonthly = parseFloat(medicalAllowanceMonthly.toFixed(2));
            specialAllowanceMonthly = parseFloat(specialAllowanceMonthly.toFixed(2));
            ltaMonthly = parseFloat(ltaMonthly.toFixed(2));
            totalDeductions = parseFloat(totalDeductions.toFixed(2));
            epfEmployee = parseFloat(epfEmployee.toFixed(2));
            epfEmployer = parseFloat(epfEmployer.toFixed(2));
            esiEmployee = parseFloat(esiEmployee.toFixed(2));
            esiEmployer = parseFloat(esiEmployer.toFixed(2));
            professionalTax = parseFloat(professionalTax.toFixed(2));
            tds = parseFloat(tds.toFixed(2));
            loanDeduction = parseFloat(loanDeduction.toFixed(2));
            netPay = parseFloat(netPay.toFixed(2));

            // Construct payslip data object for PDF generation
            const payslipData = {
                employeeName: employee.name,
                employeeId: employee.employee_id,
                payslipMonth: month,
                payslipYear: year,
                grossEarnings,
                basicSalary: basicSalaryMonthly,
                hra: hraMonthly,
                conveyanceAllowance: conveyanceAllowanceMonthly,
                medicalAllowance: medicalAllowanceMonthly,
                specialAllowance: specialAllowanceMonthly,
                lta: ltaMonthly,
                otherEarnings: otherEarningsParsed,
                totalDeductions,
                epfEmployee,
                epfEmployer,
                esiEmployee,
                esiEmployer,
                professionalTax,
                tds,
                loanDeduction,
                otherDeductions,
                netPay,
                paidDays,
                unpaidLeaves,
                daysPresent: attendanceSummary.presentDays + (attendanceSummary.halfDays * 0.5 || 0),
                attendanceSummary: attendanceSummary
            };

            let payslipFilePath = null;
            try {
                const payslipFileName = `payslip_${employee.employee_id}_${year}_${String(month).padStart(2, '0')}.pdf`;
                const payslipsDir = path.join(__dirname, 'uploads', 'payslips');
                const fullPayslipPath = path.join(payslipsDir, payslipFileName);

                if (!fs.existsSync(payslipsDir)) {
                    fs.mkdirSync(payslipsDir, { recursive: true });
                }
                
                const doc = new PDFDocument();
                doc.pipe(fs.createWriteStream(fullPayslipPath));

                doc.fontSize(18).text(`Payslip for ${payslipData.employeeName}`, { align: 'center' });
                doc.fontSize(12).text(`Month: ${moment().month(payslipData.payslipMonth - 1).format('MMMM')} ${payslipData.payslipYear}`, { align: 'center' });
                doc.moveDown();

                doc.fontSize(14).text('Earnings:', { underline: true });
                doc.fontSize(12)
                   .text(`Basic Salary: ₹${payslipData.basicSalary}`)
                   .text(`HRA: ₹${payslipData.hra}`)
                   .text(`Conveyance Allowance: ₹${payslipData.conveyanceAllowance}`)
                   .text(`Medical Allowance: ₹${payslipData.medicalAllowance}`)
                   .text(`Special Allowance: ₹${payslipData.specialAllowance}`)
                   .text(`LTA: ₹${payslipData.lta}`);

                if (Object.keys(payslipData.otherEarnings).length > 0) {
                    doc.text('Other Earnings:');
                    for (const key in payslipData.otherEarnings) {
                        doc.text(`  ${key}: ₹${payslipData.otherEarnings[key]}`);
                    }
                }
                doc.text(`Gross Earnings: ₹${payslipData.grossEarnings}`);
                doc.moveDown();

                doc.fontSize(14).text('Deductions:', { underline: true });
                doc.fontSize(12)
                   .text(`EPF (Employee): ₹${payslipData.epfEmployee}`)
                   .text(`ESI (Employee): ₹${payslipData.esiEmployee}`)
                   .text(`Professional Tax: ₹${payslipData.professionalTax}`)
                   .text(`TDS: ₹${payslipData.tds}`)
                   .text(`Loan Deduction: ₹${payslipData.loanDeduction}`);
                doc.text(`Total Deductions: ₹${payslipData.totalDeductions}`);
                doc.moveDown();

                doc.fontSize(16).text(`Net Pay: ₹${payslipData.netPay}`, { align: 'right' });

                doc.end();
                
                payslipFilePath = path.join('uploads', 'payslips', payslipFileName);
                console.log(`[PDF_GENERATION_INFO] PDF generated at: ${fullPayslipPath}`);

            } catch (pdfError) {
                console.error(`Error generating PDF for ${employee.name} (ID: ${userId}):`, pdfError.message);
                payslipFilePath = null;
            }


            // 6. Insert/Update Payslip Record in the database
            await client.query(
                `INSERT INTO payslips (
                    user_id, payroll_run_id, payslip_month, payslip_year,
                    gross_earnings, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, lta, other_earnings,
                    total_deductions, epf_employee, epf_employer, esi_employee, esi_employer, professional_tax, tds, loan_deduction, other_deductions,
                    net_pay, paid_days, unpaid_leaves, days_present, file_path
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
                ON CONFLICT (user_id, payslip_month, payslip_year) DO UPDATE SET
                    gross_earnings = EXCLUDED.gross_earnings,
                    basic_salary = EXCLUDED.basic_salary,
                    hra = EXCLUDED.hra,
                    conveyance_allowance = EXCLUDED.conveyance_allowance,
                    medical_allowance = EXCLUDED.medical_allowance,
                    special_allowance = EXCLUDED.special_allowance,
                    lta = EXCLUDED.lta,
                    other_earnings = EXCLUDED.other_earnings,
                    total_deductions = EXCLUDED.total_deductions,
                    epf_employee = EXCLUDED.epf_employee,
                    epf_employer = EXCLUDED.epf_employer,
                    esi_employee = EXCLUDED.esi_employee,
                    esi_employer = EXCLUDED.esi_employer,
                    professional_tax = EXCLUDED.professional_tax,
                    tds = EXCLUDED.tds,
                    loan_deduction = EXCLUDED.loan_deduction,
                    other_deductions = EXCLUDED.other_deductions,
                    net_pay = EXCLUDED.net_pay,
                    paid_days = EXCLUDED.paid_days,
                    unpaid_leaves = EXCLUDED.unpaid_leaves,
                    days_present = EXCLUDED.days_present,
                    file_path = COALESCE(EXCLUDED.file_path, payslips.file_path),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    userId, payrollRunId, month, year,
                    grossEarnings, basicSalaryMonthly, hraMonthly, conveyanceAllowanceMonthly, medicalAllowanceMonthly, specialAllowanceMonthly, ltaMonthly, otherEarningsParsed,
                    totalDeductions, epfEmployee, epfEmployer, esiEmployee, esiEmployer, professionalTax, tds, loanDeduction, otherDeductions,
                    netPay, paidDays, unpaidLeaves, attendanceSummary.presentDays + (attendanceSummary.halfDays * 0.5 || 0),
                    payslipFilePath
                ]
            );
        }

        // Update payroll run status to 'Calculated'
        await client.query(
            `UPDATE payroll_runs SET status = 'Calculated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [payrollRunId]
        );

        await client.query('COMMIT');
        res.json({ message: `Payroll for ${moment().month(month - 1).format('MMMM')} ${year} calculated successfully! Payslips generated and stored.`, payrollRunId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error running payroll:', error.message, error.stack);
        res.status(500).json({ message: 'Server error running payroll.', error: error.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/payslips/upload - Upload a payslip file (e.g., PDF) for an employee
const payslipUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path.join(__dirname, 'uploads', 'payslips');
            fs.mkdir(uploadPath, { recursive: true }, (err) => {
                if (err) {
                    console.error('Error creating payslip upload directory:', err);
                    return cb(err);
                }
                cb(null, uploadPath);
            });
        },
        filename: (req, file, cb) => {
            const { userId, month, year } = req.body;
            const filename = `payslip_${userId}_${year}_${month}${path.extname(file.originalname)}`;
            cb(null, filename);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for payslips!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.post('/api/admin/payslips/upload', authenticate, authorizeAdmin, payslipUpload.single('payslipFile'), async (req, res) => {
    const { userId, month, year } = req.body;
    // Store relative path for database, absolute path for file system operations
    const relativeFilePath = req.file ? path.join('uploads', 'payslips', req.file.filename) : null;

    if (!userId || !month || !year || !relativeFilePath) {
        return res.status(400).json({ message: 'Missing required fields or payslip file.' });
    }

    try {
        // Find the payroll_run_id for the given month/year
        let payrollRun = await pool.query(
            'SELECT id FROM payroll_runs WHERE payroll_month = $1 AND payroll_year = $2',
            [month, year]
        );
        let payrollRunId;
        if (payrollRun.rows.length === 0) {
            // If no payroll run exists, create a dummy one or reject
            const newRun = await pool.query(
                `INSERT INTO payroll_runs (payroll_month, payroll_year, status, processed_by, notes)
                 VALUES ($1, $2, 'Uploaded', $3, 'Payslip uploaded manually') RETURNING id`,
                [month, year, req.user.id]
            );
            payrollRunId = newRun.rows[0].id;
        } else {
            payrollRunId = payrollRun.rows[0].id;
        }

        // Insert or update payslip record with file path
        const result = await pool.query(
            `INSERT INTO payslips (user_id, payroll_run_id, payslip_month, payslip_year, file_path,
                                  gross_earnings, basic_salary, hra, total_deductions, net_pay)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 0)
             ON CONFLICT (user_id, payslip_month, payslip_year) DO UPDATE SET
                file_path = EXCLUDED.file_path,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, payrollRunId, month, year, relativeFilePath]
        );
        res.status(201).json({ message: 'Payslip uploaded successfully!', payslip: result.rows[0] });
    } catch (error) {
        console.error('Error uploading payslip:', error.message, error.stack);
        res.status(500).json({ message: 'Server error uploading payslip.', error: error.message });
    }
});

// GET /api/admin/payslips/list/:userId - List all payslips for a specific employee (for admin view)
app.get('/api/admin/payslips/list/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM payslips WHERE user_id = $1 ORDER BY payslip_year DESC, payslip_month DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employee payslips for admin:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching employee payslips.' });
    }
});

// GET /api/admin/payslips/:payslipId/details - Get full details of a specific payslip
app.get('/api/admin/payslips/:payslipId/details', authenticate, authorizeAdmin, async (req, res) => {
    const { payslipId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM payslips WHERE id = $1', [payslipId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching payslip details:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching payslip details.' });
    }
});

// --- EMPLOYEE PAYSLIP ROUTES ---

// GET /api/employee/payslips/my - Get all payslips for the logged-in employee
app.get('/api/employee/payslips/my', authenticate, async (req, res) => {
    const userId = req.user.id; // Get user ID from authenticated token
    try {
        const result = await pool.query(
            'SELECT id, payslip_month, payslip_year, gross_earnings, net_pay, file_path, created_at FROM payslips WHERE user_id = $1 ORDER BY payslip_year DESC, payslip_month DESC',
            [userId]
        );
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching my payslips:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching your payslips.' });
    }
});

// GET /api/employee/payslips/:payslipId/download - Download a specific payslip file
app.get('/api/employee/payslips/:payslipId/download', authenticate, async (req, res) => {
    const { payslipId } = req.params;
    const userId = req.user.id; // Get user ID from authenticated token

    try {
        const result = await pool.query(
            'SELECT file_path FROM payslips WHERE id = $1 AND user_id = $2',
            [payslipId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payslip not found or you do not have permission to download it.' });
        }

        const filePath = result.rows[0].file_path;
        const absolutePath = path.join(__dirname, filePath); // Construct absolute path

        // Ensure the file exists and is a PDF
        if (fs.existsSync(absolutePath) && path.extname(absolutePath).toLowerCase() === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(absolutePath)}"`);
            res.sendFile(absolutePath);
        } else {
            res.status(404).json({ message: 'Payslip file not found or is not a PDF.' });
        }
    } catch (error) {
        console.error('Error downloading payslip:', error.message, error.stack);
        res.status(500).json({ message: 'Server error downloading payslip.' });
    }
});

// GET /api/employee/weekly-offs - Get weekly off configurations for the logged-in employee
app.get('/api/employee/weekly-offs', authenticate, async (req, res) => {
    const user_id = req.user.id;
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required.' });
    }

    const startDateOfMonth = moment.utc(`${year}-${month}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, user_id, weekly_off_days, effective_date FROM weekly_offs
             WHERE user_id = $1
             AND effective_date <= $2
             ORDER BY effective_date DESC`, // Order by effective_date to get the most recent config
            [user_id, endDateOfMonth.format('YYYY-MM-DD')]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employee weekly offs:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching weekly offs.' });
    } finally {
        client.release();
    }
});

// GET /api/employee/holidays - Get public holidays for the month
app.get('/api/employee/holidays', authenticate, async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required.' });
    }

    const startDateOfMonth = moment.utc(`${year}-${month}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, holiday_date, holiday_name FROM holidays
             WHERE holiday_date BETWEEN $1 AND $2
             ORDER BY holiday_date`,
            [startDateOfMonth.format('YYYY-MM-DD'), endDateOfMonth.format('YYYY-MM-DD')]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching public holidays:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching public holidays.' });
    } finally {
        client.release();
    }
});



// Legacy Endpoint Redirects (for backward compatibility)
app.get('/holidays', authenticate, async (req, res) => {
  res.redirect(307, `/api/holidays?${new URLSearchParams(req.query).toString()}`);
});

app.get('/leaves', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/my');
});

app.post('/leaves/apply', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/apply');
});

app.get('/leave-balances', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/my-balances');
});

app.get('/notifications', authenticate, async (req, res) => {
  res.redirect(307, `/api/notifications/my?${new URLSearchParams(req.query).toString()}`);
});

app.get('/admin/leaves', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/leaves?${new URLSearchParams(req.query).toString()}`);
});

app.get('/admin/attendance/daily', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/attendance?${new URLSearchParams(req.query).toString()}`);
});

app.get('/admin/analytics/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/monthly-summary?${new URLSearchParams(req.query).toString()}`);
});

app.post('/admin/leaves/update-cancellation', authenticate, authorizeAdmin, async (req, res) => {
  const { id, status, admin_comment } = req.body;
  if (status === 'approved') {
    req.body.status = 'cancelled';
  } else if (status === 'rejected') {
    req.body.status = 'approved';
  }
  res.redirect(307, `/api/admin/leaves/${id}/status`);
});


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  res.status(500).json({ message: 'Internal server error.' });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
