CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('employee', 'admin'))
);

CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE,
  check_in TIMESTAMP,
  check_out TIMESTAMP,
  status TEXT
);

CREATE TABLE corrections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE,
  reason TEXT,
  status TEXT
);

CREATE TABLE leaves (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  from_date DATE,
  to_date DATE,
  reason TEXT,
  status TEXT
);
