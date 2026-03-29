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

// GET /api/admin/metrics/alerts?campaign_id=&days=30
// Returns threshold-based performance alerts for poorly performing campaigns
router.get('/alerts', requireAdmin, (req, res) => {
  const { campaign_id, days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));
  const sinceStr = since.toISOString().slice(0, 10);

  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const sinceStr7 = since7.toISOString().slice(0, 10);

  // Build query – either for one campaign or all active ones
  const campaignFilter = campaign_id ? 'c.id = ?' : "c.status = 'active'";
  const params = campaign_id ? [campaign_id] : [];

  const campaigns = db.prepare(`
    SELECT c.id, c.name, c.budget_monthly, c.platform,
      SUM(cm.impressions) as impressions,
      SUM(cm.clicks) as clicks,
      SUM(cm.spend) as spend,
      SUM(cm.leads_generated) as leads,
      MAX(cm.date) as last_metric_date,
      SUM(CASE WHEN cm.date >= '${sinceStr7}' THEN cm.impressions ELSE 0 END) as impressions_7d,
      SUM(CASE WHEN cm.date >= '${sinceStr7}' THEN cm.leads_generated ELSE 0 END) as leads_7d
    FROM campaigns c
    LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id AND cm.date >= '${sinceStr}'
    WHERE ${campaignFilter}
    GROUP BY c.id
  `).all(...params);

  const alerts = [];

  for (const c of campaigns) {
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null;
    const cpl = c.leads > 0 ? c.spend / c.leads : null;
    const daysSinceData = c.last_metric_date
      ? Math.floor((Date.now() - new Date(c.last_metric_date).getTime()) / 86400000)
      : null;

    const campAlerts = [];

    // No data at all
    if (!c.last_metric_date) {
      campAlerts.push({ level: 'warning', type: 'no_data', message: 'Noch keine Metriken eingetragen' });
    }

    // No impressions in last 7 days
    if (c.last_metric_date && c.impressions_7d === 0) {
      campAlerts.push({ level: 'error', type: 'no_impressions', message: 'Keine Impressionen in den letzten 7 Tagen — Kampagne läuft nicht?' });
    }

    // CTR critically low
    if (ctr !== null && c.impressions > 500 && ctr < 0.5) {
      campAlerts.push({ level: 'error', type: 'low_ctr', message: `CTR sehr niedrig: ${ctr.toFixed(2)}% (Ziel: >1%). Anzeigentext überarbeiten.` });
    } else if (ctr !== null && c.impressions > 500 && ctr < 1.0) {
      campAlerts.push({ level: 'warning', type: 'low_ctr', message: `CTR unter Benchmark: ${ctr.toFixed(2)}% (Ziel: >1%)` });
    }

    // No leads in last 14 days despite spend
    if (c.leads_7d === 0 && c.spend > 50) {
      campAlerts.push({ level: 'error', type: 'no_leads', message: `Keine Leads trotz ${c.spend.toFixed(0)}€ Ausgaben (letzte 30 Tage) — Funnel prüfen` });
    }

    // CPL > 3× monthly budget / expected leads (rough: budget/50 per lead)
    if (cpl !== null && c.budget_monthly > 0) {
      const targetCpl = c.budget_monthly / 50;
      if (cpl > targetCpl * 3) {
        campAlerts.push({ level: 'error', type: 'high_cpl', message: `CPL sehr hoch: ${cpl.toFixed(2)}€ (Zielwert ca. ${targetCpl.toFixed(0)}€). Budget oder Targeting anpassen.` });
      } else if (cpl > targetCpl * 2) {
        campAlerts.push({ level: 'warning', type: 'high_cpl', message: `CPL über Zielwert: ${cpl.toFixed(2)}€ (Zielwert ca. ${targetCpl.toFixed(0)}€)` });
      }
    }

    // Overspending
    if (c.budget_monthly > 0 && c.spend > c.budget_monthly * 1.1) {
      campAlerts.push({ level: 'warning', type: 'overspend', message: `Ausgaben ${c.spend.toFixed(0)}€ übersteigen Monatsbudget ${c.budget_monthly}€` });
    }

    if (campAlerts.length) {
      alerts.push({
        campaign_id: c.id,
        campaign_name: c.name,
        platform: c.platform,
        metrics: { impressions: c.impressions, clicks: c.clicks, spend: c.spend, leads: c.leads, ctr: ctr ? ctr.toFixed(2) : null, cpl: cpl ? cpl.toFixed(2) : null },
        alerts: campAlerts,
      });
    }
  }

  res.json({
    total_alerts: alerts.reduce((s, c) => s + c.alerts.length, 0),
    error_count:  alerts.reduce((s, c) => s + c.alerts.filter(a => a.level === 'error').length, 0),
    campaigns: alerts,
  });
});

// DELETE /api/admin/metrics/:id
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM campaign_metrics WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
