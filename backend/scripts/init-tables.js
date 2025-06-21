const initTables = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('employee', 'admin'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE,
  check_in TIMESTAMP,
  check_out TIMESTAMP,
  status TEXT,
  UNIQUE (user_id, date)  -- ✅ Fix 2
);

CREATE TABLE IF NOT EXISTS corrections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- ✅ Fix 1
);

CREATE TABLE IF NOT EXISTS leaves (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  from_date DATE,
  to_date DATE,
  reason TEXT,
  status TEXT
);
`;


(async () => {
  try {
    await pool.query(initTables);
    console.log("✅ All HRMS tables created successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating tables:", err);
    process.exit(1);
  }
})();
