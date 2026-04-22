'use client';

import { useState } from 'react';
import { Plus, Search, TrendingUp, Play, Pause, DollarSign } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, Input, Badge, Card, CardContent, EmptyState, Spinner, StatCard } from '@okun/ui';
import { CampaignCreateDialog } from '@/components/campaigns/campaign-create-dialog';
import { cn } from '@okun/ui';

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  draft: { label: 'Entwurf', variant: 'outline' },
  active: { label: 'Aktiv', variant: 'success' },
  paused: { label: 'Pausiert', variant: 'warning' },
  ended: { label: 'Beendet', variant: 'default' },
};

const PLATFORM_ICONS: Record<string, string> = {
  meta: '📘',
  google: '🔍',
  tiktok: '🎵',
  manual: '✏️',
};

export default function CampaignsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery({ limit: 200 });
  const { data: stats } = trpc.campaigns.stats.useQuery();

  const activeCount = stats?.find((s) => s.status === 'active')?.count ?? 0;
  const totalBudget = stats?.reduce((sum, s) => sum + (Number(s.totalBudget) || 0), 0) ?? 0;

  const filtered = campaigns?.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-2 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-content-primary">Kampagnen</h1>
          <Badge variant="default">{campaigns?.length ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
            <Input
              placeholder="Kampagnen suchen…"
              className="pl-8 w-56 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Kampagne
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4 shrink-0">
        <StatCard label="Aktive Kampagnen" value={activeCount} icon={<Play className="h-4 w-4" />} />
        <StatCard label="Gesamtbudget / Monat" value={`€${totalBudget.toLocaleString('de-DE')}`} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Kampagnen gesamt" value={campaigns?.length ?? 0} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="Keine Kampagnen"
            description="Erstelle deine erste Kampagne."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Kampagne erstellen
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((campaign) => {
              const statusInfo = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.draft;
              return (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{PLATFORM_ICONS[campaign.platform] ?? '📋'}</span>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">{campaign.name}</p>
                          {campaign.description && (
                            <p className="text-xs text-content-secondary mt-0.5 line-clamp-1">
                              {campaign.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-content-primary">
                            €{campaign.budgetMonthly.toLocaleString('de-DE')}
                          </p>
                          <p className="text-xs text-content-tertiary">/ Monat</p>
                        </div>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CampaignCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
