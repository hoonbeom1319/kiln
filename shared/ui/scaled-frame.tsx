'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib';

interface ScaledFrameProps {
  src: string;
  title: string;
  // The viewport width we pretend the screen is displayed at, then scale down to fit the
  // container. Rendering at a real desktop width and shrinking = a faithful thumbnail with no
  // internal scrollbar (the wireframe-era problem was cramming full pages into a short iframe).
  virtualWidth?: number;
  // A fixed virtual viewport height. REQUIRED for app-frame artifacts that lay out with
  // `min-height:100vh` (their scrollHeight equals whatever height we give the iframe, so
  // auto-measuring is circular and collapses to the provisional height). Giving a real phone
  // height (e.g. 480×1040) renders the screen at its intended viewport instead of a cramped box.
  // When set, measurement is skipped.
  virtualHeight?: number;
  // If set, clip the preview to this pixel height (a thumbnail shows the top of the screen).
  // If omitted, the wrapper grows to the whole scaled page — no inner scroll anywhere.
  maxHeight?: number;
  // Thumbnails/previews are static by default (pointer-events off) so a stray inner scroll or
  // click never fights the page. Real interaction happens via "open large".
  interactive?: boolean;
  className?: string;
}

// Shared primitive (conventions.md §5, shared/ui): render an artifact iframe at a virtual desktop
// width and CSS-scale it to fit its container. Reads the same-origin content height on load so the
// whole page fits with zero internal scrolling — the fix for the gallery's per-iframe scroll.
export function ScaledFrame({
  src,
  title,
  virtualWidth = 1280,
  virtualHeight,
  maxHeight,
  interactive = false,
  className,
}: ScaledFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  // Fixed viewport (virtualHeight) wins; otherwise a provisional 3:2 until onLoad measures.
  const [contentHeight, setContentHeight] = useState(virtualHeight ?? Math.round(virtualWidth * 0.66));

  // scale = container width / virtual width; re-measure on container resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / virtualWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualWidth]);

  const handleLoad = () => {
    const doc = frameRef.current?.contentDocument;
    // In non-interactive previews, hide the artifact's own scrollbars. App-frame mockups keep a
    // fixed header/footer around an internal overflow-y:auto region; with pointer-events off its
    // scrollbar is a dead, ugly bar. Same-origin, so inject a style to suppress it — the preview
    // reads as a clean phone snapshot; "open large" gives the full, scrollable screen.
    if (!interactive && doc) {
      try {
        const s = doc.createElement('style');
        s.textContent =
          '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}' +
          '*{scrollbar-width:none!important;-ms-overflow-style:none!important}';
        doc.head.appendChild(s);
      } catch {
        /* cross-origin: nothing to hide */
      }
    }
    // Read the same-origin scrollHeight so the wrapper matches the whole page. Skipped for a fixed
    // virtualHeight (100vh app frames can't be measured — scrollHeight just echoes it back).
    if (virtualHeight) return;
    try {
      const h = doc?.documentElement?.scrollHeight;
      if (h) setContentHeight(h);
    } catch {
      /* cross-origin fallback: keep the provisional height */
    }
  };

  const scaledFull = contentHeight * scale;
  const height = maxHeight ? Math.min(maxHeight, scaledFull || maxHeight) : scaledFull;

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-hidden bg-white', className)}
      style={{ height: height || undefined, minHeight: height ? undefined : maxHeight }}
    >
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        loading="lazy"
        onLoad={handleLoad}
        tabIndex={interactive ? undefined : -1}
        className="border-0 bg-white"
        style={{
          width: virtualWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />
    </div>
  );
}
