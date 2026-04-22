import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'okun-leads-v2' });

export type LeadCreatedEvent = {
  name: 'lead/created';
  data: { leadId: string; workspaceId: string };
};

export type LeadStatusChangedEvent = {
  name: 'lead/status.changed';
  data: { leadId: string; workspaceId: string; status: string };
};

export type InvoiceCreatedEvent = {
  name: 'invoice/created';
  data: { invoiceId: string; workspaceId: string };
};

export type InvoiceOverdueEvent = {
  name: 'invoice/overdue';
  data: { invoiceId: string; workspaceId: string };
};

export type Events =
  | LeadCreatedEvent
  | LeadStatusChangedEvent
  | InvoiceCreatedEvent
  | InvoiceOverdueEvent;
