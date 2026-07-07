'use client';

import { useEffect, useRef, useState } from 'react';
import { jobStreamUrl } from '../api';
import type { JobStatus, KilnEvent } from '../types';

export interface JobStream {
  events: KilnEvent[];
  status: JobStatus;
  phase: string | null; // the most recent phase name
  doneName: string | null; // project name once the run finishes (for the gallery)
  errorMsg: string | null;
}

const INITIAL: JobStream = {
  events: [],
  status: 'running',
  phase: null,
  doneName: null,
  errorMsg: null,
};

// Subscribe to a job's SSE stream (the client end of pipeline/events.js). Accumulates every
// event and derives the coarse state the UI needs. Closes the connection on done/error or
// unmount. Passing null (no active job) keeps it idle.
export function useJobStream(jobId: string | null): JobStream {
  const [state, setState] = useState<JobStream>(INITIAL);
  const seenSeq = useRef<Set<number>>(new Set());
  const terminated = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setState(INITIAL);
      return;
    }
    seenSeq.current = new Set();
    terminated.current = false;
    setState(INITIAL);

    const source = new EventSource(jobStreamUrl(jobId));

    source.onmessage = (msg) => {
      let ev: KilnEvent;
      try {
        ev = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (seenSeq.current.has(ev.seq)) return;
      seenSeq.current.add(ev.seq);

      setState((prev) => {
        const next: JobStream = { ...prev, events: [...prev.events, ev] };
        if (ev.type === 'phase') next.phase = ev.name;
        if (ev.type === 'done') {
          next.status = 'done';
          next.doneName = ev.name ?? prev.doneName;
        }
        if (ev.type === 'error') {
          next.status = 'error';
          next.errorMsg = ev.msg;
        }
        return next;
      });

      if (ev.type === 'done' || ev.type === 'error') {
        terminated.current = true;
        source.close();
      }
    };

    // Network error while still running — surface it but don't crash. The server closes the
    // stream cleanly on terminal events, which also fires onerror; the synchronous
    // `terminated` ref (setState is async) tells the two apart.
    source.onerror = () => {
      if (terminated.current) return;
      terminated.current = true;
      setState((prev) =>
        prev.status === 'running'
          ? { ...prev, status: 'error', errorMsg: prev.errorMsg ?? '스트림 연결 끊김' }
          : prev,
      );
      source.close();
    };

    return () => source.close();
  }, [jobId]);

  return state;
}
