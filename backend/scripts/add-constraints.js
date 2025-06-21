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
      ALTER TABLE attendance 
      ADD CONSTRAINT unique_user_date UNIQUE(user_id, date)
    `);
    console.log("✅ UNIQUE(user_id, date) constraint added to attendance.");
    process.exit(0);
  } catch (err) {
    if (err.code === '42710') {
      console.log("ℹ️ Constraint already exists. No changes made.");
    } else {
      console.error("❌ Failed to add unique constraint:", err);
    }
    process.exit(1);
  }
})();
