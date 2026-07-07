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
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          진행 {phase ? <span className="text-muted">— {phase}</span> : null}
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
    running: { label: '진행 중', cls: 'text-accent border-accent' },
    done: { label: '완료', cls: 'text-ok border-ok' },
    error: { label: '실패', cls: 'text-danger border-danger' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status === 'running' ? '● ' : ''}
      {label}
    </span>
  );
}
