require('dotenv').config(); 
const { Pool } = require('pg');

console.log('[DB_CONNECT_DEBUG] Raw DATABASE_URL from process.env:', process.env.DATABASE_URL); // ADDED DEBUG LOG
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('[DB_CONNECT_ERROR] DATABASE_URL is not defined. Please check your .env file and environment setup.');
    // You might want to throw an error or exit here if DATABASE_URL is critical
    // throw new Error('DATABASE_URL is not defined.');
} else {
    // For Neon, the DATABASE_URL should always contain sslmode=require.
    // The previous conditional stripping caused the 'connection is insecure' error.
    console.log('[DB_CONNECT_DEBUG] Using DATABASE_URL as is (assumes sslmode=require for Neon):', dbUrl); // UPDATED LOG
}


const pool = new Pool({
    connectionString: dbUrl, // Use the DATABASE_URL as is (it should include sslmode=require for Neon)
    // CRITICAL FIX: Set SSL to always be true with rejectUnauthorized: false for Neon.
    // Neon requires SSL, so this must be enabled regardless of NODE_ENV.
    ssl: { rejectUnauthorized: false }
});


module.exports = pool; // if reused across scripts

(async () => {
  try {
    await pool.query(`
      ALTER TABLE corrections
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log("✅ created_at column added to corrections.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to add created_at:", err);
    process.exit(1);
  }
})();
