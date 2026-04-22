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
  name: z.string().min(1, 'Name ist pflicht'),
  email: z.string().email('Ungültige E-Mail').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadCreateDialog({ open, onOpenChange }: LeadCreateDialogProps) {
  const utils = trpc.useUtils();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
      toast.success('Lead erstellt');
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => createLead.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required>Name</Label>
            <Input {...register('name')} placeholder="Max Mustermann" error={!!errors.name} />
            {errors.name && <p className="text-xs text-status-error">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>E-Mail</Label>
              <Input {...register('email')} type="email" placeholder="max@firma.de" error={!!errors.email} />
              {errors.email && <p className="text-xs text-status-error">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Telefon</Label>
              <Input {...register('phone')} placeholder="+49 30 …" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Unternehmen</Label>
            <Input {...register('company')} placeholder="Musterfirma GmbH" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Quelle</Label>
            <Input {...register('source')} placeholder="Website, Referral, Meta Ads …" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notizen</Label>
            <Textarea {...register('notes')} placeholder="Optionale Notizen…" rows={3} />
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
