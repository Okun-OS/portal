'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Textarea, Label, Spinner,
} from '@okun/ui';

const schema = z.object({
  companyName: z.string().min(1, 'Firmenname ist pflicht'),
  industry: z.string().optional(),
  website: z.string().url('Ungültige URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CustomerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerCreateDialog({ open, onOpenChange }: CustomerCreateDialogProps) {
  const utils = trpc.useUtils();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      utils.customers.stats.invalidate();
      toast.success('Kunde erstellt');
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => createCustomer.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Kunde</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required>Firmenname</Label>
            <Input {...register('companyName')} placeholder="Musterfirma GmbH" error={!!errors.companyName} />
            {errors.companyName && <p className="text-xs text-status-error">{errors.companyName.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Branche</Label>
            <Input {...register('industry')} placeholder="E-Commerce, SaaS, Handwerk…" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Website</Label>
            <Input {...register('website')} type="url" placeholder="https://musterfirma.de" error={!!errors.website} />
            {errors.website && <p className="text-xs text-status-error">{errors.website.message}</p>}
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
