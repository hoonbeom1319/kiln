import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { fetchRevisions, fetchTraceability, startForge, startRevise, startRollback } from './api';
import type {
  RollbackRequest,
  StartForgeRequest,
  StartForgeResponse,
  StartReviseRequest,
} from './types';

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

// queryOptions for a finished project's PRD↔screen map. NOT staleTime:Infinity — a revision
// rewrites traceability.json, so the screen model invalidates ['traceability', name] on a
// revise-done to force a refetch of the new annotations.
export function traceabilityQueryOptions(name: string) {
  return queryOptions({
    queryKey: ['traceability', name],
    queryFn: () => fetchTraceability(name),
    staleTime: 60_000,
  });
}

// mutationOptions for a chat-style revision. Kicks off a long-running job (streamed), like forge.
export function reviseMutationOptions(): UseMutationOptions<StartForgeResponse, Error, StartReviseRequest> {
  return { mutationKey: ['forge', 'revise'], mutationFn: startRevise };
}

// mutationOptions for a version rollback (also a streamed job).
export function rollbackMutationOptions(): UseMutationOptions<StartForgeResponse, Error, RollbackRequest> {
  return { mutationKey: ['forge', 'rollback'], mutationFn: startRollback };
}

// queryOptions for a project's revision thread. Invalidated on revise/rollback done.
export function revisionsQueryOptions(name: string) {
  return queryOptions({
    queryKey: ['revisions', name],
    queryFn: () => fetchRevisions(name),
    staleTime: 60_000,
  });
}
