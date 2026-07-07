'use client';

import { useEffect, useRef } from 'react';
import type { JobStatus, KilnEvent } from '@/entities/job';
import { EventRow } from './ui/event-row';

interface ProgressStreamProps {
  events: KilnEvent[];
  status: JobStatus;
  phase: string | null;
}

// Widget: the live progress panel. Presentation only — it receives the accumulated stream
// as props (the screen owns the useJobStream subscription). Auto-scrolls to the newest event.
export function ProgressStream({ events, status, phase }: ProgressStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [events.length]);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          가마 {status === 'running' ? <span className="text-muted">굽는 중</span> : null}
          {phase ? (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted">
              {phase}
            </span>
          ) : null}
        </h2>
        <StatusPill status={status} />
      </header>
      <ol className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm leading-relaxed">
        {events.map((ev) => (
          <EventRow key={ev.seq} ev={ev} />
        ))}
        <div ref={endRef} />
      </ol>
    </section>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; cls: string }> = {
    running: { label: '진행 중', cls: 'border-accent/40 bg-accent/10 text-accent' },
    done: { label: '완료', cls: 'border-ok/40 bg-ok/10 text-ok' },
    error: { label: '실패', cls: 'border-danger/40 bg-danger/10 text-danger' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status === 'running' ? (
        <span className="ember-breathe h-1.5 w-1.5 rounded-full bg-accent" />
      ) : null}
      {label}
    </span>
  );
}
