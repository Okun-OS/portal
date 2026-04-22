import * as React from 'react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-surface-2 bg-surface-0 p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary font-medium">{label}</span>
          <span className="text-2xl font-bold text-content-primary tabular-nums">{value}</span>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1 text-content-secondary">
            {icon}
          </div>
        )}
      </div>
      {delta && (
        <p className={cn('mt-2 text-xs', delta.positive ? 'text-status-success' : 'text-status-error')}>
          {delta.positive ? '↑' : '↓'} {delta.value} vs. Vormonat
        </p>
      )}
    </div>
  );
}

export { StatCard };
