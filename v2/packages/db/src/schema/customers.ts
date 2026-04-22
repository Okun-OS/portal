import { pgTable, text, timestamp, uuid, integer, real, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';

export const customers = pgTable('customers', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  clerkUserId: text('clerk_user_id'),
  companyName: text('company_name').notNull(),
  industry: text('industry'),
  website: text('website'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color'),
  healthScore: integer('health_score'),
  healthScoreUpdatedAt: timestamp('health_score_updated_at'),
  customFields: jsonb('custom_fields'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('customers_workspace_idx').on(t.workspaceId),
]);

export const customerContacts = pgTable('customer_contacts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  role: text('role'),
  isPrimary: text('is_primary').default('false'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('customer_contacts_customer_idx').on(t.customerId),
]);
