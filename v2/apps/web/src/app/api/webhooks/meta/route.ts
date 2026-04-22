import { NextRequest, NextResponse } from 'next/server';
import { db } from '@okun/db';
import { leads, campaigns } from '@okun/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function verifyMetaSignature(payload: string, signature: string): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${expected}` === signature;
}

// Meta Webhook Verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Meta Lead Form Webhook
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') ?? '';

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entries = body?.entry ?? [];

  for (const entry of entries) {
    const changes = entry?.changes ?? [];
    for (const change of changes) {
      if (change.field !== 'leadgen') continue;

      const leadgenId = change.value?.leadgen_id;
      const formId = change.value?.form_id;
      const adId = change.value?.ad_id;
      const pageId = change.value?.page_id;

      if (!leadgenId) continue;

      const campaign = await db.query?.campaigns?.findFirst?.({
        where: (c: any, { eq: e }: any) => e(c.externalId, adId ?? formId ?? ''),
      });

      await db.insert(leads).values({
        workspaceId: campaign?.workspaceId ?? '',
        name: 'Meta Lead',
        source: 'meta_ads',
        campaignId: campaign?.id,
        enrichmentData: { leadgenId, formId, adId, pageId },
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
