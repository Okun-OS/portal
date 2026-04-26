import { pgTable, text, timestamp, uuid, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';
import { campaigns } from './campaigns';

export const creativeFormatEnum = pgEnum('creative_format', ['square', 'story', 'landscape']);
export const creativeStatusEnum = pgEnum('creative_status', ['generating', 'ready', 'error']);

// One set = one creative concept (hook + copy + X images in different formats)
export const creativeSets = pgTable('creative_sets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  hookConcept: text('hook_concept').notNull(),        // e.g. "Schmerz: Immer noch kein Käufer?"
  hookType: text('hook_type').notNull(),               // 'pain' | 'social_proof' | 'curiosity' | 'offer'
  adCopy: text('ad_copy'),                            // generated headline + body text
  dallePrompt: text('dalle_prompt').notNull(),        // the prompt used for DALL-E
  status: creativeStatusEnum('status').notNull().default('generating'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('creative_sets_workspace_idx').on(t.workspaceId),
  index('creative_sets_campaign_idx').on(t.campaignId),
]);

// Each image = one format variant within a set
export const creativeImages = pgTable('creative_images', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  setId: text('set_id').notNull().references(() => creativeSets.id, { onDelete: 'cascade' }),
  format: creativeFormatEnum('format').notNull(),  // square=1:1, story=9:16, landscape=16:9
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  imageUrl: text('image_url').notNull(),           // OpenAI CDN URL (expires ~1h) or R2 URL
  revisedPrompt: text('revised_prompt'),           // DALL-E returns the actual prompt used
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('creative_images_set_idx').on(t.setId),
]);
