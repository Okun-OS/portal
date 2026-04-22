'use client';

import { useState } from 'react';
import { Plus, Search, Building2, Users, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, Input, Badge, Card, CardContent, EmptyState, Spinner, StatCard } from '@okun/ui';
import { CustomerCreateDialog } from '@/components/customers/customer-create-dialog';

export default function CustomersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: customers, isLoading } = trpc.customers.list.useQuery({ limit: 200 });
  const { data: stats } = trpc.customers.stats.useQuery();

  const filtered = customers?.filter((c) =>
    !search ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-2 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-content-primary">Kunden</h1>
          <Badge variant="default">{stats?.total ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
            <Input
              placeholder="Kunden suchen…"
              className="pl-8 w-56 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Kunde
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 shrink-0">
        <StatCard label="Gesamt Kunden" value={stats?.total ?? 0} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Aktive Kampagnen" value="–" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Kontakte" value="–" icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Customer List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Keine Kunden"
            description="Erstelle deinen ersten Kunden um loszulegen."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Kunde erstellen
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedId(customer.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 font-bold text-sm">
                      {customer.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-content-primary truncate">
                        {customer.companyName}
                      </p>
                      {customer.industry && (
                        <p className="text-xs text-content-secondary mt-0.5">{customer.industry}</p>
                      )}
                      {customer.website && (
                        <a
                          href={customer.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-600 hover:underline mt-0.5 block truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {customer.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    {customer.healthScore !== null && customer.healthScore !== undefined && (
                      <Badge
                        variant={customer.healthScore >= 70 ? 'success' : customer.healthScore >= 40 ? 'warning' : 'error'}
                      >
                        {customer.healthScore}%
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-content-tertiary">
                    Seit {new Date(customer.createdAt).toLocaleDateString('de-DE')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CustomerCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
