'use client';

import { AgentPicker } from '@/features/agent-picker';
import { ForgeRun } from '@/features/forge-run';
import { ReviseChat } from '@/features/revise-chat';
import { ProgressStream } from '@/widgets/progress-stream';
import { ResultGallery } from '@/widgets/result-gallery';
import { ReviseThread } from '@/widgets/revise-thread';
import { SessionList } from '@/widgets/session-list';
import { Panel } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { useForgeScreen } from '../model/use-forge-screen';

// Screen: the Kiln app shell. Desktop-first — a sticky top bar over a widening content region,
// laid out as regions (not one stretched column). Two modes off one screen model:
//   create  — a centred launchpad; once forging, splits into idea/input (left) + live stream
//             (right), with the past-projects grid below when idle.
//   gallery  — a finished/reopened project: the master-detail gallery beside a chat-style revise
//             rail (request, live stream, version thread). Revisions keep whole-project coherence
//             and stack a new version; the gallery refreshes in place when one finishes.
export function ForgeScreen() {
  const m = useForgeScreen();
  const inGallery = Boolean(m.galleryName);
  const hasJob = Boolean(m.jobId);
  const running = m.stream.status === 'running' && hasJob;
  const reviseRunning = running && m.activeKind === 'revise';
  const isIdle = !inGallery && !hasJob;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        right={
          inGallery ? (
            <a
              href="/"
              className="text-sm font-medium text-accent hover:text-accent-hover hover:underline"
            >
              ← 목록
            </a>
          ) : (
            <AgentPicker value={m.agent} onChange={m.setAgent} disabled={running} />
          )
        }
      />

      <main className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10 xl:px-12">
        {inGallery ? (
          <div className="grid w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <ResultGallery
              name={m.galleryName as string}
              events={m.stream.events}
              refreshKey={m.refreshKey}
            />

            <Panel
              as="aside"
              className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:mx-0 lg:max-w-none lg:sticky lg:top-20"
            >
              {/* Stack the title over the picker: the aside is ~360px, too narrow to sit the
                  two-select picker beside the heading without both wrapping mid-word. */}
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">수정 · 버전</h2>
                <AgentPicker value={m.agent} onChange={m.setAgent} disabled={reviseRunning} />
              </div>
              <ReviseChat
                name={m.galleryName as string}
                onStarted={m.startRevise}
                agent={m.agent}
                disabled={reviseRunning}
              />

              {reviseRunning || (hasJob && m.activeKind === 'revise') ? (
                <div className={cn('h-[38vh] min-h-[240px] rounded-xl', reviseRunning && 'kiln-glow')}>
                  <ProgressStream
                    events={m.stream.events}
                    status={m.stream.status}
                    phase={m.stream.phase}
                  />
                </div>
              ) : null}

              <ReviseThread
                name={m.galleryName as string}
                onJobStarted={m.startRevise}
                disabled={reviseRunning}
              />
            </Panel>
          </div>
        ) : isIdle ? (
          // Idle launchpad: full-width. On mobile the hero stacks over the input; from lg it
          // splits into two columns (copy left, input right) so wide screens use the width via a
          // breakpoint instead of a capped, centred column. Past-projects grid below.
          <div className="flex w-full flex-col gap-10">
            <section className="grid w-full gap-6 pt-4 lg:grid-cols-2 lg:items-center lg:gap-10 lg:pt-6">
              <div className="flex flex-col gap-2 text-center lg:text-left">
                <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                  한 줄 아이디어를 넣으면, 구운 패키지가 나옵니다
                </h2>
                <p className="text-pretty text-sm text-muted">
                  PRD · 디자인(tokens + hi-fi 화면) · handoff 패키지까지. 실행은 당신 로컬 에이전트로,
                  운영자 비용 0.
                </p>
              </div>
              <Panel className="p-5 text-left">
                <ForgeRun onStarted={m.startForge} agent={m.agent} disabled={running} />
              </Panel>
            </section>

            <SessionList />
          </div>
        ) : (
          // Forging: idea/input on the left, the live kiln on the right.
          <div className="grid w-full items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel className="p-5">
              <ForgeRun onStarted={m.startForge} agent={m.agent} disabled={running} />
            </Panel>
            <div className={cn('h-[60vh] min-h-[320px] rounded-xl', running && 'kiln-glow')}>
              <ProgressStream
                events={m.stream.events}
                status={m.stream.status}
                phase={m.stream.phase}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Sticky top bar — the wordmark with an ember mark and a mode-dependent action on the right.
function TopBar({ right }: { right: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-canvas/85 backdrop-blur">
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:px-8 xl:px-12">
        <a href="/" className="flex items-center gap-2.5">
          <EmberMark />
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">Kiln</span>
            <span className="hidden text-xs text-muted sm:inline">아이디어를 굽는다</span>
          </span>
        </a>
        <div className="ml-auto flex items-center">{right}</div>
      </div>
    </header>
  );
}

// A small kiln flame — the product's signature glyph, in the ember accent.
function EmberMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="text-accent">
        <path
          fill="currentColor"
          d="M12 2c1.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0C7.5 8 9 6.5 12 2Zm0 18a3 3 0 0 1-3-3c0-1.8 1.3-2.7 3-5 1.7 2.3 3 3.2 3 5a3 3 0 0 1-3 3Z"
        />
      </svg>
    </span>
  );
}
