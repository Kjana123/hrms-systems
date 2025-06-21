const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

const createPasswordResetTokensTable = `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
`;

(async () => {
  try {
    await pool.query(createPasswordResetTokensTable);
    console.log("✅ password_reset_tokens table created successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating password_reset_tokens table:", err);
    process.exit(1);
  }
})();