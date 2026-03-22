const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.join(__dirname, '..', 'data', 'portal.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    -- Users (admins and clients login here)
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'client', -- 'admin' | 'client'
      name        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Customers (businesses using the service)
    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_name  TEXT NOT NULL,
      contact_name  TEXT NOT NULL,
      email         TEXT NOT NULL,
      phone         TEXT,
      address       TEXT,
      industry      TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Campaigns
    CREATE TABLE IF NOT EXISTS campaigns (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name           TEXT    NOT NULL,
      description    TEXT,
      budget_monthly REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'ended'
      start_date     TEXT,
      end_date       TEXT,
      platform       TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Leads
    CREATE TABLE IF NOT EXISTS leads (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      name         TEXT NOT NULL,
      email        TEXT,
      phone        TEXT,
      region       TEXT,
      source       TEXT,
      status       TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'appointment' | 'closed'
      quality      TEXT DEFAULT 'normal',       -- 'low' | 'normal' | 'high'
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Lead Notes (history of notes)
    CREATE TABLE IF NOT EXISTS lead_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      author     TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Lead Status History
    CREATE TABLE IF NOT EXISTS lead_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      field       TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      changed_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Documents (offers & invoices)
    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      type        TEXT NOT NULL, -- 'offer' | 'invoice'
      title       TEXT NOT NULL,
      filename    TEXT NOT NULL,
      filepath    TEXT NOT NULL,
      amount      REAL,
      status      TEXT DEFAULT 'draft', -- 'draft' | 'sent' | 'paid'
      due_date    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Emails sent to/from leads
    CREATE TABLE IF NOT EXISTS lead_emails (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      direction   TEXT NOT NULL, -- 'outgoing' | 'incoming'
      from_email  TEXT NOT NULL,
      to_email    TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed admin user if not exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@leadportal.com';
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    db.prepare(`
      INSERT INTO users (email, password, role, name)
      VALUES (?, ?, 'admin', ?)
    `).run(adminEmail, hash, process.env.ADMIN_NAME || 'Administrator');
    console.log(`✓ Admin user created: ${adminEmail}`);
  }

  console.log('✓ Database initialized');
}

initializeDatabase();

module.exports = db;
