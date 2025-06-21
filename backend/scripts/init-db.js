// backend/scripts/init-db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
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
  '$2b$10$DcB2ZnySh6zZDF5PVme05uvxSeNNqIqH5wZ4E0TnWB1osTP7sFlWe', -- password = 123456
  'Test User'
)
ON CONFLICT (email) DO NOTHING;
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
