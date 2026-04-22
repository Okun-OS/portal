import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { scoreLeadFn } from '@/lib/inngest/functions/score-lead';
import { sendInvoiceEmailFn, sendInvoiceReminderFn } from '@/lib/inngest/functions/send-invoice-email';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scoreLeadFn, sendInvoiceEmailFn, sendInvoiceReminderFn],
});
