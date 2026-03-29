const express = require('express');
const router = express.Router();
const db = require('../db');

// Webhook verification helper
function verifySecret(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured = open
  const provided = req.headers['x-webhook-secret'] || req.query.secret;
  return provided === secret;
}

// ── POST /api/webhooks/leads ─────────────────────────────────────────────────
// Accepts leads from: Zapier, Meta Lead Ads, Google Ads, custom forms
//
// Expected body (any of these formats):
//   { name, email, phone, source, customer_id, campaign_id }   ← generic
//   { field_data: [{name:'full_name',values:['...']},...] }     ← Meta Lead Ads
//   { lead: { name, email, phone } }                            ← Zapier wrapper
//
router.post('/leads', (req, res) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = req.body;
    let name, email, phone, source, customer_id, campaign_id;

    // --- Meta Lead Ads format ---
    if (body.field_data && Array.isArray(body.field_data)) {
      const get = (key) => {
        const field = body.field_data.find(f =>
          f.name === key || f.name === key.replace('_', ' ')
        );
        return field && field.values ? field.values[0] : null;
      };
      name = get('full_name') || get('name') || 'Unbekannt';
      email = get('email');
      phone = get('phone_number') || get('phone');
      source = 'Meta Lead Ads';
      customer_id = body.customer_id || req.query.customer_id;
      campaign_id = body.campaign_id || req.query.campaign_id || body.adgroup_id;

    // --- Zapier wrapper format ---
    } else if (body.lead) {
      name = body.lead.name || body.lead.full_name || 'Unbekannt';
      email = body.lead.email;
      phone = body.lead.phone;
      source = body.lead.source || 'Zapier';
      customer_id = body.customer_id || req.query.customer_id;
      campaign_id = body.campaign_id || req.query.campaign_id;

    // --- Generic / custom format ---
    } else {
      name = body.name || body.full_name || 'Unbekannt';
      email = body.email;
      phone = body.phone || body.phone_number;
      source = body.source || 'Webhook';
      customer_id = body.customer_id || req.query.customer_id;
      campaign_id = body.campaign_id || req.query.campaign_id;
    }

    if (!name || name === 'Unbekannt' && !email && !phone) {
      return res.status(400).json({ error: 'Keine verwertbaren Lead-Daten' });
    }

    // Resolve customer_id if campaign_id provided but no customer_id
    if (!customer_id && campaign_id) {
      const camp = db.prepare('SELECT customer_id FROM campaigns WHERE id = ?').get(campaign_id);
      if (camp) customer_id = camp.customer_id;
    }

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id erforderlich (als Query-Parameter oder im Body)' });
    }

    // Insert lead
    const result = db.prepare(`
      INSERT INTO leads (customer_id, campaign_id, name, email, phone, source, status, quality)
      VALUES (?, ?, ?, ?, ?, ?, 'new', 'normal')
    `).run(
      customer_id,
      campaign_id || null,
      name,
      email || null,
      phone || null,
      source
    );

    res.status(201).json({
      success: true,
      lead_id: result.lastInsertRowid,
      message: `Lead "${name}" erfolgreich erfasst`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/webhooks/google-conversion ─────────────────────────────────────
// Receives Google Ads conversion events (e.g. from Google Tag Manager / offline import)
// Body: { campaign_id, date, conversions, spend, clicks, impressions, customer_id }
router.post('/google-conversion', (req, res) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      campaign_id,
      date,
      conversions,
      leads_generated,
      spend,
      clicks,
      impressions,
    } = req.body;

    const campId = campaign_id || req.query.campaign_id;
    if (!campId) {
      return res.status(400).json({ error: 'campaign_id erforderlich' });
    }

    const metricDate = date || new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO campaign_metrics (campaign_id, date, impressions, clicks, spend, leads_generated, conversions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id, date) DO UPDATE SET
        impressions     = COALESCE(excluded.impressions, impressions),
        clicks          = COALESCE(excluded.clicks, clicks),
        spend           = COALESCE(excluded.spend, spend),
        leads_generated = COALESCE(excluded.leads_generated, leads_generated),
        conversions     = COALESCE(excluded.conversions, conversions)
    `).run(
      campId,
      metricDate,
      impressions || 0,
      clicks || 0,
      spend || 0,
      leads_generated || conversions || 0,
      conversions || 0
    );

    res.json({ success: true, date: metricDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/webhooks/leads – health check + instructions
router.get('/leads', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  res.json({
    status: 'active',
    endpoint: base + '/api/webhooks/leads',
    method: 'POST',
    auth: process.env.WEBHOOK_SECRET ? 'Header: x-webhook-secret' : 'Kein Secret konfiguriert',
    formats: ['generic', 'meta_lead_ads', 'zapier'],
    example: {
      name: 'Max Mustermann',
      email: 'max@example.com',
      phone: '0171 1234567',
      source: 'Kontaktformular',
      customer_id: 1,
      campaign_id: 1
    }
  });
});

module.exports = router;
