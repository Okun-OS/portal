import Anthropic from '@anthropic-ai/sdk';
import { inngest } from '../client';
import { db } from '@okun/db';
import { leads } from '@okun/db/schema';
import { eq } from 'drizzle-orm';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const scoreLeadFn = inngest.createFunction(
  { id: 'score-lead', name: 'AI Lead Scoring' },
  { event: 'lead/created' },
  async ({ event, step }) => {
    const lead = await step.run('fetch-lead', async () => {
      const [row] = await db.select().from(leads).where(eq(leads.id, event.data.leadId));
      return row;
    });

    if (!lead) return { skipped: true, reason: 'lead not found' };

    const { score, reason } = await step.run('claude-score', async () => {
      const prompt = [
        `Du bist ein Lead-Scoring-Experte für eine Performance-Marketing-Agentur.`,
        `Bewerte den folgenden Lead auf einer Skala von 0–100 (100 = perfekter Kunde).`,
        ``,
        `Lead-Daten:`,
        `- Name: ${lead.name}`,
        `- Unternehmen: ${lead.company ?? 'unbekannt'}`,
        `- Branche: ${lead.industry ?? 'unbekannt'}`,
        `- Website: ${lead.website ?? 'keine'}`,
        `- Quelle: ${lead.source ?? 'unbekannt'}`,
        `- Region: ${lead.region ?? 'unbekannt'}`,
        `- Notizen: ${lead.notes ?? 'keine'}`,
        ``,
        `Antworte NUR mit validem JSON: { "score": number, "reason": string (max 2 Sätze) }`,
      ].join('\n');

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
      try {
        return JSON.parse(text) as { score: number; reason: string };
      } catch {
        return { score: 50, reason: 'Score konnte nicht berechnet werden.' };
      }
    });

    await step.run('save-score', async () => {
      const quality = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
      await db
        .update(leads)
        .set({ aiScore: Math.round(score), aiScoreReason: reason, quality })
        .where(eq(leads.id, lead.id));
    });

    return { leadId: lead.id, score, reason };
  },
);
