import { createTRPCRouter } from './server';
import { leadsRouter } from './routers/leads';
import { workspacesRouter } from './routers/workspaces';
import { customersRouter } from './routers/customers';
import { campaignsRouter } from './routers/campaigns';
import { billingRouter } from './routers/billing';

export const appRouter = createTRPCRouter({
  leads: leadsRouter,
  workspaces: workspacesRouter,
  customers: customersRouter,
  campaigns: campaignsRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
export { createContext } from './server';
export type { Context } from './server';
