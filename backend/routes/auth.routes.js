// routes/auth.routes.js
console.log(`[FILE_LOAD_CHECK] routes/auth.routes.js loaded at ${new Date().toISOString()}`);

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
const pool = require('../db'); // Import the database pool
const transporter = require('../config/nodemailer'); // Import the transporter
const { authenticate } = require('../middleware/authenticate'); // Import auth middleware

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// --- Authentication Endpoints ---

// MODIFIED: app.get('/auth/me') to include new profile fields
// We are placing this in auth.routes.js but keeping the '/api/users/me' path
// This is because it is requested by the *authenticated user* about *themselves*.
router.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        id, name, email, role, employee_id, shift_type, address, mobile_number,
        kyc_details, personal_details, family_history, profile_photo,
        pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth
      FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = rows[0];
    res.json({
      ...user,
      profile_photo: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
      // Ensure date_of_birth is formatted as YYYY-MM-DD if it's a Date object
      date_of_birth: user.date_of_birth ? moment(user.date_of_birth).format('YYYY-MM-DD') : null,
    });
  } catch (error) {
    console.error('Error fetching user profile in /auth/me:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});


router.post('/login', async (req, res) => {
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

router.post('/refresh', async (req, res) => {
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
router.post('/logout', authenticate, async (req, res) => {
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

router.post('/change-password', authenticate, async (req, res) => {
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

router.post('/reset-password', async (req, res) => {
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

router.post('/reset-password/confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET); // This will throw if token is invalid/expired
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    //
    // CRITICAL FIX: Your original code had 'hashed.id' which would fail. It should be 'decoded.id'.
    // I have corrected this logic for you.
    //
    const { rowCount } = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'User not found or token invalid.' });
    }
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Confirm reset password error:', error.message, error.stack);
    res.status(400).json({ message: 'Invalid or expired reset token.' });
  }
});

module.exports = router;