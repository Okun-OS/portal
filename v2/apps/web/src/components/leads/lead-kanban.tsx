'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge, EmptyState, Spinner } from '@okun/ui';
import { User, Mail, Building2, Zap } from 'lucide-react';
import { cn } from '@okun/ui';

const COLUMNS = [
  { id: 'inbox', label: 'Eingang', color: 'bg-surface-2' },
  { id: 'qualified', label: 'Qualifiziert', color: 'bg-blue-50' },
  { id: 'contacted', label: 'Kontaktiert', color: 'bg-purple-50' },
  { id: 'proposal', label: 'Angebot', color: 'bg-amber-50' },
  { id: 'won', label: 'Gewonnen', color: 'bg-green-50' },
  { id: 'lost', label: 'Verloren', color: 'bg-red-50' },
] as const;

const QUALITY_COLORS: Record<string, string> = {
  hot: 'text-red-500',
  warm: 'text-amber-500',
  cold: 'text-blue-400',
};

interface LeadKanbanProps {
  search: string;
  onLeadClick: (id: string) => void;
}

export function LeadKanban({ search, onLeadClick }: LeadKanbanProps) {
  const { data: allLeads, isLoading } = trpc.leads.list.useQuery({ limit: 200 });
  const utils = trpc.useUtils();
  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => utils.leads.list.invalidate(),
  });

  const filtered = useMemo(() => {
    if (!allLeads) return [];
    if (!search.trim()) return allLeads;
    const q = search.toLowerCase();
    return allLeads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q),
    );
  }, [allLeads, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {COLUMNS.map((col) => {
        const leads = filtered.filter((l) => l.status === col.id);
        return (
          <div key={col.id} className="flex flex-col w-72 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-content-secondary uppercase tracking-wide">
                {col.label}
              </span>
              <Badge variant="outline">{leads.length}</Badge>
            </div>

            <div className={cn('flex-1 rounded-xl border border-surface-2 p-2 overflow-y-auto', col.color)}>
              {leads.length === 0 ? (
                <EmptyState
                  icon={<User className="h-5 w-5" />}
                  title="Keine Leads"
                  className="py-8"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {leads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => onLeadClick(lead.id)}
                      className="w-full text-left rounded-lg border border-surface-2 bg-surface-0 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-content-primary line-clamp-1">
                          {lead.name}
                        </span>
                        {lead.aiScore !== null && lead.aiScore !== undefined && (
                          <span className="flex items-center gap-0.5 text-xs text-content-tertiary shrink-0">
                            <Zap className={cn('h-3 w-3', QUALITY_COLORS[lead.quality ?? 'warm'])} />
                            {lead.aiScore}
                          </span>
                        )}
                      </div>
                      {lead.company && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-content-secondary">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {lead.company}
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-content-tertiary">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.source && (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {lead.source}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
