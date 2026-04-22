import { Resend } from 'resend';
import { inngest } from '../client';
import { db } from '@okun/db';
import { invoices, customers } from '@okun/db/schema';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendInvoiceEmailFn = inngest.createFunction(
  { id: 'send-invoice-email', name: 'Rechnung versenden' },
  { event: 'invoice/created' },
  async ({ event, step }) => {
    const invoice = await step.run('fetch-invoice', async () => {
      const [row] = await db.select().from(invoices).where(eq(invoices.id, event.data.invoiceId));
      return row;
    });

    if (!invoice) return { skipped: true };

    const customer = await step.run('fetch-customer', async () => {
      const [row] = await db.select().from(customers).where(eq(customers.id, invoice.customerId));
      return row;
    });

    await step.run('send-email', async () => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@okun.de',
        to: [`billing@${customer?.companyName?.toLowerCase().replace(/\s+/g, '')}.de`],
        subject: `Rechnung ${invoice.invoiceNumber} — €${invoice.grossAmount.toFixed(2)}`,
        html: `
          <h2>Rechnung ${invoice.invoiceNumber}</h2>
          <p>Sehr geehrte Damen und Herren,</p>
          <p>anbei erhalten Sie Ihre Rechnung über <strong>€${invoice.grossAmount.toFixed(2)} (brutto)</strong>.</p>
          <p>Fälligkeitsdatum: <strong>${invoice.dueDate}</strong></p>
          <p>Mit freundlichen Grüßen</p>
        `,
      });
    });

    return { invoiceId: invoice.id, sent: true };
  },
);

export const sendInvoiceReminderFn = inngest.createFunction(
  { id: 'send-invoice-reminder', name: 'Mahnwesen' },
  { event: 'invoice/overdue' },
  async ({ event, step }) => {
    const invoice = await step.run('fetch-invoice', async () => {
      const [row] = await db.select().from(invoices).where(eq(invoices.id, event.data.invoiceId));
      return row;
    });

    if (!invoice || invoice.status === 'paid') return { skipped: true };

    const nextLevel = (invoice.reminderLevel ?? 0) + 1;
    if (nextLevel > 3) return { skipped: true, reason: 'max reminder level reached' };

    await step.run('update-reminder-level', async () => {
      await db
        .update(invoices)
        .set({ reminderLevel: nextLevel, lastReminderAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));
    });

    return { invoiceId: invoice.id, reminderLevel: nextLevel };
  },
);
