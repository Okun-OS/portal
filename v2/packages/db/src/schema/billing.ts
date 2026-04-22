import { pgTable, text, timestamp, uuid, real, integer, pgEnum, index, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { workspaces } from './iam';
import { customers } from './customers';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
]);

export const vatTypeEnum = pgEnum('vat_type', [
  'standard_19',
  'reduced_7',
  'reverse_charge_13b',
  'eu_intra',
  'third_country',
  'exempt',
]);

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id),
  invoiceNumber: text('invoice_number').notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  serviceFrom: text('service_from'),
  serviceTo: text('service_to'),
  netAmount: real('net_amount').notNull().default(0),
  vatAmount: real('vat_amount').notNull().default(0),
  grossAmount: real('gross_amount').notNull().default(0),
  vatType: vatTypeEnum('vat_type').notNull().default('standard_19'),
  currency: text('currency').notNull().default('EUR'),
  notes: text('notes'),
  zugferdXml: text('zugferd_xml'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripePaymentUrl: text('stripe_payment_url'),
  paidAt: timestamp('paid_at'),
  reminderLevel: integer('reminder_level').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('invoices_workspace_idx').on(t.workspaceId),
  index('invoices_customer_idx').on(t.customerId),
  index('invoices_number_idx').on(t.workspaceId, t.invoiceNumber),
]);

export const invoiceLines = pgTable('invoice_lines', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').default('Pauschal'),
  unitPrice: real('unit_price').notNull(),
  netAmount: real('net_amount').notNull(),
  vatRate: real('vat_rate').notNull().default(19),
  vatAmount: real('vat_amount').notNull(),
}, (t) => [
  index('invoice_lines_invoice_idx').on(t.invoiceId),
]);

export const quotes = pgTable('quotes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id),
  quoteNumber: text('quote_number').notNull(),
  status: text('status').notNull().default('draft'),
  validUntil: text('valid_until'),
  netAmount: real('net_amount').notNull().default(0),
  grossAmount: real('gross_amount').notNull().default(0),
  signedAt: timestamp('signed_at'),
  convertedToInvoiceId: text('converted_to_invoice_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('quotes_workspace_idx').on(t.workspaceId),
]);
