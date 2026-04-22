import { pgTable, text, timestamp, uuid, real, integer, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';
import { customers } from './customers';

export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'active', 'paused', 'ended']);
export const campaignPlatformEnum = pgEnum('campaign_platform', ['meta', 'google', 'tiktok', 'manual']);

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  platform: campaignPlatformEnum('platform').notNull().default('manual'),
  externalId: text('external_id'),
  status: campaignStatusEnum('status').notNull().default('draft'),
  budgetMonthly: real('budget_monthly').notNull().default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  targetAudience: text('target_audience'),
  geoTargeting: jsonb('geo_targeting'),
  aiPlan: jsonb('ai_plan'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('campaigns_workspace_idx').on(t.workspaceId),
  index('campaigns_customer_idx').on(t.customerId),
]);

export const adSets = pgTable('ad_sets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  externalId: text('external_id'),
  status: campaignStatusEnum('status').notNull().default('draft'),
  budgetDaily: real('budget_daily'),
  targeting: jsonb('targeting'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('ad_sets_campaign_idx').on(t.campaignId),
]);

export const ads = pgTable('ads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  adSetId: text('ad_set_id').notNull().references(() => adSets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  externalId: text('external_id'),
  status: campaignStatusEnum('status').notNull().default('draft'),
  creativeId: text('creative_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('ads_ad_set_idx').on(t.adSetId),
]);

export const campaignMetrics = pgTable('campaign_metrics', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  impressions: integer('impressions').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  spend: real('spend').notNull().default(0),
  leadsGenerated: integer('leads_generated').notNull().default(0),
  conversions: integer('conversions').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('campaign_metrics_campaign_idx').on(t.campaignId, t.date),
]);
