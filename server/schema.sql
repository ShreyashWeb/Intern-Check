-- V3 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS internships (
  id SERIAL PRIMARY KEY,
  source_url TEXT UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  internship_id INTEGER REFERENCES internships(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'visible',
  report_type VARCHAR(50) DEFAULT 'concern',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_internship_user UNIQUE (internship_id, user_id)
);

CREATE TABLE IF NOT EXISTS domains (
  domain VARCHAR(255) PRIMARY KEY,
  age_days INTEGER,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration statements for existing databases (V6)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(50) DEFAULT 'concern';

-- Deduplicate reports table before adding constraint (keeps newest id)
DELETE FROM reports r1 USING reports r2
WHERE r1.id < r2.id 
  AND r1.internship_id = r2.internship_id 
  AND r1.user_id = r2.user_id;

-- Create unique constraint safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_internship_user') THEN
        ALTER TABLE reports ADD CONSTRAINT unique_internship_user UNIQUE (internship_id, user_id);
    END IF;
END;
$$;
