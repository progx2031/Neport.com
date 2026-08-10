const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.NEPORT_DB_PATH || path.join(__dirname, "..", "data", "neport.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS citizen_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT UNIQUE NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  location TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Received',
  department TEXT,
  officer TEXT,
  date_submitted TEXT,
  expected_resolution TEXT,
  internal_notes TEXT,
  resolution_notes TEXT,
  ai_summary TEXT,
  citizen_name TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  location TEXT,
  contractor TEXT,
  approved_budget REAL DEFAULT 0,
  amount_spent REAL DEFAULT 0,
  start_date TEXT,
  expected_completion TEXT,
  completion_pct REAL DEFAULT 0,
  status TEXT DEFAULT 'Active',
  project_manager TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,
  stream TEXT NOT NULL,
  department TEXT,
  location TEXT,
  expected_amount REAL DEFAULT 0,
  actual_amount REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS permits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT UNIQUE NOT NULL,
  applicant_name TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  documents TEXT DEFAULT '[]',
  submission_date TEXT,
  status TEXT DEFAULT 'Draft',
  officer TEXT,
  review_notes TEXT,
  decision TEXT,
  approval_date TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  department TEXT,
  location TEXT,
  purchase_date TEXT,
  purchase_value REAL DEFAULT 0,
  condition TEXT DEFAULT 'Good',
  officer TEXT,
  maintenance_date TEXT,
  status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT,
  type TEXT,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  created_at TEXT DEFAULT (datetime('now')),
  is_read INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT (datetime('now')),
  actor TEXT,
  action TEXT NOT NULL,
  details TEXT
);
`);

module.exports = db;
