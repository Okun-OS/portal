/**
 * Google Ads API integration (REST / GAQL)
 * Uses the Google Ads REST API v17 with OAuth2 refresh token flow.
 *
 * Required .env vars:
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_REFRESH_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID   (without dashes, e.g. "1234567890")
 */
const db = require('../db');

const OAUTH_URL  = 'https://oauth2.googleapis.com/token';
const ADS_BASE   = 'https://googleads.googleapis.com/v17';

// ── OAuth2 token refresh ─────────────────────────────────────────────────────
async function getAccessToken() {
  const { GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN) {
    throw new Error('GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET und GOOGLE_ADS_REFRESH_TOKEN müssen in .env gesetzt sein');
  }

  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || `OAuth Fehler: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ── GAQL query helper ────────────────────────────────────────────────────────
async function gaqlQuery(customerId, query, accessToken) {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN fehlt in .env');

  const url = `${ADS_BASE}/customers/${customerId}/googleAds:search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization':      `Bearer ${accessToken}`,
      'developer-token':    devToken,
      'Content-Type':       'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || err.error?.details?.[0]?.errors?.[0]?.message || `Google Ads API Fehler: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

// ── Sync a single campaign ────────────────────────────────────────────────────
async function syncCampaign(campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) throw new Error('Kampagne nicht gefunden');
  if (!campaign.google_campaign_id) throw new Error('Kein google_campaign_id für diese Kampagne hinterlegt');

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId) throw new Error('GOOGLE_ADS_CUSTOMER_ID fehlt in .env');

  const accessToken = await getAccessToken();

  // GAQL: daily metrics for last 30 days
  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions
    FROM campaign
    WHERE campaign.id = '${campaign.google_campaign_id}'
      AND segments.date DURING LAST_30_DAYS
    ORDER BY segments.date ASC
  `;

  const data = await gaqlQuery(customerId, query, accessToken);
  const rows = data.results || [];

  const upsert = db.prepare(`
    INSERT INTO campaign_metrics (campaign_id, date, impressions, clicks, spend, leads_generated, conversions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, date) DO UPDATE SET
      impressions     = excluded.impressions,
      clicks          = excluded.clicks,
      spend           = excluded.spend,
      leads_generated = excluded.leads_generated,
      conversions     = excluded.conversions
  `);

  let synced = 0;
  for (const row of rows) {
    const m = row.metrics || {};
    const spend = (parseInt(m.costMicros || m.cost_micros) || 0) / 1_000_000;
    const conversions = Math.round(parseFloat(m.conversions) || 0);
    upsert.run(
      campaignId,
      row.segments.date,
      parseInt(m.impressions) || 0,
      parseInt(m.clicks) || 0,
      spend,
      conversions,
      conversions
    );
    synced++;
  }

  return { synced, campaign_name: campaign.name };
}

// ── Sync all campaigns with google_campaign_id ────────────────────────────────
async function syncAllCampaigns() {
  const campaigns = db.prepare("SELECT id FROM campaigns WHERE google_campaign_id IS NOT NULL AND google_campaign_id != ''").all();
  const results = [];

  for (const c of campaigns) {
    try {
      const r = await syncCampaign(c.id);
      results.push({ campaign_id: c.id, ...r, status: 'ok' });
    } catch (err) {
      results.push({ campaign_id: c.id, status: 'error', error: err.message });
    }
  }

  return results;
}

module.exports = { syncCampaign, syncAllCampaigns };
