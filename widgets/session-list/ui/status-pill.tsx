import type { SessionStatus } from '@/entities/project';

const STYLE: Record<SessionStatus, { cls: string; label: string }> = {
  running: { cls: 'border-accent/40 bg-accent/10 text-accent', label: '진행 중' },
  done: { cls: 'border-ok/40 bg-ok/10 text-ok', label: '완료' },
  error: { cls: 'border-danger/40 bg-danger/10 text-danger', label: '미완료' },
};

// Pure status pill — presentation only (conventions.md §5 ui/).
export function StatusPill({ status }: { status: SessionStatus }) {
  const { cls, label } = STYLE[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
