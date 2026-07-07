'use client';

import { useEffect, useState } from 'react';
import { useJobStream, type JobStream } from '@/entities/job';

export interface ForgeScreenModel {
  jobId: string | null;
  start: (jobId: string) => void;
  stream: JobStream;
  // A finished project opened directly via ?project=<name> (down payment on session reopen).
  reopened: string | null;
}

// Screen model (conventions.md §2.1 model/): owns the active job id and subscribes to its
// stream. Also reads ?project=<name> on mount so a past run's gallery can be reopened
// without a live job.
export function useForgeScreen(): ForgeScreenModel {
  const [jobId, setJobId] = useState<string | null>(null);
  const [reopened, setReopened] = useState<string | null>(null);
  const stream = useJobStream(jobId);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('project');
    if (p) setReopened(p);
  }, []);

  return { jobId, start: setJobId, stream, reopened };
}
