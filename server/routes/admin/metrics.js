const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../../middleware/auth');

// GET /api/admin/metrics?campaign_id=&days=30
router.get('/', requireAdmin, (req, res) => {
  const { campaign_id, days = 30 } = req.query;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id erforderlich' });

  const since = new Date();
  since.setDate(since.getDate() - Number(days));
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT * FROM campaign_metrics
    WHERE campaign_id = ? AND date >= ?
    ORDER BY date ASC
  `).all(campaign_id, sinceStr);

  // Aggregate totals
  const totals = rows.reduce((acc, r) => ({
    impressions:     acc.impressions + r.impressions,
    clicks:          acc.clicks + r.clicks,
    spend:           acc.spend + r.spend,
    leads_generated: acc.leads_generated + r.leads_generated,
    conversions:     acc.conversions + r.conversions,
  }), { impressions: 0, clicks: 0, spend: 0, leads_generated: 0, conversions: 0 });

  totals.ctr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : '0.00';
  totals.cpc = totals.clicks > 0
    ? (totals.spend / totals.clicks).toFixed(2)
    : '0.00';
  totals.cpl = totals.leads_generated > 0
    ? (totals.spend / totals.leads_generated).toFixed(2)
    : '0.00';
  totals.conversion_rate = totals.clicks > 0
    ? ((totals.conversions / totals.clicks) * 100).toFixed(2)
    : '0.00';

  res.json({ rows, totals });
});

// POST /api/admin/metrics  – add or update a day's metrics
router.post('/', requireAdmin, (req, res) => {
  const { campaign_id, date, impressions, clicks, spend, leads_generated, conversions } = req.body;

  if (!campaign_id || !date) {
    return res.status(400).json({ error: 'campaign_id und date erforderlich' });
  }

  db.prepare(`
    INSERT INTO campaign_metrics (campaign_id, date, impressions, clicks, spend, leads_generated, conversions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, date) DO UPDATE SET
      impressions     = excluded.impressions,
      clicks          = excluded.clicks,
      spend           = excluded.spend,
      leads_generated = excluded.leads_generated,
      conversions     = excluded.conversions
  `).run(
    campaign_id, date,
    impressions || 0,
    clicks || 0,
    spend || 0,
    leads_generated || 0,
    conversions || 0
  );

  res.json({ success: true });
});

// DELETE /api/admin/metrics/:id
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM campaign_metrics WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
