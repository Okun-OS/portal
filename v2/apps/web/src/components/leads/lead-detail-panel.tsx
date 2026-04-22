'use client';

import { useState } from 'react';
import { X, Mail, Phone, Building2, Globe, Zap, User, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Button, Badge, Spinner, Separator, Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem, Tabs, TabsList, TabsTrigger, TabsContent,
} from '@okun/ui';
import { cn } from '@okun/ui';

const STATUS_OPTIONS = [
  { value: 'inbox', label: 'Eingang' },
  { value: 'qualified', label: 'Qualifiziert' },
  { value: 'contacted', label: 'Kontaktiert' },
  { value: 'proposal', label: 'Angebot' },
  { value: 'won', label: 'Gewonnen' },
  { value: 'lost', label: 'Verloren' },
] as const;

const QUALITY_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'brand' }> = {
  hot: { label: 'Hot', variant: 'error' as any },
  warm: { label: 'Warm', variant: 'warning' },
  cold: { label: 'Kalt', variant: 'brand' },
};

interface LeadDetailPanelProps {
  leadId: string;
  onClose: () => void;
}

export function LeadDetailPanel({ leadId, onClose }: LeadDetailPanelProps) {
  const utils = trpc.useUtils();
  const { data: lead, isLoading } = trpc.leads.byId.useQuery({ id: leadId });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.byId.invalidate({ id: leadId });
      toast.success('Status aktualisiert');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
      toast.success('Lead gelöscht');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[480px] flex-col border-l border-surface-2 bg-surface-0 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-2 px-5 py-4">
        <span className="text-sm font-semibold text-content-primary">Lead-Details</span>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-surface-1 text-content-tertiary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading || !lead ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Identity */}
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-content-primary">{lead.name}</h2>
                {lead.company && (
                  <p className="text-sm text-content-secondary flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {lead.company}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {lead.quality && QUALITY_BADGES[lead.quality] && (
                  <Badge variant={QUALITY_BADGES[lead.quality].variant}>
                    {QUALITY_BADGES[lead.quality].label}
                  </Badge>
                )}
                {lead.aiScore !== null && lead.aiScore !== undefined && (
                  <Badge variant="outline">
                    <Zap className="h-3 w-3 mr-0.5" />
                    {lead.aiScore}/100
                  </Badge>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="flex flex-col gap-1.5">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-content-secondary hover:text-brand-600">
                  <Mail className="h-4 w-4 shrink-0" />
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-content-secondary hover:text-brand-600">
                  <Phone className="h-4 w-4 shrink-0" />
                  {lead.phone}
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-content-secondary hover:text-brand-600">
                  <Globe className="h-4 w-4 shrink-0" />
                  {lead.website}
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="px-5 py-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-content-tertiary uppercase tracking-wide">Status</span>
            <Select
              value={lead.status}
              onValueChange={(v) => updateStatus.mutate({ id: lead.id, status: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Tabs */}
          <div className="px-5 py-4 flex-1">
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="notes">Notizen</TabsTrigger>
                <TabsTrigger value="ai">AI Score</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <div className="flex flex-col gap-3 text-sm">
                  {lead.source && (
                    <div className="flex justify-between">
                      <span className="text-content-tertiary">Quelle</span>
                      <span className="text-content-primary font-medium">{lead.source}</span>
                    </div>
                  )}
                  {lead.industry && (
                    <div className="flex justify-between">
                      <span className="text-content-tertiary">Branche</span>
                      <span className="text-content-primary font-medium">{lead.industry}</span>
                    </div>
                  )}
                  {lead.region && (
                    <div className="flex justify-between">
                      <span className="text-content-tertiary">Region</span>
                      <span className="text-content-primary font-medium">{lead.region}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-content-tertiary">Erstellt</span>
                    <span className="text-content-primary font-medium">
                      {new Date(lead.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes">
                <p className="text-sm text-content-secondary whitespace-pre-wrap">
                  {lead.notes || 'Keine Notizen'}
                </p>
              </TabsContent>

              <TabsContent value="ai">
                {lead.aiScore !== null && lead.aiScore !== undefined ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-brand-500 text-xl font-bold text-brand-600">
                        {lead.aiScore}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-content-primary">AI-Score</p>
                        <p className="text-xs text-content-secondary">von 100 möglichen Punkten</p>
                      </div>
                    </div>
                    {lead.aiScoreReason && (
                      <p className="text-sm text-content-secondary bg-surface-1 rounded-lg p-3">
                        {lead.aiScoreReason}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-content-tertiary">Noch kein AI-Score berechnet</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      {lead && (
        <div className="border-t border-surface-2 px-5 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-status-error hover:text-status-error hover:bg-red-50"
            onClick={() => {
              if (confirm('Lead wirklich löschen?')) deleteLead.mutate({ id: lead.id });
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Löschen
          </Button>
          {lead.status !== 'won' && (
            <Button size="sm" variant="outline">
              <ArrowRight className="h-4 w-4 mr-1.5" />
              Zu Kunde konvertieren
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
