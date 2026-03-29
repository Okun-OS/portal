const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../middleware/auth');
const metaAds = require('../../services/metaAds');

// POST /api/admin/integrations/meta/sync
// Syncs Meta Ads metrics for one or all campaigns
router.post('/meta/sync', requireAdmin, async (req, res) => {
  const { campaign_id } = req.body;

  try {
    if (campaign_id) {
      const result = await metaAds.syncCampaign(campaign_id);
      res.json({ success: true, results: [{ campaign_id, ...result, status: 'ok' }] });
    } else {
      const results = await metaAds.syncAllCampaigns();
      res.json({ success: true, results });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/integrations/meta/status
// Returns which campaigns have meta_campaign_id configured
router.get('/meta/status', requireAdmin, (req, res) => {
  const db = require('../../db');
  const campaigns = db.prepare(`
    SELECT id, name, meta_campaign_id, google_campaign_id, status
    FROM campaigns
    ORDER BY created_at DESC
  `).all();

  const configured = campaigns.filter(c => c.meta_campaign_id);
  res.json({
    total: campaigns.length,
    meta_configured: configured.length,
    api_ready: !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      meta_campaign_id: c.meta_campaign_id || null,
      google_campaign_id: c.google_campaign_id || null,
      status: c.status,
    }))
  });
});

module.exports = router;
