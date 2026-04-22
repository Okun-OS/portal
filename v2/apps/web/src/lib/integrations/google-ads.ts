interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
}

interface GoogleAdsInsights {
  campaignId: string;
  clicks: number;
  impressions: number;
  costMicros: number;
  conversions: number;
  date: string;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function fetchGoogleCampaigns(customerId: string): Promise<GoogleAdsCampaign[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'`,
      }),
    },
  );

  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`);
  const data = await res.json() as any[];
  return (data ?? []).flatMap((batch: any) =>
    (batch.results ?? []).map((r: any) => ({
      id: r.campaign?.id ?? '',
      name: r.campaign?.name ?? '',
      status: r.campaign?.status ?? '',
      budget: (r.campaignBudget?.amountMicros ?? 0) / 1_000_000,
    })),
  );
}

export async function fetchGoogleInsights(
  customerId: string,
  campaignId: string,
  dateRange: { start: string; end: string },
): Promise<GoogleAdsInsights[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT campaign.id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, segments.date FROM campaign WHERE campaign.id = ${campaignId} AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'`,
      }),
    },
  );

  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`);
  const data = await res.json() as any[];
  return (data ?? []).flatMap((batch: any) =>
    (batch.results ?? []).map((r: any) => ({
      campaignId: r.campaign?.id ?? '',
      clicks: r.metrics?.clicks ?? 0,
      impressions: r.metrics?.impressions ?? 0,
      costMicros: r.metrics?.costMicros ?? 0,
      conversions: r.metrics?.conversions ?? 0,
      date: r.segments?.date ?? '',
    })),
  );
}
