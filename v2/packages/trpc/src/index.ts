import { createTRPCRouter } from './server';
import { leadsRouter } from './routers/leads';
import { workspacesRouter } from './routers/workspaces';

export const appRouter = createTRPCRouter({
  leads: leadsRouter,
  workspaces: workspacesRouter,
  // Phase 1+: customers, campaigns, billing, etc.
});

export type AppRouter = typeof appRouter;
export { createContext } from './server';
export type { Context } from './server';
