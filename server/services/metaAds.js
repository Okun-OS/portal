/**
 * Meta Ads API integration
 * Fetches campaign insights from the Meta Graph API and stores them in campaign_metrics.
 */
const db = require('../db');

const GRAPH_API = 'https://graph.facebook.com/v19.0';

async function fetchInsights(metaCampaignId, datePreset = 'last_30d') {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    throw new Error('META_ACCESS_TOKEN und META_AD_ACCOUNT_ID müssen in .env gesetzt sein');
  }

  const fields = 'campaign_id,campaign_name,impressions,clicks,spend,actions,date_start,date_stop';
  const url = `${GRAPH_API}/act_${accountId}/insights?fields=${fields}&date_preset=${datePreset}&level=campaign&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${metaCampaignId}"}]&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Meta API Fehler: ${res.status}`);
  }
  return res.json();
}

async function fetchDailyInsights(metaCampaignId) {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    throw new Error('META_ACCESS_TOKEN und META_AD_ACCOUNT_ID müssen in .env gesetzt sein');
  }

  const fields = 'impressions,clicks,spend,actions,date_start';
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const url = `${GRAPH_API}/act_${accountId}/insights?fields=${fields}&time_increment=1&time_range={"since":"${sinceStr}","until":"${todayStr}"}&level=campaign&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${metaCampaignId}"}]&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Meta API Fehler: ${res.status}`);
  }
  return res.json();
}

function extractLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  const leadAction = actions.find(a =>
    a.action_type === 'lead' ||
    a.action_type === 'onsite_conversion.lead_grouped'
  );
  return leadAction ? parseInt(leadAction.value) || 0 : 0;
}

/**
 * Sync a single campaign by its internal DB campaign_id.
 * Fetches daily metrics from Meta and upserts into campaign_metrics.
 */
async function syncCampaign(campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) throw new Error('Kampagne nicht gefunden');
  if (!campaign.meta_campaign_id) throw new Error('Kein meta_campaign_id für diese Kampagne hinterlegt');

  const data = await fetchDailyInsights(campaign.meta_campaign_id);
  const rows = data.data || [];

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
    const leads = extractLeads(row.actions);
    upsert.run(
      campaignId,
      row.date_start,
      parseInt(row.impressions) || 0,
      parseInt(row.clicks) || 0,
      parseFloat(row.spend) || 0,
      leads,
      leads
    );
    synced++;
  }

  return { synced, campaign_name: campaign.name };
}

/**
 * Sync all campaigns that have meta_campaign_id set.
 */
async function syncAllCampaigns() {
  const campaigns = db.prepare("SELECT id FROM campaigns WHERE meta_campaign_id IS NOT NULL AND meta_campaign_id != ''").all();
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
