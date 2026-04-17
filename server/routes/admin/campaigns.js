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

// GET /api/admin/campaigns/config  – public keys needed by frontend
router.get('/config', requireAdmin, (req, res) => {
  res.json({ google_maps_key: process.env.GOOGLE_API_KEY || '' });
});

// POST /api/admin/campaigns
router.post('/', requireAdmin, (req, res) => {
  const { customer_id, name, description, budget_monthly, status, start_date, end_date, platform, target_audience, google_campaign_id, meta_campaign_id } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: 'Kunde und Name erforderlich' });
  }

  const result = db.prepare(`
    INSERT INTO campaigns (customer_id, name, description, budget_monthly, status, start_date, end_date, platform, target_audience, google_campaign_id, meta_campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    meta_campaign_id || null
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Kampagne erstellt' });
});

// PUT /api/admin/campaigns/:id
router.put('/:id', requireAdmin, (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

  const {
    name, description, budget_monthly, status, start_date, end_date,
    platform, target_audience, google_campaign_id, meta_campaign_id,
    geo_lat, geo_lng, geo_radius_km, geo_location_name,
  } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = ?, description = ?, budget_monthly = ?, status = ?,
      start_date = ?, end_date = ?, platform = ?, target_audience = ?,
      google_campaign_id = ?, meta_campaign_id = ?,
      geo_lat = ?, geo_lng = ?, geo_radius_km = ?, geo_location_name = ?,
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
    meta_campaign_id  !== undefined ? (meta_campaign_id  || null) : campaign.meta_campaign_id,
    geo_lat           !== undefined ? (geo_lat           ?? null)  : campaign.geo_lat,
    geo_lng           !== undefined ? (geo_lng           ?? null)  : campaign.geo_lng,
    geo_radius_km     !== undefined ? (geo_radius_km     ?? null)  : campaign.geo_radius_km,
    geo_location_name !== undefined ? (geo_location_name ?? null)  : campaign.geo_location_name,
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
