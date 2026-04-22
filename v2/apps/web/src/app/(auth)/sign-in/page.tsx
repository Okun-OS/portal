import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Anmelden' };

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-1)]">
      <SignIn
        appearance={{
          elements: {
            card: 'shadow-[var(--shadow-lg)] border border-[var(--color-surface-3)] rounded-[var(--radius-xl)]',
            headerTitle: 'text-[var(--color-content-primary)]',
          },
        }}
      />
    </div>
  );
}
