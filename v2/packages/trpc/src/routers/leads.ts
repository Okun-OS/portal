import { z } from 'zod';
import { createTRPCRouter, workspaceProcedure } from '../server';
import { leads, leadStatusEnum } from '@okun/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

const leadStatuses = ['inbox', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const;

export const leadsRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(z.object({
      status: z.enum(leadStatuses).optional(),
      limit: z.number().min(1).max(200).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const conditions = [eq(leads.workspaceId, ctx.workspaceId)];
        if (input.status) conditions.push(eq(leads.status, input.status));
        return db
          .select()
          .from(leads)
          .where(and(...conditions))
          .orderBy(desc(leads.createdAt))
          .limit(input.limit);
      });
    }),

  byId: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [lead] = await db.select().from(leads).where(
          and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId))
        );
        return lead ?? null;
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
      campaignId: z.string().optional(),
      customerId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [lead] = await db.insert(leads).values({
          workspaceId: ctx.workspaceId,
          ...input,
        }).returning();
        return lead;
      });
    }),

  updateStatus: workspaceProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(leadStatuses),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [lead] = await db
          .update(leads)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId)))
          .returning();
        return lead;
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        await db.delete(leads).where(
          and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId))
        );
        return { success: true };
      });
    }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withWorkspace(ctx.workspaceId, async (db) => {
      const result = await db
        .select({
          status: leads.status,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(leads)
        .where(eq(leads.workspaceId, ctx.workspaceId))
        .groupBy(leads.status);
      return result;
    });
  }),
});
