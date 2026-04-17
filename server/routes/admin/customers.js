const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const mailer = require('../../services/mailer');

function generatePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET /api/admin/customers
router.get('/', requireAdmin, (req, res) => {
  const customers = db.prepare(`
    SELECT c.*, u.email as login_email,
      (SELECT COUNT(*) FROM leads WHERE customer_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM campaigns WHERE customer_id = c.id) as campaign_count,
      (SELECT COUNT(*) FROM campaigns WHERE customer_id = c.id AND status = 'active') as active_campaign_count,
      (SELECT SUM(budget_monthly) FROM campaigns WHERE customer_id = c.id AND status = 'active') as budget_total,
      (SELECT SUM(cm.leads_generated) FROM campaign_metrics cm JOIN campaigns ca ON ca.id = cm.campaign_id
       WHERE ca.customer_id = c.id AND cm.date >= date('now', '-30 days')) as leads_30d,
      (SELECT SUM(cm.spend) FROM campaign_metrics cm JOIN campaigns ca ON ca.id = cm.campaign_id
       WHERE ca.customer_id = c.id AND cm.date >= date('now', '-30 days')) as spend_30d
    FROM customers c
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all();
  res.json(customers);
});

// GET /api/admin/customers/:id
router.get('/:id', requireAdmin, (req, res) => {
  const customer = db.prepare(`
    SELECT c.*, u.email as login_email
    FROM customers c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'new') as new_leads,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'closed') as closed_leads
    FROM campaigns c WHERE c.customer_id = ? ORDER BY c.created_at DESC
  `).all(customer.id);

  const recentLeads = db.prepare('SELECT * FROM leads WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10').all(customer.id);

  const leadStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
      SUM(CASE WHEN date(created_at) >= date('now', '-30 days') THEN 1 ELSE 0 END) as last_30_days
    FROM leads WHERE customer_id = ?
  `).get(customer.id);

  const budgetTotal = db.prepare(`
    SELECT SUM(budget_monthly) as total FROM campaigns WHERE customer_id = ? AND status = 'active'
  `).get(customer.id);

  const metrics = db.prepare(`
    SELECT SUM(cm.impressions) as impressions, SUM(cm.clicks) as clicks,
           SUM(cm.spend) as spend, SUM(cm.leads_generated) as leads_generated
    FROM campaign_metrics cm
    JOIN campaigns c ON c.id = cm.campaign_id
    WHERE c.customer_id = ? AND cm.date >= date('now', '-30 days')
  `).get(customer.id);

  res.json({ ...customer, campaigns, recentLeads, leadStats, budgetTotal: budgetTotal.total || 0, metrics });
});

// POST /api/admin/customers
router.post('/', requireAdmin, async (req, res) => {
  const { company_name, contact_name, email, phone, address, industry, notes } = req.body;

  if (!company_name || !contact_name || !email) {
    return res.status(400).json({ error: 'Firmenname, Ansprechpartner und E-Mail erforderlich' });
  }

  // Auto-create login using customer email
  const loginEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(loginEmail);
  if (existing) {
    return res.status(400).json({ error: 'Diese E-Mail ist bereits als Login vergeben' });
  }

  const password = generatePassword();
  const hash = bcrypt.hashSync(password, 10);
  const userResult = db.prepare(`INSERT INTO users (email, password, role, name) VALUES (?, ?, 'client', ?)`)
    .run(loginEmail, hash, contact_name);
  const userId = userResult.lastInsertRowid;

  const result = db.prepare(`
    INSERT INTO customers (user_id, company_name, contact_name, email, phone, address, industry, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, company_name, contact_name, email, phone || null, address || null, industry || null, notes || null);

  const customerId = result.lastInsertRowid;
  const customer = { company_name, contact_name, email };

  // Send welcome email (non-blocking – errors don't fail the request)
  let emailStatus = 'skipped';
  try {
    const mailResult = await mailer.sendWelcomeEmail({ customer, loginEmail, password });
    emailStatus = mailResult.sent ? 'sent' : 'skipped';
  } catch (e) {
    console.error('[mailer] welcome email failed:', e.message);
    emailStatus = 'failed';
  }

  res.status(201).json({ id: customerId, login_email: loginEmail, login_password: password, email_status: emailStatus });
});

// PUT /api/admin/customers/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { company_name, contact_name, email, phone, address, industry, notes } = req.body;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

  db.prepare(`
    UPDATE customers SET
      company_name = ?, contact_name = ?, email = ?, phone = ?,
      address = ?, industry = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    company_name || customer.company_name,
    contact_name || customer.contact_name,
    email || customer.email,
    phone ?? customer.phone,
    address ?? customer.address,
    industry ?? customer.industry,
    notes ?? customer.notes,
    req.params.id
  );

  res.json({ success: true });
});

// POST /api/admin/customers/:id/create-login
router.post('/:id/create-login', requireAdmin, async (req, res) => {
  const { login_email, login_password } = req.body;

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

  const email = (login_email || customer.email).toLowerCase().trim();
  const password = login_password || generatePassword();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing && existing.id !== customer.user_id) {
    return res.status(400).json({ error: 'E-Mail bereits vergeben' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`INSERT INTO users (email, password, role, name) VALUES (?, ?, 'client', ?)`)
    .run(email, hash, customer.contact_name);

  db.prepare('UPDATE customers SET user_id = ?, updated_at = datetime("now") WHERE id = ?')
    .run(result.lastInsertRowid, req.params.id);

  let emailStatus = 'skipped';
  try {
    const mailResult = await mailer.sendWelcomeEmail({ customer, loginEmail: email, password });
    emailStatus = mailResult.sent ? 'sent' : 'skipped';
  } catch (e) {
    console.error('[mailer] welcome email failed:', e.message);
    emailStatus = 'failed';
  }

  res.json({ success: true, login_email: email, login_password: password, email_status: emailStatus });
});

// POST /api/admin/customers/:id/send-welcome  – resend welcome email
router.post('/:id/send-welcome', requireAdmin, async (req, res) => {
  const customer = db.prepare('SELECT c.*, u.email as login_email FROM customers c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });
  if (!customer.login_email) return res.status(400).json({ error: 'Kein Login vorhanden' });

  const { new_password } = req.body;
  const password = new_password || generatePassword();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').run(hash, customer.user_id);

  try {
    await mailer.sendWelcomeEmail({ customer, loginEmail: customer.login_email, password });
    res.json({ success: true, login_password: password });
  } catch (e) {
    res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden: ' + e.message });
  }
});

// PUT /api/admin/customers/:id/reset-password
router.put('/:id/reset-password', requireAdmin, (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  }

  const customer = db.prepare('SELECT user_id FROM customers WHERE id = ?').get(req.params.id);
  if (!customer || !customer.user_id) {
    return res.status(404).json({ error: 'Kein Login für diesen Kunden vorhanden' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?')
    .run(hash, customer.user_id);

  res.json({ success: true });
});

// DELETE /api/admin/customers/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  if (customer.user_id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(customer.user_id);
  }

  res.json({ success: true });
});

module.exports = router;
