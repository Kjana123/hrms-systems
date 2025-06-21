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
      -- Add the role column if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users ADD COLUMN role TEXT;
        END IF;
      END
      $$;

      -- Drop old constraint and add correct one
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'employee'));
    `);

    console.log("✅ 'role' column ensured and constraint updated");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to fix role column/constraint:", err);
    process.exit(1);
  }
})();

