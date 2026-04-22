import { z } from 'zod';
import { createTRPCRouter, workspaceProcedure } from '../server';
import { campaigns, adSets, ads, campaignMetrics } from '@okun/db/schema';
import { eq, and, desc, sum, sql } from 'drizzle-orm';

const platformValues = ['meta', 'google', 'tiktok', 'manual'] as const;
const statusValues = ['draft', 'active', 'paused', 'ended'] as const;

export const campaignsRouter = createTRPCRouter({
  list: workspaceProcedure
    .input(z.object({
      customerId: z.string().optional(),
      status: z.enum(statusValues).optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const conditions = [eq(campaigns.workspaceId, ctx.workspaceId)];
        if (input.customerId) conditions.push(eq(campaigns.customerId, input.customerId));
        if (input.status) conditions.push(eq(campaigns.status, input.status));
        return db.select().from(campaigns).where(and(...conditions)).orderBy(desc(campaigns.createdAt)).limit(input.limit);
      });
    }),

  byId: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [campaign] = await db.select().from(campaigns).where(
          and(eq(campaigns.id, input.id), eq(campaigns.workspaceId, ctx.workspaceId)),
        );
        if (!campaign) return null;

        const sets = await db.select().from(adSets).where(eq(adSets.campaignId, input.id));
        const metrics = await db
          .select({
            totalSpend: sum(campaignMetrics.spend),
            totalImpressions: sum(campaignMetrics.impressions),
            totalClicks: sum(campaignMetrics.clicks),
            totalLeads: sum(campaignMetrics.leadsGenerated),
          })
          .from(campaignMetrics)
          .where(eq(campaignMetrics.campaignId, input.id));

        return { ...campaign, adSets: sets, metrics: metrics[0] };
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      customerId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      platform: z.enum(platformValues).default('manual'),
      budgetMonthly: z.number().min(0).default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [campaign] = await db.insert(campaigns).values({
          workspaceId: ctx.workspaceId,
          ...input,
        }).returning();
        return campaign;
      });
    }),

  update: workspaceProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(statusValues).optional(),
      budgetMonthly: z.number().min(0).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetAudience: z.string().optional(),
      externalId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [campaign] = await db
          .update(campaigns)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, ctx.workspaceId)))
          .returning();
        return campaign;
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        await db.delete(campaigns).where(
          and(eq(campaigns.id, input.id), eq(campaigns.workspaceId, ctx.workspaceId)),
        );
        return { success: true };
      });
    }),

  addMetrics: workspaceProcedure
    .input(z.object({
      campaignId: z.string(),
      date: z.string(),
      impressions: z.number().default(0),
      clicks: z.number().default(0),
      spend: z.number().default(0),
      leadsGenerated: z.number().default(0),
      conversions: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [metric] = await db.insert(campaignMetrics).values({
          workspaceId: ctx.workspaceId,
          ...input,
        }).returning();
        return metric;
      });
    }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withWorkspace(ctx.workspaceId, async (db) => {
      const result = await db
        .select({
          status: campaigns.status,
          count: sql<number>`cast(count(*) as int)`,
          totalBudget: sum(campaigns.budgetMonthly),
        })
        .from(campaigns)
        .where(eq(campaigns.workspaceId, ctx.workspaceId))
        .groupBy(campaigns.status);
      return result;
    });
  }),
});
