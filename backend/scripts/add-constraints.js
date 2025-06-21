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
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_date'
        ) THEN
          ALTER TABLE attendance
          ADD CONSTRAINT unique_user_date UNIQUE(user_id, date);
        END IF;
      END
      $$;
    `);
    console.log("✅ UNIQUE(user_id, date) constraint ensured.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to add constraint:", err);
    process.exit(1);
  }
})();
