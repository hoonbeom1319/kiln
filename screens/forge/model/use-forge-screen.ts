'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobStream, type JobStream } from '@/entities/job';

type ActiveKind = 'forge' | 'revise' | null;

// sessionStorage key for the in-flight job, so a refresh re-attaches to the run instead of
// dropping to idle (the run itself lives in the server process; the SSE stream replays it).
const ACTIVE_JOB_KEY = 'kiln:active-job';

export interface ForgeScreenModel {
  jobId: string | null;
  stream: JobStream;
  activeKind: ActiveKind;
  // The project whose gallery is open. Set once a forge finishes or a project is reopened;
  // persists across revisions so the gallery stays mounted while a revision streams.
  galleryName: string | null;
  // Bumped on a revise/rollback done to cache-bust the gallery iframes (screens were rewritten).
  refreshKey: number;
  isReopen: boolean;
  // The local BYO agent that runs forge/revise (chosen in the picker). Passed as `model`.
  agent: string | null;
  setAgent: (alias: string) => void;
  startForge: (jobId: string) => void;
  startRevise: (jobId: string) => void;
}

// Screen model (conventions.md §2.1 model/): owns the active job (forge OR revise/rollback) and
// the open gallery. A forge-done opens the gallery; a revise/rollback-done refreshes it in place
// (invalidate the traceability + revisions queries, bump the iframe cache key). Also reads
// ?project=<name> on mount so a past project can be reopened straight into gallery mode.
export function useForgeScreen(): ForgeScreenModel {
  const [jobId, setJobId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<ActiveKind>(null);
  const [galleryName, setGalleryName] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [agent, setAgent] = useState<string | null>(null);
  const stream = useJobStream(jobId);
  const queryClient = useQueryClient();
  const handledDone = useRef<string | null>(null); // jobId whose terminal state we've processed

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('project');
    if (p) {
      setGalleryName(p);
      setReopened(true);
    }
  }, []);

  // Re-attach to an in-flight job after a browser refresh. The forge/revise runs in the server
  // process (not tied to this page), and its SSE stream replays buffered events — so restoring
  // the saved id brings the live progress back instead of the run silently vanishing from view.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_JOB_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { jobId?: string; activeKind?: ActiveKind };
      if (saved.jobId) {
        setJobId(saved.jobId);
        setActiveKind(saved.activeKind ?? 'forge');
      }
    } catch {
      /* ignore malformed */
    }
  }, []);

  // Keep the active id across refreshes only while it's running; drop it once terminal so a
  // stale/finished (or server-restart-gone) job never re-attaches on the next load.
  useEffect(() => {
    try {
      if (jobId && stream.status === 'running') {
        sessionStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId, activeKind }));
      } else {
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }, [jobId, activeKind, stream.status]);

  // React to a job finishing exactly once (guarded by jobId). A forge opens the gallery; a
  // revise/rollback refreshes the already-open gallery.
  useEffect(() => {
    if (stream.status !== 'done' || !jobId || handledDone.current === jobId) return;
    handledDone.current = jobId;
    if (activeKind === 'forge' && stream.doneName) {
      setGalleryName(stream.doneName);
      // Reflect the finished project in the URL (no navigation) so a later refresh reopens its
      // gallery via the ?project mount effect above — the same path as reopening from the list.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('project', stream.doneName);
        window.history.replaceState(null, '', url.toString());
      } catch {
        /* history unavailable */
      }
    } else if (activeKind === 'revise' && galleryName) {
      queryClient.invalidateQueries({ queryKey: ['traceability', galleryName] });
      queryClient.invalidateQueries({ queryKey: ['revisions', galleryName] });
      setRefreshKey((k) => k + 1);
    }
  }, [stream.status, stream.doneName, jobId, activeKind, galleryName, queryClient]);

  return {
    jobId,
    stream,
    activeKind,
    galleryName,
    refreshKey,
    isReopen: reopened,
    agent,
    setAgent,
    startForge: (id) => {
      setActiveKind('forge');
      setJobId(id);
    },
    startRevise: (id) => {
      setActiveKind('revise');
      setJobId(id);
    },
  };
}
