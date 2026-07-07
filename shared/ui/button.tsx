import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Pure presentational primitive — no domain knowledge (conventions.md §5, shared/ui).
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-on hover:opacity-90',
        variant === 'ghost' && 'border border-border bg-transparent text-text hover:bg-surface',
        className,
      )}
      {...rest}
    />
  );
}
