// middleware/authenticate.js
console.log(`[FILE_LOAD_CHECK] middleware/authenticate.js loaded at ${new Date().toISOString()}`);

const jwt = require('jsonwebtoken');
const pool = require('../db'); // Import the database pool from db.js
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

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

module.exports = {
  authenticate,
  authorizeAdmin,
};