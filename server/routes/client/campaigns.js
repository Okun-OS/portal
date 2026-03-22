const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireClient } = require('../../middleware/auth');

// GET /api/client/campaigns
router.get('/', requireClient, (req, res) => {
  const customerId = req.user.customerId;
  if (!customerId) return res.status(403).json({ error: 'Kein Kundenkonto verknüpft' });

  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as lead_count,
      (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'closed') as closed_leads
    FROM campaigns
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(customerId);

  // Calculate cost per lead for each campaign
  const result = campaigns.map(c => ({
    ...c,
    cost_per_lead: c.lead_count > 0 ? (c.budget_monthly / c.lead_count).toFixed(2) : null
  }));

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
