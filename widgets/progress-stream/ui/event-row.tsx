import type { KilnEvent } from '@/entities/job';
import { cn } from '@/shared/lib';

// Render one emit-seam event. Mirrors the CLI printer vocabulary (pipeline/events.js) so the
// web progress reads the same as the terminal.
export function EventRow({ ev }: { ev: KilnEvent }) {
  switch (ev.type) {
    case 'phase':
      return <li className="mt-3 font-semibold text-text">▸ {ev.name}</li>;
    case 'step':
      return <li className="pl-3 text-muted">· {ev.msg}</li>;
    case 'model':
      return (
        <li className="pl-6 text-xs text-muted">
          ↳ {ev.stage} via {ev.model} ({ev.attempts || 1} try, {ev.usage?.output ?? 0} out tok)
        </li>
      );
    case 'gate':
      return (
        <li className={cn('pl-3', ev.ok ? 'text-ok' : 'text-danger')}>
          {ev.ok ? '✓' : '✗'} gate {ev.name}
          {ev.summary ? <span className="text-muted"> — {ev.summary}</span> : null}
        </li>
      );
    case 'artifact':
      return <li className="pl-6 font-mono text-xs text-accent">→ {ev.path}</li>;
    case 'warn':
      return <li className="whitespace-pre-wrap pl-3 text-warn">⚠ {ev.msg}</li>;
    case 'done':
      return <li className="mt-3 font-semibold text-ok">✓ 완료 → {ev.dir}</li>;
    case 'error':
      return <li className="mt-3 whitespace-pre-wrap font-semibold text-danger">✗ {ev.msg}</li>;
    default:
      return null;
  }
}
