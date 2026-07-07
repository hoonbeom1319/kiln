'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobStream, type JobStream } from '@/entities/job';

type ActiveKind = 'forge' | 'revise' | null;

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

  // React to a job finishing exactly once (guarded by jobId). A forge opens the gallery; a
  // revise/rollback refreshes the already-open gallery.
  useEffect(() => {
    if (stream.status !== 'done' || !jobId || handledDone.current === jobId) return;
    handledDone.current = jobId;
    if (activeKind === 'forge' && stream.doneName) {
      setGalleryName(stream.doneName);
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
