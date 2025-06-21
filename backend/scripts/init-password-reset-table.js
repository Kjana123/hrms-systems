const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool; // if reused across scripts

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