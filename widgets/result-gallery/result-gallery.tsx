'use client';

import { useState } from 'react';
import { artifactUrl, useTraceability, type KilnEvent, type TraceScreen } from '@/entities/job';
import { Panel, ScaledFrame } from '@/shared/ui';
import { cn } from '@/shared/lib';

interface ResultGalleryProps {
  name: string;
  events: KilnEvent[];
  // Bumped after a revision rewrites the screens — appended to iframe URLs to bust the cache so
  // the gallery shows the new version, not the browser's copy of the old one.
  refreshKey?: number;
}

type View = 'detail' | 'overview';

// Widget: the finished-run gallery, master-detail. A left rail of scaled thumbnails (whole
// screen, no inner scroll) drives one large preview on the right; "개요" flips to a compare grid.
// Each screen carries a one-line note on which PRD requirement it reflects (traceability.json).
// Falls back to the packaged handoff/index.html for older projects that predate traceability.
export function ResultGallery({ name, events, refreshKey = 0 }: ResultGalleryProps) {
  const gates = events.filter((e): e is Extract<KilnEvent, { type: 'gate' }> => e.type === 'gate');
  const { data: trace, isLoading } = useTraceability(name);
  const bust = refreshKey ? `?v=${refreshKey}` : '';
  const galleryUrl = artifactUrl(`${name}/handoff/index.html`) + bust;

  const screens = trace?.screens ?? [];
  const [view, setView] = useState<View>('detail');
  const [selected, setSelected] = useState(0);
  const activeIdx = Math.min(selected, Math.max(0, screens.length - 1));
  const active = screens[activeIdx];

  const screenUrl = (s: TraceScreen) => artifactUrl(`${name}/handoff/screens/${s.file}`) + bust;

  return (
    <Panel className="flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">
          결과 <span className="text-muted">— {name}</span>
        </h2>

        {gates.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {gates.map((g) => (
              <li
                key={g.seq}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  g.ok ? 'border-ok/40 bg-ok/10 text-ok' : 'border-danger/40 bg-danger/10 text-danger',
                )}
                title={g.summary}
              >
                {g.ok ? '✓' : '✗'} {g.name}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {screens.length > 1 ? (
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              <ViewTab active={view === 'detail'} onClick={() => setView('detail')}>
                디테일
              </ViewTab>
              <ViewTab active={view === 'overview'} onClick={() => setView('overview')}>
                개요
              </ViewTab>
            </div>
          ) : null}
          <a
            href={galleryUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
          >
            handoff ↗
          </a>
        </div>
      </header>

      {screens.length ? (
        view === 'overview' ? (
          <OverviewGrid
            screens={screens}
            urlFor={screenUrl}
            onOpen={(i) => {
              setSelected(i);
              setView('detail');
            }}
          />
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(180px,220px)_1fr]">
            {/* Rail: horizontal filmstrip on mobile, vertical list on desktop. */}
            <nav className="flex gap-2 overflow-x-auto border-b border-border p-3 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
              {screens.map((s, i) => (
                <Thumb
                  key={s.file}
                  screen={s}
                  url={screenUrl(s)}
                  active={i === activeIdx}
                  onClick={() => setSelected(i)}
                />
              ))}
            </nav>

            {/* Detail: one large preview + its PRD note. The only scroll point in the gallery. */}
            <div className="min-w-0 p-3 sm:p-4">
              {active ? (
                <figure className="m-0 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <figcaption className="text-sm font-semibold">
                      {active.title || active.file}
                    </figcaption>
                    <a
                      href={screenUrl(active)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                    >
                      크게 열기 ↗
                    </a>
                  </div>
                  <div className="max-h-[72vh] overflow-y-auto rounded-lg border border-border">
                    <ScaledFrame src={screenUrl(active)} title={active.title || active.file} />
                  </div>
                  <p className="flex gap-2 text-[13px] leading-snug text-muted">
                    <span className="mt-px shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text">
                      PRD 반영
                    </span>
                    <span className="min-w-0">{active.reflects}</span>
                  </p>
                </figure>
              ) : null}
            </div>
          </div>
        )
      ) : (
        // Fallback: no traceability (older project) or still loading — the packaged gallery.
        <div className="p-3 sm:p-4">
          <iframe
            src={galleryUrl}
            title={`${name} 화면 갤러리`}
            className="h-[70vh] w-full rounded-lg border border-border bg-white"
          />
          {isLoading ? (
            <p className="mt-2 text-xs text-muted">PRD↔화면 매핑 불러오는 중…</p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-2 py-0.5 font-medium transition-colors',
        active ? 'bg-accent text-accent-on' : 'text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

function Thumb({
  screen,
  url,
  active,
  onClick,
}: {
  screen: TraceScreen;
  url: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={screen.title || screen.file}
      className={cn(
        'group flex w-40 shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-colors lg:w-full',
        active ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/60',
      )}
    >
      <ScaledFrame src={url} title={screen.title || screen.file} maxHeight={110} />
      <span
        className={cn(
          'truncate border-t border-border px-2 py-1.5 text-xs font-medium',
          active ? 'bg-accent/10 text-text' : 'bg-surface text-muted group-hover:text-text',
        )}
      >
        {screen.title || screen.file}
      </span>
    </button>
  );
}

function OverviewGrid({
  screens,
  urlFor,
  onOpen,
}: {
  screens: TraceScreen[];
  urlFor: (s: TraceScreen) => string;
  onOpen: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-3 sm:p-4">
      {screens.map((s, i) => (
        <button
          key={s.file}
          type="button"
          onClick={() => onOpen(i)}
          className="group m-0 flex flex-col overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-accent"
        >
          <ScaledFrame src={urlFor(s)} title={s.title || s.file} maxHeight={200} />
          <div className="flex flex-col gap-1 border-t border-border p-3">
            <span className="text-sm font-semibold group-hover:text-accent">{s.title || s.file}</span>
            <span className="line-clamp-2 text-[13px] leading-snug text-muted">{s.reflects}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
