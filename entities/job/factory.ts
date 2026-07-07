import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { fetchTraceability, startForge } from './api';
import type { StartForgeRequest, StartForgeResponse } from './types';

// mutationOptions factory (conventions.md §7). Starting a run is a mutation — it kicks off a
// long-running server job. Progress is not a query; it streams via useJobStream.
export function startForgeMutationOptions(): UseMutationOptions<
  StartForgeResponse,
  Error,
  StartForgeRequest
> {
  return {
    mutationKey: ['forge', 'start'],
    mutationFn: startForge,
  };
}

// queryOptions for a finished project's PRD↔screen map. Immutable once forged, so cache it
// hard (no refetch churn while the gallery is open).
export function traceabilityQueryOptions(name: string) {
  return queryOptions({
    queryKey: ['traceability', name],
    queryFn: () => fetchTraceability(name),
    staleTime: Infinity,
  });
}
