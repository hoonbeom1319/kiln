import { queryOptions } from '@tanstack/react-query';
import { fetchSessions } from './api';

// queryOptions for the home session list (conventions.md §7). Short staleTime so returning to
// the home screen after a run reflects the newly finished project without a hard reload.
export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    staleTime: 10_000,
  });
}
