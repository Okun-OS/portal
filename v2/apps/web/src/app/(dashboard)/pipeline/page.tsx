'use client';

import { useState } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, Input, Badge } from '@okun/ui';
import { LeadKanban } from '@/components/leads/lead-kanban';
import { LeadCreateDialog } from '@/components/leads/lead-create-dialog';
import { LeadDetailPanel } from '@/components/leads/lead-detail-panel';

export default function PipelinePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: stats } = trpc.leads.stats.useQuery();
  const totalLeads = stats?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-2 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-content-primary">Pipeline</h1>
          <Badge variant="default">{totalLeads}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
            <Input
              placeholder="Leads suchen…"
              className="pl-8 w-56 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Lead
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <LeadKanban search={search} onLeadClick={(id) => setSelectedLeadId(id)} />
      </div>

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}

      <LeadCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
