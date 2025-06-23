require('dotenv').config(); // Only needed locally

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Changed 'password' to 'password_hash' here
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  employee_id TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'employee',
  shift_type TEXT DEFAULT 'day',
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Changed 'password' to 'password_hash' here
const insertTestUser = `
INSERT INTO users (email, password_hash, name, employee_id, role, shift_type)
VALUES (
  'test@example.com',
  '$2b$10$eAScQSdf/WEwxscRjtowFehMo9ltFmP4xTdraFtFQnveaP4UWJSCa', -- bcrypt hashed "password"
  'Test User',
  'EMP001',     -- ✅ add employee_id
  'admin',      -- optional: make this a test admin
  'day'         -- shift_type default
)
ON CONFLICT (email)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  shift_type = EXCLUDED.shift_type;
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
