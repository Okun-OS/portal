'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Search, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  group?: string;
  keywords?: string[];
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  items = [],
  placeholder = 'Suchen oder Befehl eingeben…',
}: CommandPaletteProps) {
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  if (!open) return null;

  const groups = [...new Set(items.map((i) => i.group ?? 'Aktionen'))];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] mx-4 bg-[var(--color-surface-0)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] border border-[var(--color-surface-3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Befehlspalette"
      >
        <Command className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-[var(--color-surface-2)]">
            <Search className="size-4 text-[var(--color-content-tertiary)] shrink-0" />
            <Command.Input
              className="flex-1 h-12 bg-transparent text-[var(--color-content-primary)] placeholder:text-[var(--color-content-tertiary)] text-sm outline-none"
              placeholder={placeholder}
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded bg-[var(--color-surface-2)] px-1.5 font-mono text-[10px] text-[var(--color-content-tertiary)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-[var(--color-content-tertiary)]">
              Keine Ergebnisse gefunden.
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="mb-2">
                {items
                  .filter((i) => (i.group ?? 'Aktionen') === group)
                  .map((item) => (
                    <Command.Item
                      key={item.id}
                      value={[item.label, ...(item.keywords ?? [])].join(' ')}
                      onSelect={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer',
                        'text-sm text-[var(--color-content-primary)]',
                        'data-[selected=true]:bg-[var(--color-brand-600)] data-[selected=true]:text-white',
                        'transition-colors duration-[var(--duration-fast)]'
                      )}
                    >
                      {item.icon && (
                        <span className="size-4 shrink-0">{item.icon}</span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.description && (
                        <span className="text-xs opacity-60 truncate max-w-[160px]">
                          {item.description}
                        </span>
                      )}
                      <ArrowRight className="size-3 opacity-40 shrink-0" />
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-surface-2)] text-[10px] text-[var(--color-content-tertiary)]">
            <span><kbd className="font-mono">↑↓</kbd> Navigieren</span>
            <span><kbd className="font-mono">↵</kbd> Ausführen</span>
            <span><kbd className="font-mono">ESC</kbd> Schließen</span>
            <span className="ml-auto">⌘K öffnen</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
