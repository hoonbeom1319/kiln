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
  maxHeight,
  interactive = false,
  className,
}: ScaledFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [contentHeight, setContentHeight] = useState(Math.round(virtualWidth * 0.66)); // provisional 3:2

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

  // On load, read the same-origin scrollHeight so the wrapper matches the whole page.
  const handleLoad = () => {
    try {
      const h = frameRef.current?.contentDocument?.documentElement?.scrollHeight;
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
