const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

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
