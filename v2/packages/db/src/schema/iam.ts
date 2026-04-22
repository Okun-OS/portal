import { pgTable, text, timestamp, uuid, pgEnum, boolean, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const workspacePlanEnum = pgEnum('workspace_plan', ['free', 'starter', 'pro', 'enterprise']);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: workspacePlanEnum('plan').notNull().default('free'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#2563eb'),
  customDomain: text('custom_domain'),
  defaultCurrency: text('default_currency').notNull().default('EUR'),
  locale: text('locale').notNull().default('de-DE'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'admin',
  'strategist',
  'billing_user',
  'client_view',
]);

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  clerkUserId: text('clerk_user_id').notNull(),
  role: memberRoleEnum('role').notNull().default('strategist'),
  invitedByClerkUserId: text('invited_by_clerk_user_id'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => [
  index('memberships_workspace_idx').on(t.workspaceId),
  index('memberships_clerk_user_idx').on(t.clerkUserId),
]);

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  clerkUserId: text('clerk_user_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('audit_log_workspace_idx').on(t.workspaceId),
  index('audit_log_created_at_idx').on(t.createdAt),
]);

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  accountId: text('account_id'),
  accountName: text('account_name'),
  scopes: text('scopes'),
  metadata: text('metadata'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('integrations_workspace_idx').on(t.workspaceId),
]);
