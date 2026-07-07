'use client';

import { artifactUrl, useTraceability, type KilnEvent } from '@/entities/job';

interface ResultGalleryProps {
  name: string;
  events: KilnEvent[];
  // Bumped after a revision rewrites the screens — appended to iframe URLs to bust the cache so
  // the gallery shows the new version, not the browser's copy of the old one.
  refreshKey?: number;
}

// Widget: the finished-run gallery. Renders each hi-fi screen with a one-line note on which
// PRD requirement it reflects (from traceability.json). Falls back to the packaged
// handoff/index.html gallery for older projects that predate traceability.
export function ResultGallery({ name, events, refreshKey = 0 }: ResultGalleryProps) {
  const gates = events.filter((e): e is Extract<KilnEvent, { type: 'gate' }> => e.type === 'gate');
  const { data: trace, isLoading } = useTraceability(name);
  const bust = refreshKey ? `?v=${refreshKey}` : '';
  const galleryUrl = artifactUrl(`${name}/handoff/index.html`) + bust;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">결과 — {name}</h2>
        <a
          href={galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent hover:underline"
        >
          handoff 갤러리 새 탭 ↗
        </a>
      </header>

      {gates.length ? (
        <ul className="flex flex-wrap gap-2">
          {gates.map((g) => (
            <li
              key={g.seq}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                g.ok ? 'border-ok text-ok' : 'border-danger text-danger'
              }`}
              title={g.summary}
            >
              {g.ok ? '✓' : '✗'} {g.name}
            </li>
          ))}
        </ul>
      ) : null}

      {trace && trace.screens.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {trace.screens.map((s) => (
            <figure
              key={s.file}
              className="m-0 flex flex-col overflow-hidden rounded-lg border border-border"
            >
              <iframe
                src={artifactUrl(`${name}/handoff/screens/${s.file}`) + bust}
                title={s.title || s.file}
                loading="lazy"
                className="h-[460px] w-full border-0 bg-white"
              />
              <figcaption className="flex flex-col gap-1 border-t border-border p-3">
                <span className="text-sm font-semibold">{s.title || s.file}</span>
                <span className="text-[13px] leading-snug text-muted">
                  <span className="mr-1 rounded bg-border/60 px-1 py-0.5 text-[11px] text-text">
                    PRD 반영
                  </span>
                  {s.reflects}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        // Fallback: no traceability (older project) or still loading — show the packaged gallery.
        <iframe
          src={galleryUrl}
          title={`${name} 화면 갤러리`}
          className="h-[70vh] w-full rounded-lg border border-border bg-white"
        />
      )}

      {isLoading ? <p className="text-xs text-muted">PRD↔화면 매핑 불러오는 중…</p> : null}
    </section>
  );
}
