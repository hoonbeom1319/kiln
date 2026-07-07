import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

type Variant = 'primary' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Pure presentational primitive — no domain knowledge (conventions.md §5, shared/ui).
export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-accent text-accent-on hover:bg-accent-hover',
        variant === 'ghost' && 'border border-border bg-transparent text-text hover:bg-surface-2',
        className,
      )}
      {...rest}
    />
  );
}
