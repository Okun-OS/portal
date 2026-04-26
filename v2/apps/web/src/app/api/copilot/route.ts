import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { db } from '@okun/db';
import { leads, customers, campaigns, invoices } from '@okun/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateCreativeSet } from '@/lib/integrations/openai-images';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_leads_summary',
    description: 'Hole eine Zusammenfassung aller Leads im Workspace',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['inbox', 'qualified', 'contacted', 'proposal', 'won', 'lost'], description: 'Optional: Filter nach Status' },
        limit: { type: 'number', description: 'Maximale Anzahl (default 20)' },
      },
    },
  },
  {
    name: 'get_customers',
    description: 'Hole Kundenliste',
    input_schema: { type: 'object' as const, properties: { limit: { type: 'number' } } },
  },
  {
    name: 'get_campaigns',
    description: 'Hole aktive Kampagnen',
    input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } },
  },
  {
    name: 'get_invoices_summary',
    description: 'Hole Rechnungsübersicht',
    input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } },
  },
  {
    name: 'generate_creatives',
    description: 'Generiere Werbe-Creatives mit DALL-E 3 in allen Formaten (Feed 1:1, Stories 9:16, Display 16:9). Nutze dieses Tool wenn der User Bilder, Creatives, Werbemittel oder Ad-Grafiken erstellen möchte. Erstelle einen präzisen englischen DALL-E Prompt basierend auf der Kampagne und dem gewünschten Hook.',
    input_schema: {
      type: 'object' as const,
      required: ['hookConcept', 'hookType', 'dallePrompt'],
      properties: {
        campaignId: { type: 'string', description: 'Optional: ID der zugehörigen Kampagne' },
        hookConcept: { type: 'string', description: 'Der Hook-Text für das Creative, z.B. "Noch keine Käufer für deine Immobilie?"' },
        hookType: { type: 'string', enum: ['pain', 'social_proof', 'curiosity', 'offer'], description: 'Art des Hooks' },
        adCopy: { type: 'string', description: 'Optional: Headline + Fließtext für die Anzeige' },
        dallePrompt: { type: 'string', description: 'Englischer DALL-E 3 Prompt — präzise, visuell, ohne Text im Bild. Beispiel: "Professional real estate photography of a modern German house at golden hour, warm lighting, inviting atmosphere, photorealistic, high quality"' },
        formats: { type: 'array', items: { type: 'string', enum: ['square', 'story', 'landscape'] }, description: 'Optional: Formate. Default: alle drei (square=Feed, story=Reels, landscape=Display)' },
      },
    },
  },
];

async function executeTool(name: string, input: Record<string, any>, workspaceId: string): Promise<string> {
  switch (name) {
    case 'get_leads_summary': {
      const rows = await db.select().from(leads)
        .where(eq(leads.workspaceId, workspaceId))
        .orderBy(desc(leads.createdAt))
        .limit(input.limit ?? 20);
      return JSON.stringify(rows.map((l) => ({
        id: l.id, name: l.name, company: l.company, status: l.status,
        aiScore: l.aiScore, quality: l.quality, source: l.source,
      })));
    }
    case 'get_customers': {
      const rows = await db.select().from(customers)
        .where(eq(customers.workspaceId, workspaceId))
        .limit(input.limit ?? 20);
      return JSON.stringify(rows.map((c) => ({
        id: c.id, companyName: c.companyName, industry: c.industry, healthScore: c.healthScore,
      })));
    }
    case 'get_campaigns': {
      const rows = await db.select().from(campaigns)
        .where(eq(campaigns.workspaceId, workspaceId))
        .limit(20);
      return JSON.stringify(rows.map((c) => ({
        id: c.id, name: c.name, platform: c.platform, status: c.status, budgetMonthly: c.budgetMonthly,
      })));
    }
    case 'get_invoices_summary': {
      const rows = await db.select().from(invoices)
        .where(eq(invoices.workspaceId, workspaceId))
        .orderBy(desc(invoices.createdAt))
        .limit(20);
      return JSON.stringify(rows.map((i) => ({
        id: i.id, number: i.invoiceNumber, status: i.status, grossAmount: i.grossAmount, dueDate: i.dueDate,
      })));
    }
    case 'generate_creatives': {
      try {
        const result = await generateCreativeSet({
          workspaceId,
          campaignId: input.campaignId,
          hookConcept: input.hookConcept,
          hookType: input.hookType,
          adCopy: input.adCopy,
          dallePrompt: input.dallePrompt,
          formats: input.formats,
        });
        return JSON.stringify({
          success: true,
          setId: result.setId,
          hookConcept: result.hookConcept,
          imagesGenerated: result.succeeded,
          imagesFailed: result.failed,
          images: result.images,
          viewUrl: '/creatives',
          note: 'Bilder sind unter /creatives abrufbar. Die URLs sind ca. 1 Stunde gültig.',
        });
      } catch (e: any) {
        return JSON.stringify({ success: false, error: e.message });
      }
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { messages, workspaceId } = await req.json() as {
    messages: Anthropic.MessageParam[];
    workspaceId: string;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      let currentMessages = [...messages];

      for (let i = 0; i < 10; i++) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: `Du bist Okun Copilot, ein KI-Assistent für die Okun Leads Plattform.
Du hilfst dabei Leads, Kunden, Kampagnen und Rechnungen zu analysieren und Empfehlungen zu geben.
Du kannst außerdem Werbe-Creatives (Bilder) mit DALL-E 3 generieren — in allen gängigen Ad-Formaten (Feed, Stories, Display).

Wenn der User Creatives möchte:
1. Frage kurz nach Branche, Zielgruppe und gewünschtem Hook-Typ (falls nicht klar)
2. Schlage 2-3 Hook-Konzepte vor und lass den User wählen (oder generiere direkt wenn er "alle" sagt)
3. Erstelle einen präzisen englischen DALL-E Prompt — photorealistisch, KEIN Text im Bild
4. Rufe generate_creatives auf — ein Call pro Hook-Konzept

Antworte immer auf Deutsch. Sei präzise und hilfreich.
Aktueller Workspace: ${workspaceId}`,
          tools: TOOLS,
          messages: currentMessages,
        });

        for (const block of response.content) {
          if (block.type === 'text') {
            send(JSON.stringify({ type: 'text', text: block.text }));
          }
        }

        if (response.stop_reason === 'end_turn') break;

        if (response.stop_reason === 'tool_use') {
          currentMessages.push({ role: 'assistant', content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send(JSON.stringify({ type: 'tool_call', name: block.name }));
              const result = await executeTool(block.name, block.input as Record<string, any>, workspaceId);
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
            }
          }

          currentMessages.push({ role: 'user', content: toolResults });
        } else {
          break;
        }
      }

      send(JSON.stringify({ type: 'done' }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
