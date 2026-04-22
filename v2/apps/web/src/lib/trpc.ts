'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchStreamLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@okun/trpc';

export const trpc = createTRPCReact<AppRouter>();

export function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT ?? 3001}`;
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchStreamLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}
