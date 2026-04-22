'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Textarea, Label, Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem, Spinner, Separator,
} from '@okun/ui';

const lineSchema = z.object({
  description: z.string().min(1, 'Beschreibung pflicht'),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().default('Pauschal'),
  unitPrice: z.coerce.number(),
  vatRate: z.coerce.number().default(19),
});

const schema = z.object({
  customerId: z.string().min(1, 'Kunde ist pflicht'),
  issueDate: z.string().min(1, 'Rechnungsdatum pflicht'),
  dueDate: z.string().min(1, 'Fälligkeitsdatum pflicht'),
  serviceFrom: z.string().optional(),
  serviceTo: z.string().optional(),
  vatType: z.enum(['standard_19', 'reduced_7', 'reverse_charge_13b', 'eu_intra', 'third_country', 'exempt']).default('standard_19'),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Mindestens eine Position'),
});

type FormData = z.infer<typeof schema>;

const today = new Date().toISOString().split('T')[0];
const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceCreateDialog({ open, onOpenChange }: InvoiceCreateDialogProps) {
  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery({ limit: 200 });

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      issueDate: today,
      dueDate: in30,
      vatType: 'standard_19',
      lines: [{ description: '', quantity: 1, unit: 'Pauschal', unitPrice: 0, vatRate: 19 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  const netTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const vatTotal = lines.reduce((s, l) => {
    const net = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    return s + net * ((Number(l.vatRate) || 0) / 100);
  }, 0);

  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      utils.billing.listInvoices.invalidate();
      utils.billing.billingStats.invalidate();
      toast.success('Rechnung erstellt');
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => createInvoice.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Rechnung</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
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
              <Label>MwSt.-Typ</Label>
              <Select defaultValue="standard_19" onValueChange={(v) => setValue('vatType', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard_19">19% Standard</SelectItem>
                  <SelectItem value="reduced_7">7% Ermäßigt</SelectItem>
                  <SelectItem value="reverse_charge_13b">§13b Reverse Charge</SelectItem>
                  <SelectItem value="eu_intra">EU-Innergemeinschaftlich</SelectItem>
                  <SelectItem value="exempt">Steuerfrei</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label required>Rechnungsdatum</Label>
              <Input {...register('issueDate')} type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label required>Fällig am</Label>
              <Input {...register('dueDate')} type="date" />
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-content-tertiary">Positionen</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ description: '', quantity: 1, unit: 'Pauschal', unitPrice: 0, vatRate: 19 })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Position
              </Button>
            </div>

            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <Input {...register(`lines.${i}.description`)} placeholder="Leistungsbeschreibung" error={!!errors.lines?.[i]?.description} />
                </div>
                <div className="col-span-2">
                  <Input {...register(`lines.${i}.quantity`)} type="number" min="0" step="0.01" placeholder="Menge" />
                </div>
                <div className="col-span-2">
                  <Input {...register(`lines.${i}.unitPrice`)} type="number" min="0" step="0.01" placeholder="Preis" />
                </div>
                <div className="col-span-2">
                  <Input {...register(`lines.${i}.vatRate`)} type="number" min="0" placeholder="MwSt %" />
                </div>
                <div className="col-span-1 flex justify-end">
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-status-error" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-surface-1 p-4 ml-auto w-64 text-sm">
            <div className="flex justify-between text-content-secondary">
              <span>Netto</span>
              <span>€{netTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-content-secondary mt-1">
              <span>MwSt.</span>
              <span>€{vatTotal.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-content-primary">
              <span>Brutto</span>
              <span>€{(netTotal + vatTotal).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notizen</Label>
            <Textarea {...register('notes')} placeholder="Zahlungsbedingungen, Hinweise…" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
              Rechnung erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
