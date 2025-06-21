const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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
