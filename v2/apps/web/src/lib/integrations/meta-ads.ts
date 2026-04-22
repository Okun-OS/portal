const META_GRAPH_URL = 'https://graph.facebook.com/v19.0';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: number;
}

interface MetaInsights {
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  date_start: string;
  date_stop: string;
}

async function metaFetch<T>(path: string, token: string): Promise<T> {
  const url = `${META_GRAPH_URL}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function fetchCampaigns(adAccountId: string, token: string): Promise<MetaCampaign[]> {
  const data = await metaFetch<{ data: MetaCampaign[] }>(
    `act_${adAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget`,
    token,
  );
  return data.data;
}

export async function fetchCampaignInsights(
  campaignId: string,
  token: string,
  dateRange: { since: string; until: string },
): Promise<MetaInsights[]> {
  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${campaignId}/insights?fields=spend,impressions,clicks,reach,date_start,date_stop&time_range=${JSON.stringify(dateRange)}`,
    token,
  );
  return data.data;
}

export async function pauseCampaign(campaignId: string, token: string): Promise<void> {
  await fetch(`${META_GRAPH_URL}/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PAUSED', access_token: token }),
  });
}
