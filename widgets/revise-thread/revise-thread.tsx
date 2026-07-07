'use client';

import { useMutation } from '@tanstack/react-query';
import {
  rollbackMutationOptions,
  useRevisions,
  type RevisionEntry,
} from '@/entities/job';

interface ReviseThreadProps {
  name: string;
  // Rollback starts a streamed job; lift its id to the screen (same as a revise).
  onJobStarted: (jobId: string) => void;
  disabled?: boolean;
}

// Widget: the revision thread — the chat history of a project's design. Renders each version as
// a turn (forge baseline · revise request+plan · rollback), marks the current head, and lets any
// past version be restored. Reads the engine-owned revisions.json via the job entity.
export function ReviseThread({ name, onJobStarted, disabled }: ReviseThreadProps) {
  const { data: log } = useRevisions(name);

  const rollback = useMutation({
    ...rollbackMutationOptions(),
    onSuccess: (res) => onJobStarted(res.id),
  });

  if (!log || log.entries.length <= 1) {
    return (
      <p className="text-xs text-muted">
        아직 수정 이력이 없습니다. 위 상자에 바꾸고 싶은 점을 적어 보내면 전체 맥락을 이해하고 일관되게 다시 굽습니다.
      </p>
    );
  }

  const head = log.head;
  return (
    <ol className="flex flex-col gap-3">
      {log.entries.map((e) => (
        <Turn
          key={e.version}
          entry={e}
          isHead={e.version === head}
          canRestore={e.version !== head && !disabled && !rollback.isPending}
          onRestore={() => rollback.mutate({ name, version: e.version })}
        />
      ))}
      {rollback.error ? <li className="text-sm text-danger">{rollback.error.message}</li> : null}
    </ol>
  );
}

function Turn({
  entry,
  isHead,
  canRestore,
  onRestore,
}: {
  entry: RevisionEntry;
  isHead: boolean;
  canRestore: boolean;
  onRestore: () => void;
}) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-border/60 px-1.5 py-0.5 text-xs text-text">v{entry.version}</span>
          <KindLabel entry={entry} />
          {isHead ? <span className="text-xs font-medium text-accent">● 현재</span> : null}
        </span>
        {canRestore ? (
          <button
            type="button"
            onClick={onRestore}
            className="text-xs font-medium text-accent hover:underline"
          >
            이 버전으로 되돌리기
          </button>
        ) : null}
      </div>

      {entry.feedback ? (
        <p className="rounded-md bg-canvas px-2.5 py-1.5 text-sm text-text">🙂 {entry.feedback}</p>
      ) : null}
      {entry.note ? <p className="text-sm leading-snug text-muted">✎ {entry.note}</p> : null}
      {entry.changed && entry.changed.length ? (
        <p className="font-mono text-[11px] text-muted">{entry.changed.join(' · ')}</p>
      ) : null}
    </li>
  );
}

function KindLabel({ entry }: { entry: RevisionEntry }) {
  if (entry.kind === 'forge') return <span className="text-muted">초기 생성</span>;
  if (entry.kind === 'rollback')
    return <span className="text-muted">v{entry.from}로 롤백</span>;
  return <span className="text-muted">수정</span>;
}
