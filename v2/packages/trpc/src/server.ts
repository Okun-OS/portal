import { initTRPC, TRPCError } from '@trpc/server';
import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { auth } from '@clerk/backend';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db, withWorkspace } from '@okun/db/client';

export interface Context {
  workspaceId: string | null;
  clerkUserId: string | null;
  db: typeof db;
  withWorkspace: typeof withWorkspace;
}

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<Context> {
  const { userId, orgId } = await auth();

  return {
    workspaceId: orgId ?? null,
    clerkUserId: userId ?? null,
    db,
    withWorkspace,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, clerkUserId: ctx.clerkUserId } });
});

const isWorkspaceMember = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.workspaceId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No workspace selected' });
  return next({ ctx: { ...ctx, clerkUserId: ctx.clerkUserId, workspaceId: ctx.workspaceId } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const workspaceProcedure = t.procedure.use(isWorkspaceMember);
