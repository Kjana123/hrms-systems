const { Pool } = require('pg');


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool; // if reused across scripts

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
