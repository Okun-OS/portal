'use client';

import { useState } from 'react';
import { Plus, Search, FileText, Euro, Clock, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button, Input, Badge, Card, CardContent, EmptyState, Spinner, StatCard } from '@okun/ui';
import { InvoiceCreateDialog } from '@/components/billing/invoice-create-dialog';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  draft: { label: 'Entwurf', variant: 'outline' },
  sent: { label: 'Versendet', variant: 'brand' },
  paid: { label: 'Bezahlt', variant: 'success' },
  overdue: { label: 'Überfällig', variant: 'error' },
  cancelled: { label: 'Storniert', variant: 'default' },
};

export default function InvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: invoices, isLoading } = trpc.billing.listInvoices.useQuery({ limit: 200 });
  const { data: stats } = trpc.billing.billingStats.useQuery();
  const utils = trpc.useUtils();

  const updateStatus = trpc.billing.updateInvoiceStatus.useMutation({
    onSuccess: () => {
      utils.billing.listInvoices.invalidate();
      utils.billing.billingStats.invalidate();
      toast.success('Status aktualisiert');
    },
    onError: (err) => toast.error(err.message),
  });

  const paidTotal = stats?.find((s) => s.status === 'paid')?.totalGross ?? 0;
  const overdueTotal = stats?.find((s) => s.status === 'overdue')?.totalGross ?? 0;
  const openTotal = stats?.find((s) => s.status === 'sent')?.totalGross ?? 0;

  const filtered = invoices?.filter((inv) =>
    !search ||
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-2 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-content-primary">Rechnungen</h1>
          <Badge variant="default">{invoices?.length ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
            <Input
              placeholder="Rechnungen suchen…"
              className="pl-8 w-56 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Rechnung
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4 shrink-0">
        <StatCard
          label="Bezahlt (gesamt)"
          value={`€${Number(paidTotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Offen"
          value={`€${Number(openTotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Überfällig"
          value={`€${Number(overdueTotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
          icon={<Euro className="h-4 w-4" />}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Keine Rechnungen"
            description="Erstelle deine erste Rechnung."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Rechnung erstellen
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((invoice) => {
              const statusInfo = STATUS_LABELS[invoice.status] ?? STATUS_LABELS.draft;
              return (
                <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-content-secondary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-xs text-content-secondary mt-0.5">
                            Fällig: {invoice.dueDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-bold text-content-primary">
                            €{invoice.grossAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-content-tertiary">inkl. MwSt.</p>
                        </div>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {invoice.status === 'sent' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus.mutate({ id: invoice.id, status: 'paid' })}
                          >
                            Als bezahlt markieren
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <InvoiceCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
