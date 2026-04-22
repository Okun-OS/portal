import { pgTable, text, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';

// Event-Sourcing append-only log — niemals UPDATE oder DELETE
export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata'),
  actorClerkUserId: text('actor_clerk_user_id'),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
}, (t) => [
  index('events_workspace_idx').on(t.workspaceId),
  index('events_aggregate_idx').on(t.aggregateType, t.aggregateId),
  index('events_occurred_at_idx').on(t.occurredAt),
]);
