import { queryOptions } from '@tanstack/react-query';
import { fetchAgents } from './api';

// Detected agents change only when the user installs/removes a CLI — cache generously; a manual
// refetch isn't worth the churn during a session.
export function agentsQueryOptions() {
  return queryOptions({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    staleTime: 5 * 60_000,
  });
}
