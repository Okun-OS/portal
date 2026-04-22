import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from '../server';
import { workspaces, memberships } from '@okun/db/schema';
import { eq, and } from 'drizzle-orm';

export const workspacesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(80),
      slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
      clerkOrgId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [workspace] = await ctx.db.insert(workspaces).values({
        name: input.name,
        slug: input.slug,
        clerkOrgId: input.clerkOrgId,
      }).returning();
      if (!workspace) throw new Error('Failed to create workspace');

      await ctx.db.insert(memberships).values({
        workspaceId: workspace.id,
        clerkUserId: ctx.clerkUserId!,
        role: 'owner',
      });

      return workspace;
    }),

  getCurrent: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.withWorkspace(ctx.workspaceId, async (db) => {
      const [workspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspaceId));
      return workspace ?? null;
    });
  }),

  update: workspaceProcedure
    .input(z.object({
      name: z.string().min(2).max(80).optional(),
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      defaultCurrency: z.string().length(3).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.withWorkspace(ctx.workspaceId, async (db) => {
        const [workspace] = await db
          .update(workspaces)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(workspaces.id, ctx.workspaceId))
          .returning();
        return workspace;
      });
    }),
});
