'use client';

import { ForgeRun } from '@/features/forge-run';
import { ProgressStream } from '@/widgets/progress-stream';
import { ResultGallery } from '@/widgets/result-gallery';
import { useForgeScreen } from '../model/use-forge-screen';

// Screen: assembles the forge flow — input (feature) → live progress (widget) → gallery
// (widget). Client, because the whole view is one interactive session (job id + SSE).
export function ForgeScreen() {
  const { jobId, start, stream, reopened } = useForgeScreen();
  const liveResult = stream.status === 'done' && stream.doneName ? stream.doneName : null;
  // Live run's result wins; otherwise show a project reopened via ?project=.
  const resultName = liveResult ?? (!jobId ? reopened : null);

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

      <div className="rounded-xl border border-border bg-surface p-4">
        <ForgeRun onStarted={start} disabled={stream.status === 'running' && Boolean(jobId)} />
      </div>

      {jobId ? (
        <div className="h-[45vh] min-h-[280px]">
          <ProgressStream events={stream.events} status={stream.status} phase={stream.phase} />
        </div>
      ) : null}

      {resultName ? <ResultGallery name={resultName} events={stream.events} /> : null}
    </main>
  );
}
