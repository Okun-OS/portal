import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from './index';

export function createClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchStreamLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}
