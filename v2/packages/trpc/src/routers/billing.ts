import { z } from 'zod';
import { createTRPCRouter, workspaceProcedure } from '../server';
import { invoices, invoiceLines, quotes } from '@okun/db/schema';
import { eq, and, desc, sum, sql } from 'drizzle-orm';

const invoiceStatusValues = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;
const vatTypeValues = ['standard_19', 'reduced_7', 'reverse_charge_13b', 'eu_intra', 'third_country', 'exempt'] as const;

const invoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default('Pauschal'),
  unitPrice: z.number(),
  vatRate: z.number().default(19),
});

export const billingRouter = createTRPCRouter({
  listInvoices: workspaceProcedure
    .input(z.object({
      customerId: z.string().optional(),
      status: z.enum(invoiceStatusValues).optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const conditions = [eq(invoices.workspaceId, ctx.workspaceId)];
        if (input.customerId) conditions.push(eq(invoices.customerId, input.customerId));
        if (input.status) conditions.push(eq(invoices.status, input.status));
        return db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.createdAt)).limit(input.limit);
      });
    }),

  invoiceById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [invoice] = await db.select().from(invoices).where(
          and(eq(invoices.id, input.id), eq(invoices.workspaceId, ctx.workspaceId)),
        );
        if (!invoice) return null;
        const lines = await db
          .select()
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, input.id))
          .orderBy(invoiceLines.position);
        return { ...invoice, lines };
      });
    }),

  createInvoice: workspaceProcedure
    .input(z.object({
      customerId: z.string(),
      issueDate: z.string(),
      dueDate: z.string(),
      serviceFrom: z.string().optional(),
      serviceTo: z.string().optional(),
      vatType: z.enum(vatTypeValues).default('standard_19'),
      currency: z.string().default('EUR'),
      notes: z.string().optional(),
      lines: z.array(invoiceLineSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const { lines, ...invoiceData } = input;

        const [countResult] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(invoices)
          .where(eq(invoices.workspaceId, ctx.workspaceId));
        const num = (countResult?.count ?? 0) + 1;
        const invoiceNumber = `RE-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;

        const computedLines = lines.map((l, i) => {
          const netAmount = l.quantity * l.unitPrice;
          const vatAmount = netAmount * (l.vatRate / 100);
          return { ...l, position: i + 1, netAmount, vatAmount, invoiceId: '' };
        });

        const netAmount = computedLines.reduce((s, l) => s + l.netAmount, 0);
        const vatAmount = computedLines.reduce((s, l) => s + l.vatAmount, 0);

        const [invoice] = await db.insert(invoices).values({
          workspaceId: ctx.workspaceId,
          invoiceNumber,
          netAmount,
          vatAmount,
          grossAmount: netAmount + vatAmount,
          ...invoiceData,
        }).returning();

        for (const line of computedLines) {
          await db.insert(invoiceLines).values({ ...line, invoiceId: invoice.id });
        }

        return invoice;
      });
    }),

  updateInvoiceStatus: workspaceProcedure
    .input(z.object({ id: z.string(), status: z.enum(invoiceStatusValues) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [invoice] = await db
          .update(invoices)
          .set({
            status: input.status,
            paidAt: input.status === 'paid' ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(invoices.id, input.id), eq(invoices.workspaceId, ctx.workspaceId)))
          .returning();
        return invoice;
      });
    }),

  deleteInvoice: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        await db.delete(invoices).where(
          and(eq(invoices.id, input.id), eq(invoices.workspaceId, ctx.workspaceId)),
        );
        return { success: true };
      });
    }),

  listQuotes: workspaceProcedure
    .input(z.object({ customerId: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const conditions = [eq(quotes.workspaceId, ctx.workspaceId)];
        if (input.customerId) conditions.push(eq(quotes.customerId, input.customerId));
        return db.select().from(quotes).where(and(...conditions)).orderBy(desc(quotes.createdAt)).limit(input.limit);
      });
    }),

  billingStats: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withWorkspace(ctx.workspaceId, async (db) => {
      const result = await db
        .select({
          status: invoices.status,
          count: sql<number>`cast(count(*) as int)`,
          totalGross: sum(invoices.grossAmount),
        })
        .from(invoices)
        .where(eq(invoices.workspaceId, ctx.workspaceId))
        .groupBy(invoices.status);
      return result;
    });
  }),
});
