'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Textarea, Label, Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem, Spinner,
} from '@okun/ui';

const schema = z.object({
  customerId: z.string().min(1, 'Kunde ist pflicht'),
  name: z.string().min(1, 'Name ist pflicht'),
  description: z.string().optional(),
  platform: z.enum(['meta', 'google', 'tiktok', 'manual']).default('manual'),
  budgetMonthly: z.coerce.number().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CampaignCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignCreateDialog({ open, onOpenChange }: CampaignCreateDialogProps) {
  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery({ limit: 200 });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { platform: 'manual', budgetMonthly: 0 },
  });

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      toast.success('Kampagne erstellt');
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => createCampaign.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Kampagne</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required>Kunde</Label>
            <Select onValueChange={(v) => setValue('customerId', v)}>
              <SelectTrigger error={!!errors.customerId}>
                <SelectValue placeholder="Kunde auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && <p className="text-xs text-status-error">{errors.customerId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label required>Kampagnenname</Label>
            <Input {...register('name')} placeholder="Sommerkampagne 2026" error={!!errors.name} />
            {errors.name && <p className="text-xs text-status-error">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Plattform</Label>
              <Select defaultValue="manual" onValueChange={(v) => setValue('platform', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuell</SelectItem>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                  <SelectItem value="tiktok">TikTok Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Budget / Monat (€)</Label>
              <Input {...register('budgetMonthly')} type="number" min="0" placeholder="1000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Startdatum</Label>
              <Input {...register('startDate')} type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Enddatum</Label>
              <Input {...register('endDate')} type="date" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Beschreibung</Label>
            <Textarea {...register('description')} placeholder="Kurze Kampagnenbeschreibung…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
