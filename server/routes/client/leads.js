const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');
const nodemailer = require('nodemailer');

const VALID_STATUSES = ['new', 'contacted', 'appointment', 'closed'];

function getCustomerId(req, res) {
  const id = req.user.customerId;
  if (!id) { res.status(403).json({ error: 'Kein Kundenkonto verknüpft' }); return null; }
  return id;
}

// GET /api/client/leads
router.get('/', requireClient, (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['l.customer_id = ?'];
  let params = [customerId];

  if (status) { where.push('l.status = ?'); params.push(status); }
  if (search) {
    where.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.region LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM leads l WHERE ${where.join(' AND ')}`).get(...params).count;

  const leads = db.prepare(`
    SELECT l.id, l.name, l.email, l.phone, l.region, l.status, l.quality, l.source, l.created_at, l.updated_at,
      camp.name as campaign_name
    FROM leads l
    LEFT JOIN campaigns camp ON camp.id = l.campaign_id
    WHERE ${where.join(' AND ')}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));

  res.json({ leads, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET /api/client/leads/:id
router.get('/:id', requireClient, (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const lead = db.prepare(`
    SELECT l.*, camp.name as campaign_name
    FROM leads l
    LEFT JOIN campaigns camp ON camp.id = l.campaign_id
    WHERE l.id = ? AND l.customer_id = ?
  `).get(req.params.id, customerId);

  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  const notes = db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC').all(lead.id);
  const history = db.prepare('SELECT * FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC').all(lead.id);
  const emails = db.prepare('SELECT * FROM lead_emails WHERE lead_id = ? ORDER BY sent_at DESC').all(lead.id);

  res.json({ ...lead, notes, history, emails });
});

// PUT /api/client/leads/:id/status
router.put('/:id/status', requireClient, (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status. Erlaubt: ' + VALID_STATUSES.join(', ') });
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ? AND customer_id = ?').get(req.params.id, customerId);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  if (lead.status !== status) {
    db.prepare('INSERT INTO lead_history (lead_id, field, old_value, new_value, changed_by) VALUES (?, "status", ?, ?, ?)')
      .run(lead.id, lead.status, status, req.user.name);
  }

  db.prepare('UPDATE leads SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, lead.id);
  res.json({ success: true });
});

// POST /api/client/leads/:id/notes
router.post('/:id/notes', requireClient, (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Notiz darf nicht leer sein' });

  const lead = db.prepare('SELECT id FROM leads WHERE id = ? AND customer_id = ?').get(req.params.id, customerId);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  db.prepare('INSERT INTO lead_notes (lead_id, author, content) VALUES (?, ?, ?)')
    .run(lead.id, req.user.name, content);

  res.status(201).json({ success: true });
});

// POST /api/client/leads/:id/email
router.post('/:id/email', requireClient, async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'Betreff und Nachricht erforderlich' });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ? AND customer_id = ?').get(req.params.id, customerId);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });
  if (!lead.email) return res.status(400).json({ error: 'Lead hat keine E-Mail-Adresse' });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      await transporter.sendMail({
        from: `"${customer.contact_name}" <${process.env.SMTP_FROM}>`,
        to: lead.email,
        subject,
        text: body
      });
    }

    // Save to DB regardless
    db.prepare(`
      INSERT INTO lead_emails (lead_id, customer_id, direction, from_email, to_email, subject, body)
      VALUES (?, ?, 'outgoing', ?, ?, ?, ?)
    `).run(lead.id, customerId, customer.email, lead.email, subject, body);

    // Auto-update status to contacted if still 'new'
    if (lead.status === 'new') {
      db.prepare('UPDATE leads SET status = "contacted", updated_at = datetime("now") WHERE id = ?').run(lead.id);
      db.prepare('INSERT INTO lead_history (lead_id, field, old_value, new_value, changed_by) VALUES (?, "status", "new", "contacted", ?)')
        .run(lead.id, req.user.name + ' (E-Mail)');
    }

    res.json({ success: true, message: process.env.SMTP_USER ? 'E-Mail gesendet' : 'E-Mail gespeichert (SMTP nicht konfiguriert)' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden: ' + err.message });
  }
});

module.exports = router;
