import { pgTable, text, timestamp, uuid, integer, real, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';
import { customers } from './customers';
import { campaigns } from './campaigns';

export const leadStatusEnum = pgEnum('lead_status', [
  'inbox',
  'qualified',
  'contacted',
  'proposal',
  'won',
  'lost',
]);

export const leadQualityEnum = pgEnum('lead_quality', ['hot', 'warm', 'cold']);

export const leads = pgTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  website: text('website'),
  industry: text('industry'),
  region: text('region'),
  source: text('source'),
  status: leadStatusEnum('status').notNull().default('inbox'),
  quality: leadQualityEnum('quality').default('warm'),
  aiScore: integer('ai_score'),
  aiScoreReason: text('ai_score_reason'),
  notes: text('notes'),
  enrichmentData: jsonb('enrichment_data'),
  funnelId: text('funnel_id'),
  funnelSlug: text('funnel_slug'),
  convertedToCustomerId: text('converted_to_customer_id'),
  convertedAt: timestamp('converted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('leads_workspace_idx').on(t.workspaceId),
  index('leads_status_idx').on(t.workspaceId, t.status),
  index('leads_created_at_idx').on(t.createdAt),
]);

export const leadActivities = pgTable('lead_activities', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  leadId: text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  subject: text('subject'),
  content: text('content'),
  direction: text('direction'),
  authorClerkUserId: text('author_clerk_user_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('lead_activities_lead_idx').on(t.leadId),
  index('lead_activities_workspace_idx').on(t.workspaceId),
]);
