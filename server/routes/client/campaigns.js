const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');

// GET /api/client/campaigns
router.get('/', requireClient, (req, res) => {
  let customerId = req.user.customerId;
  // Fallback: look up by user_id in case JWT is missing customerId
  if (!customerId && req.user.id) {
    const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    customerId = customer ? customer.id : null;
  }
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'closed') as closed_leads
    FROM campaigns
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(customerId);

  const result = campaigns.map(c => {
    const funnels = db.prepare(`
      SELECT id, name, slug, status, published_at
      FROM funnels WHERE customer_id = ? AND (campaign_id = ? OR campaign_id IS NULL)
      ORDER BY status DESC, created_at DESC
    `).all(customerId, c.id);
    return {
      ...c,
      cost_per_lead: c.lead_count > 0 ? (c.budget_monthly / c.lead_count).toFixed(2) : null,
      funnels
    };
  });

  res.json(result);
});

// GET /api/client/campaigns/:id
router.get('/:id', requireClient, (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const campaign = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'closed') as closed_leads,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'new') as new_leads,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'contacted') as contacted_leads,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'appointment') as appointment_leads
    FROM campaigns c
    WHERE c.id = ? AND c.customer_id = ?
  `).get(req.params.id, customerId);

  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

  campaign.cost_per_lead = campaign.lead_count > 0 ? (campaign.budget_monthly / campaign.lead_count).toFixed(2) : null;

  res.json(campaign);
});

module.exports = router;
