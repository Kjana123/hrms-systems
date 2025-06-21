// backend/scripts/init-db.js
require('dotenv').config(); // Only needed locally

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT
);
`;

const insertTestUser = `
INSERT INTO users (email, password, name)
VALUES (
  'test@example.com',
  '$2b$10$eAScQSdf/WEwxscRjtowFehMo9ltFmP4xTdraFtFQnveaP4UWJSCa', -- password = 123456
  'Test User'
)
ON CONFLICT (email) 
DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name;
`;

(async () => {
  try {
    await pool.query(createUsersTable);
    await pool.query(insertTestUser);
    console.log("✅ Users table created and test user inserted.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error initializing DB:", err);
    process.exit(1);
  }
})();
