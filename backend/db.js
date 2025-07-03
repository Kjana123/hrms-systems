// db.js
const { Pool } = require('pg');
require('dotenv').config(); // Ensure you have dotenv installed and configured

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Your Neon connection string
  ssl: {
    rejectUnauthorized: false // Required for Neon if connecting from external environment
  }
});

pool.on('connect', () => {
  console.log('Connected to the database');
   console.log('DATABASE_URL being used:', process.env.DATABASE_URL ? '***URL_IS_PRESENT_AND_HIDDEN_FOR_SECURITY***' : 'DATABASE_URL environment variable is NOT set.');
});

pool.on('error', (err) => {
  console.error('Database error:', err.stack);
});

module.exports = pool;
