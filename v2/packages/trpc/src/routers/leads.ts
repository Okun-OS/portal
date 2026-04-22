import { z } from 'zod';
import { createTRPCRouter, workspaceProcedure } from '../server';
import { leads, leadActivities } from '@okun/db/schema';
import { eq, desc, and, sql, ilike, or } from 'drizzle-orm';

const leadStatuses = ['inbox', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const;
const leadQualities = ['hot', 'warm', 'cold'] as const;

export const leadsRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(z.object({
      status: z.enum(leadStatuses).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).default(200),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const conditions = [eq(leads.workspaceId, ctx.workspaceId)];
        if (input.status) conditions.push(eq(leads.status, input.status));
        if (input.search) {
          conditions.push(
            or(
              ilike(leads.name, `%${input.search}%`),
              ilike(leads.email, `%${input.search}%`),
              ilike(leads.company, `%${input.search}%`),
            )!,
          );
        }
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
          and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId)),
        );
        if (!lead) return null;

        const activities = await db
          .select()
          .from(leadActivities)
          .where(eq(leadActivities.leadId, input.id))
          .orderBy(desc(leadActivities.createdAt))
          .limit(20);

        return { ...lead, activities };
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      region: z.string().optional(),
      source: z.string().optional(),
      campaignId: z.string().optional(),
      customerId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [lead] = await db.insert(leads).values({
          workspaceId: ctx.workspaceId,
          ...input,
          email: input.email || null,
        }).returning();

        await db.insert(leadActivities).values({
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
          type: 'created',
          subject: 'Lead erstellt',
          authorClerkUserId: ctx.clerkUserId,
        });

        return lead;
      });
    }),

  update: workspaceProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      region: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
      quality: z.enum(leadQualities).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [lead] = await db
          .update(leads)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.workspaceId, ctx.workspaceId)))
          .returning();
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

        await db.insert(leadActivities).values({
          workspaceId: ctx.workspaceId,
          leadId: input.id,
          type: 'status_changed',
          subject: `Status geändert zu ${input.status}`,
          authorClerkUserId: ctx.clerkUserId,
        });

        return lead;
      });
    }),

  setAiScore: workspaceProcedure
    .input(z.object({
      id: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string().optional(),
      quality: z.enum(leadQualities).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const quality = input.quality ?? (input.score >= 70 ? 'hot' : input.score >= 40 ? 'warm' : 'cold');
        const [lead] = await db
          .update(leads)
          .set({ aiScore: input.score, aiScoreReason: input.reason, quality, updatedAt: new Date() })
          .where(and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId)))
          .returning();
        return lead;
      });
    }),

  addNote: workspaceProcedure
    .input(z.object({ id: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [activity] = await db.insert(leadActivities).values({
          workspaceId: ctx.workspaceId,
          leadId: input.id,
          type: 'note',
          subject: 'Notiz',
          content: input.content,
          authorClerkUserId: ctx.clerkUserId,
        }).returning();
        return activity;
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        await db.delete(leads).where(
          and(eq(leads.id, input.id), eq(leads.workspaceId, ctx.workspaceId)),
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
