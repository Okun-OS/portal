const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

const VALID_STATUSES = ['new', 'contacted', 'appointment', 'closed'];

// GET /api/admin/leads
router.get('/', requireAdmin, (req, res) => {
  const { customer_id, status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (customer_id) { where.push('l.customer_id = ?'); params.push(customer_id); }
  if (status) { where.push('l.status = ?'); params.push(status); }
  if (search) {
    where.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.region LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM leads l WHERE ${where.join(' AND ')}`).get(...params).count;

  const leads = db.prepare(`
    SELECT l.*, c.company_name, c.contact_name as customer_name, camp.name as campaign_name
    FROM leads l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN campaigns camp ON camp.id = l.campaign_id
    WHERE ${where.join(' AND ')}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));

  res.json({ leads, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET /api/admin/leads/:id
router.get('/:id', requireAdmin, (req, res) => {
  const lead = db.prepare(`
    SELECT l.*, c.company_name, c.contact_name as customer_name, camp.name as campaign_name
    FROM leads l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN campaigns camp ON camp.id = l.campaign_id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  const notes = db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC').all(lead.id);
  const history = db.prepare('SELECT * FROM lead_history WHERE lead_id = ? ORDER BY created_at DESC').all(lead.id);
  const emails = db.prepare('SELECT * FROM lead_emails WHERE lead_id = ? ORDER BY sent_at DESC').all(lead.id);

  res.json({ ...lead, notes, history, emails });
});

// POST /api/admin/leads
router.post('/', requireAdmin, (req, res) => {
  const { customer_id, campaign_id, name, email, phone, region, source, status, quality, notes } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: 'Kunde und Name erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO leads (customer_id, campaign_id, name, email, phone, region, source, status, quality, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id,
    campaign_id || null,
    name,
    email || null,
    phone || null,
    region || null,
    source || null,
    status || 'new',
    quality || 'normal',
    notes || null
  );

  // Log creation
  db.prepare(`
    INSERT INTO lead_history (lead_id, field, old_value, new_value, changed_by)
    VALUES (?, 'status', null, ?, ?)
  `).run(result.lastInsertRowid, status || 'new', req.user.name);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Lead erstellt' });
});

// POST /api/admin/leads/import
router.post('/import', requireAdmin, (req, res) => {
  const { customer_id, campaign_id, leads } = req.body;
  if (!customer_id || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'customer_id und leads[] erforderlich' });
  }

  const insertLead = db.prepare(`
    INSERT INTO leads (customer_id, campaign_id, name, email, phone, region, source, status, quality)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'normal')
  `);

  const insertMany = db.transaction((leads) => {
    let count = 0;
    for (const lead of leads) {
      if (!lead.name) continue;
      insertLead.run(customer_id, campaign_id || null, lead.name, lead.email || null, lead.phone || null, lead.region || null, lead.source || null);
      count++;
    }
    return count;
  });

  const count = insertMany(leads);
  res.json({ imported: count });
});

// PUT /api/admin/leads/:id
router.put('/:id', requireAdmin, (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  const { name, email, phone, region, source, status, quality, notes, campaign_id } = req.body;

  // Track status change
  if (status && status !== lead.status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    db.prepare(`
      INSERT INTO lead_history (lead_id, field, old_value, new_value, changed_by)
      VALUES (?, 'status', ?, ?, ?)
    `).run(lead.id, lead.status, status, req.user.name);
  }

  db.prepare(`
    UPDATE leads SET
      name = ?, email = ?, phone = ?, region = ?, source = ?,
      status = ?, quality = ?, notes = ?, campaign_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? lead.name,
    email ?? lead.email,
    phone ?? lead.phone,
    region ?? lead.region,
    source ?? lead.source,
    status ?? lead.status,
    quality ?? lead.quality,
    notes ?? lead.notes,
    campaign_id !== undefined ? campaign_id : lead.campaign_id,
    lead.id
  );

  res.json({ success: true });
});

// POST /api/admin/leads/:id/notes
router.post('/:id/notes', requireAdmin, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Notiz darf nicht leer sein' });

  const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  db.prepare('INSERT INTO lead_notes (lead_id, author, content) VALUES (?, ?, ?)')
    .run(lead.id, req.user.name, content);

  res.status(201).json({ success: true });
});

// DELETE /api/admin/leads/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead nicht gefunden' });

  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
