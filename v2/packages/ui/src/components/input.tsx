import * as React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border bg-surface-0 px-3 py-1 text-sm shadow-sm transition-colors',
        'border-surface-3 text-content-primary placeholder:text-content-tertiary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-status-error focus-visible:ring-status-error',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
