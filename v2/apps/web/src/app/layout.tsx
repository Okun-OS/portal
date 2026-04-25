import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from '../lib/providers';
import { Toaster } from 'sonner';
import '@okun/ui/globals.css';

export const metadata: Metadata = {
  title: { default: 'Okun Leads', template: '%s | Okun Leads' },
  description: 'Ads Operations OS für Performance-Agenturen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider>
          <Providers>
            {children}
          </Providers>
        </ClerkProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
