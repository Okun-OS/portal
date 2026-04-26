import OpenAI from 'openai';
import { db } from '@okun/db';
import { creativeSets, creativeImages } from '@okun/db/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type CreativeFormat = 'square' | 'story' | 'landscape';

const FORMAT_CONFIG: Record<CreativeFormat, { width: number; height: number; size: '1024x1024' | '1024x1792' | '1792x1024' }> = {
  square:    { width: 1024, height: 1024,  size: '1024x1024'  }, // Feed 1:1
  story:     { width: 1024, height: 1792,  size: '1024x1792'  }, // Stories/Reels 9:16
  landscape: { width: 1792, height: 1024,  size: '1792x1024'  }, // YouTube/Display 16:9
};

export interface GenerateCreativesInput {
  workspaceId: string;
  campaignId?: string;
  hookConcept: string;
  hookType: 'pain' | 'social_proof' | 'curiosity' | 'offer';
  adCopy?: string;
  dallePrompt: string;
  formats?: CreativeFormat[];
}

export async function generateCreativeSet(input: GenerateCreativesInput) {
  const formats = input.formats ?? ['square', 'story', 'landscape'];

  // 1. Create the set record immediately
  const [set] = await db.insert(creativeSets).values({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId ?? null,
    hookConcept: input.hookConcept,
    hookType: input.hookType,
    adCopy: input.adCopy ?? null,
    dallePrompt: input.dallePrompt,
    status: 'generating',
  }).returning();

  // 2. Generate all formats in parallel
  const results = await Promise.allSettled(
    formats.map(async (format) => {
      const cfg = FORMAT_CONFIG[format];
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: input.dallePrompt,
        size: cfg.size,
        quality: 'standard',
        n: 1,
      });

      const imageData = response.data[0];
      if (!imageData?.url) throw new Error('No image URL returned');

      await db.insert(creativeImages).values({
        setId: set.id,
        format,
        width: cfg.width,
        height: cfg.height,
        imageUrl: imageData.url,
        revisedPrompt: imageData.revised_prompt ?? null,
      });

      return { format, url: imageData.url };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  await db.update(creativeSets)
    .set({ status: failed === formats.length ? 'error' : 'ready' })
    .where(eq(creativeSets.id, set.id));

  const images = results
    .filter((r): r is PromiseFulfilledResult<{ format: CreativeFormat; url: string }> => r.status === 'fulfilled')
    .map((r) => r.value);

  return { setId: set.id, hookConcept: input.hookConcept, images, succeeded, failed };
}
