'use client';

import { useSessions } from '@/entities/project';
import { relativeTime } from '../lib/relative-time';
import { StatusPill } from './status-pill';

// Widget: the home list of past forge sessions. Assembly point — calls the entity hook and
// renders each project as a row linking to its reopened gallery (?project=<name>, already
// handled by screens/forge). Shown on the idle home screen.
export function SessionList() {
  const { data: sessions, isLoading, isError } = useSessions();

  if (isLoading) {
    return <p className="px-1 text-sm text-muted">이전 프로젝트 불러오는 중…</p>;
  }
  if (isError) {
    return <p className="px-1 text-sm text-danger">프로젝트 목록을 불러오지 못했습니다.</p>;
  }
  if (!sessions || sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        아직 구운 프로젝트가 없습니다. 위에 아이디어를 넣고 시작해 보세요.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-muted">이전 프로젝트</h2>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.name}>
            <a
              href={`/?project=${encodeURIComponent(s.name)}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{s.idea || s.name}</span>
                <span className="text-xs text-muted">
                  {relativeTime(s.updatedAt)}
                  {s.screenCount > 0 ? ` · 화면 ${s.screenCount}개` : ''}
                </span>
              </div>
              <StatusPill status={s.status} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
