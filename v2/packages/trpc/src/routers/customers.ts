import { z } from 'zod';
import { createTRPCRouter, workspaceProcedure } from '../server';
import { customers, customerContacts, leads } from '@okun/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const customersRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        return db
          .select()
          .from(customers)
          .where(eq(customers.workspaceId, ctx.workspaceId))
          .orderBy(desc(customers.createdAt))
          .limit(input.limit);
      });
    }),

  byId: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.id, input.id), eq(customers.workspaceId, ctx.workspaceId)));
        if (!customer) return null;

        const contacts = await db
          .select()
          .from(customerContacts)
          .where(eq(customerContacts.customerId, input.id))
          .orderBy(desc(customerContacts.createdAt));

        const leadCount = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(leads)
          .where(and(eq(leads.customerId, input.id), eq(leads.workspaceId, ctx.workspaceId)));

        return { ...customer, contacts, leadCount: leadCount[0]?.count ?? 0 };
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      companyName: z.string().min(1),
      industry: z.string().optional(),
      website: z.string().url().optional().or(z.literal('')),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [customer] = await db.insert(customers).values({
          workspaceId: ctx.workspaceId,
          companyName: input.companyName,
          industry: input.industry,
          website: input.website || null,
          notes: input.notes,
        }).returning();
        return customer;
      });
    }),

  update: workspaceProcedure
    .input(z.object({
      id: z.string(),
      companyName: z.string().min(1).optional(),
      industry: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [customer] = await db
          .update(customers)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(customers.id, id), eq(customers.workspaceId, ctx.workspaceId)))
          .returning();
        return customer;
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        await db.delete(customers).where(
          and(eq(customers.id, input.id), eq(customers.workspaceId, ctx.workspaceId)),
        );
        return { success: true };
      });
    }),

  addContact: workspaceProcedure
    .input(z.object({
      customerId: z.string(),
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [contact] = await db.insert(customerContacts).values({
          workspaceId: ctx.workspaceId,
          customerId: input.customerId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: input.role,
          isPrimary: input.isPrimary ? 'true' : 'false',
        }).returning();
        return contact;
      });
    }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withWorkspace(ctx.workspaceId, async (db) => {
      const [total] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(customers)
        .where(eq(customers.workspaceId, ctx.workspaceId));
      return { total: total?.count ?? 0 };
    });
  }),
});
