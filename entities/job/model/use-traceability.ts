'use client';

import { useQuery } from '@tanstack/react-query';
import { traceabilityQueryOptions } from '../factory';

// Fetch a finished project's PRD↔screen map. Pass null before a run finishes to stay idle.
export function useTraceability(name: string | null) {
  return useQuery({
    ...traceabilityQueryOptions(name ?? ''),
    enabled: Boolean(name),
  });
}
