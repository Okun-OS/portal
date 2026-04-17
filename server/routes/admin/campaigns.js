const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

// GET /api/admin/campaigns
router.get('/', requireAdmin, (req, res) => {
  const { customer_id } = req.query;
  let where = '1=1';
  let params = [];

  if (customer_id) { where = 'c.customer_id = ?'; params.push(customer_id); }

  const campaigns = db.prepare(`
    SELECT c.*,
      cust.company_name,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'new') as new_leads,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'closed') as closed_leads
    FROM campaigns c
    LEFT JOIN customers cust ON cust.id = c.customer_id
    WHERE ${where}
    ORDER BY c.created_at DESC
  `).all(...params);

  res.json(campaigns);
});

// GET /api/admin/campaigns/:id
router.get('/:id', requireAdmin, (req, res) => {
  const campaign = db.prepare(`
    SELECT c.*, cust.company_name
    FROM campaigns c
    LEFT JOIN customers cust ON cust.id = c.customer_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

  const leads = db.prepare('SELECT * FROM leads WHERE campaign_id = ? ORDER BY created_at DESC').all(campaign.id);
  res.json({ ...campaign, leads });
});

// POST /api/admin/campaigns
router.post('/', requireAdmin, (req, res) => {
  const { customer_id, name, description, budget_monthly, status, start_date, end_date, platform, target_audience, google_campaign_id, meta_campaign_id, geo_targeting, wizard_step, ai_plan } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: 'Kunde und Name erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO campaigns (customer_id, name, description, budget_monthly, status, start_date, end_date, platform, target_audience, google_campaign_id, meta_campaign_id, geo_targeting, wizard_step, ai_plan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, name,
    description || null,
    budget_monthly || 0,
    status || 'active',
    start_date || null,
    end_date || null,
    platform || null,
    target_audience || null,
    google_campaign_id || null,
    meta_campaign_id || null,
    geo_targeting || '{}',
    wizard_step || 1,
    ai_plan || '{}'
  );

  // Return the full created campaign object
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(campaign);
});

// PUT /api/admin/campaigns/:id
router.put('/:id', requireAdmin, (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

  const { name, description, budget_monthly, status, start_date, end_date, platform, target_audience, google_campaign_id, meta_campaign_id, geo_targeting, wizard_step, ai_plan } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = ?, description = ?, budget_monthly = ?, status = ?,
      start_date = ?, end_date = ?, platform = ?, target_audience = ?,
      google_campaign_id = ?, meta_campaign_id = ?,
      geo_targeting = ?, wizard_step = ?, ai_plan = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? campaign.name,
    description ?? campaign.description,
    budget_monthly ?? campaign.budget_monthly,
    status ?? campaign.status,
    start_date ?? campaign.start_date,
    end_date ?? campaign.end_date,
    platform ?? campaign.platform,
    target_audience ?? campaign.target_audience,
    google_campaign_id !== undefined ? (google_campaign_id || null) : campaign.google_campaign_id,
    meta_campaign_id !== undefined ? (meta_campaign_id || null) : campaign.meta_campaign_id,
    geo_targeting !== undefined ? geo_targeting : (campaign.geo_targeting || '{}'),
    wizard_step !== undefined ? wizard_step : (campaign.wizard_step || 1),
    ai_plan !== undefined ? ai_plan : (campaign.ai_plan || '{}'),
    campaign.id
  );

  res.json({ success: true });
});

// DELETE /api/admin/campaigns/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
