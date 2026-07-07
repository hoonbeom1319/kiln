import type { SessionStatus } from '@/entities/project';

const STYLE: Record<SessionStatus, { cls: string; label: string }> = {
  running: { cls: 'border-accent text-accent', label: '진행 중' },
  done: { cls: 'border-ok text-ok', label: '완료' },
  error: { cls: 'border-danger text-danger', label: '미완료' },
};

// Pure status pill — presentation only (conventions.md §5 ui/).
export function StatusPill({ status }: { status: SessionStatus }) {
  const { cls, label } = STYLE[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
