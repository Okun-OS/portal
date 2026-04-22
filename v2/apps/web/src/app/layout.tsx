import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '../lib/providers';
import '@okun/ui/globals.css';

export const metadata: Metadata = {
  title: { default: 'Okun Leads', template: '%s | Okun Leads' },
  description: 'Ads Operations OS für Performance-Agenturen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <Providers>
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
