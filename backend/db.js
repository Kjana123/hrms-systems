// db.js
console.log(`[FILE_LOAD_CHECK] db.js loaded at ${new Date().toISOString()}`);

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Pool Configuration - Now using DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // CRITICAL FIX: Make SSL conditional based on environment
    // Use SSL with rejectUnauthorized: false for production (e.g., Render, Neon)
    // Disable SSL (set to false) for local development where SSL might not be configured.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Connected to the database via db.js');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.stack);
});

module.exports = pool;