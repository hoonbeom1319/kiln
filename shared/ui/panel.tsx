import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'aside';
}

// Shared primitive (conventions.md §5, shared/ui): the standard surface card. Layering comes from
// a bright-ish surface over a darker canvas plus a hairline border — not heavy shadow — so it
// reads as depth in dark mode rather than as a wireframe box.
export function Panel({ as: Tag = 'section', className, ...rest }: PanelProps) {
  return (
    <Tag className={cn('rounded-xl border border-border bg-surface', className)} {...rest} />
  );
}
