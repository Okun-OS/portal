const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.join(__dirname, '..', 'data', 'portal.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

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

    -- Campaign Metrics (admin only – not visible to clients)
    CREATE TABLE IF NOT EXISTS campaign_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      date            TEXT    NOT NULL,
      impressions     INTEGER DEFAULT 0,
      clicks          INTEGER DEFAULT 0,
      spend           REAL    DEFAULT 0,
      leads_generated INTEGER DEFAULT 0,
      conversions     INTEGER DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(campaign_id, date)
    );

    -- AI Analyses (admin workspace – never exposed to clients)
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      type        TEXT NOT NULL, -- 'strategy' | 'ad_copy' | 'funnel' | 'optimization' | 'explain'
      prompt_data TEXT,          -- JSON: input context
      result      TEXT,          -- AI response text
      created_by  TEXT NOT NULL DEFAULT 'admin',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Optimization Tasks (internal to-do list)
    CREATE TABLE IF NOT EXISTS optimization_tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT,
      priority    TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'
      status      TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'in_progress' | 'done'
      source      TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'ai'
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Ad Creatives (AI-generated or manual copy)
    CREATE TABLE IF NOT EXISTS ad_creatives (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      type        TEXT NOT NULL, -- 'hook' | 'headline' | 'body' | 'landing_page' | 'cta'
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
      source      TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'ai'
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
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

// Funnels table
db.exec(`
  CREATE TABLE IF NOT EXISTS funnels (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    template_id  TEXT NOT NULL,
    name         TEXT NOT NULL,
    slug         TEXT UNIQUE,
    status       TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
    fields       TEXT NOT NULL DEFAULT '{}',     -- JSON: all filled data fields
    text_slots   TEXT NOT NULL DEFAULT '{}',     -- JSON: AI-generated texts
    image_slots  TEXT NOT NULL DEFAULT '{}',     -- JSON: uploaded image paths
    published_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Custom templates uploaded by admin (Framer exports, etc.)
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'Custom',
    description     TEXT,
    html_content    TEXT    NOT NULL,
    required_fields TEXT    NOT NULL DEFAULT '[]',
    optional_fields TEXT    NOT NULL DEFAULT '[]',
    image_slots     TEXT    NOT NULL DEFAULT '[]',
    text_slots      TEXT    NOT NULL DEFAULT '[]',
    form_definition TEXT    NOT NULL DEFAULT '{}',
    thank_you_page  TEXT    NOT NULL DEFAULT '{}',
    ai_prompt_hint  TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe migrations – add columns if they don't exist yet
const migrations = [
  'ALTER TABLE campaigns ADD COLUMN target_audience TEXT',
  'ALTER TABLE campaigns ADD COLUMN meta_campaign_id TEXT',
  'ALTER TABLE campaigns ADD COLUMN google_campaign_id TEXT',
  'ALTER TABLE leads ADD COLUMN funnel_id INTEGER REFERENCES funnels(id) ON DELETE SET NULL',
  'ALTER TABLE leads ADD COLUMN funnel_slug TEXT',
  // Campaign Wizard fields
  'ALTER TABLE campaigns ADD COLUMN geo_targeting TEXT DEFAULT \'{}\'',
  'ALTER TABLE campaigns ADD COLUMN wizard_step INTEGER DEFAULT 1',
  'ALTER TABLE campaigns ADD COLUMN ai_plan TEXT DEFAULT \'{}\'',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

module.exports = db;
