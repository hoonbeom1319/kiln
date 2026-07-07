'use client';

import { ForgeRun } from '@/features/forge-run';
import { ReviseChat } from '@/features/revise-chat';
import { ProgressStream } from '@/widgets/progress-stream';
import { ResultGallery } from '@/widgets/result-gallery';
import { ReviseThread } from '@/widgets/revise-thread';
import { SessionList } from '@/widgets/session-list';
import { useForgeScreen } from '../model/use-forge-screen';

// Screen: assembles the forge flow. Two modes off one screen model:
//   create  — input (feature) → live progress (widget) → past-projects list.
//   gallery — a finished/reopened project's gallery + a chat-style revise panel (input, live
//             progress, version thread). A revision keeps whole-project coherence and stacks a
//             new version; the gallery refreshes in place when it finishes.
export function ForgeScreen() {
  const m = useForgeScreen();
  const inGallery = Boolean(m.galleryName);
  const hasJob = Boolean(m.jobId);
  const running = m.stream.status === 'running' && hasJob;
  const reviseRunning = running && m.activeKind === 'revise';
  const isIdle = !inGallery && !hasJob;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          Kiln <span className="text-muted">— 아이디어를 굽는다</span>
        </h1>
        <p className="text-sm text-muted">
          한 줄 아이디어 → PRD · 디자인(tokens + hi-fi) · handoff 패키지. 진행은 실시간 스트리밍.
        </p>
      </header>

      {inGallery ? (
        <>
          <a href="/" className="text-sm font-medium text-accent hover:underline">
            ← 목록
          </a>

          <ResultGallery
            name={m.galleryName as string}
            events={m.stream.events}
            refreshKey={m.refreshKey}
          />

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">수정 · 버전</h2>
            <ReviseChat name={m.galleryName as string} onStarted={m.startRevise} disabled={reviseRunning} />

            {reviseRunning || (hasJob && m.activeKind === 'revise') ? (
              <div className="h-[38vh] min-h-[240px]">
                <ProgressStream events={m.stream.events} status={m.stream.status} phase={m.stream.phase} />
              </div>
            ) : null}

            <ReviseThread name={m.galleryName as string} onJobStarted={m.startRevise} disabled={reviseRunning} />
          </section>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-4">
            <ForgeRun onStarted={m.startForge} disabled={running} />
          </div>

          {hasJob ? (
            <div className="h-[45vh] min-h-[280px]">
              <ProgressStream events={m.stream.events} status={m.stream.status} phase={m.stream.phase} />
            </div>
          ) : null}

          {isIdle ? <SessionList /> : null}
        </>
      )}
    </main>
  );
}
