'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { CommandPalette } from '@okun/ui';
import { NAV_GROUPS, ALL_NAV_ITEMS } from '../../config/navigation';
import {
  Kanban, Building2, Megaphone, Filter, FileText, Settings,
  Menu, X, ChevronRight, Bot, Wand2,
} from 'lucide-react';
import { cn } from '@okun/ui';

const ICON_MAP: Record<string, React.ReactNode> = {
  Kanban: <Kanban className="size-4" />,
  Building2: <Building2 className="size-4" />,
  Megaphone: <Megaphone className="size-4" />,
  Filter: <Filter className="size-4" />,
  FileText: <FileText className="size-4" />,
  Settings: <Settings className="size-4" />,
  Bot: <Bot className="size-4" />,
  Wand2: <Wand2 className="size-4" />,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const commandItems = ALL_NAV_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: ICON_MAP[item.icon],
    group: item.group,
    keywords: item.keywords,
    onSelect: () => router.push(item.href),
  }));

  return (
    <div className="flex h-screen bg-[var(--color-surface-0)] text-[var(--color-content-primary)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-60 flex flex-col bg-[var(--color-surface-1)] border-r border-[var(--color-surface-3)]',
          'transition-transform duration-[var(--duration-base)]',
          'lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 h-14 px-4 border-b border-[var(--color-surface-3)]">
          <div className="size-7 rounded-[var(--radius-md)] bg-[var(--color-brand-600)] flex items-center justify-center">
            <span className="text-white font-bold text-xs">O</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">Okun Leads</span>
          <button
            className="ml-auto lg:hidden text-[var(--color-content-tertiary)] hover:text-[var(--color-content-primary)]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-content-tertiary)]">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-[var(--radius-md)] text-sm',
                      'transition-colors duration-[var(--duration-fast)]',
                      active
                        ? 'bg-[var(--color-brand-600)] text-white'
                        : 'text-[var(--color-content-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-content-primary)]'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {ICON_MAP[item.icon]}
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="size-3 opacity-60" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-3 border-t border-[var(--color-surface-3)] flex items-center gap-3" suppressHydrationWarning>
          <UserButton afterSignOutUrl="/sign-in" />
          <button
            className="ml-auto text-[var(--color-content-tertiary)] hover:text-[var(--color-content-primary)] transition-colors"
            onClick={() => setCmdOpen(true)}
            title="⌘K"
          >
            <kbd className="text-[10px] font-mono bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-[var(--color-surface-3)] bg-[var(--color-surface-1)]">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </button>
          <span className="font-semibold text-sm">Okun Leads</span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={commandItems}
      />
    </div>
  );
}
