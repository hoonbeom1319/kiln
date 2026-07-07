'use client';

import { useQuery } from '@tanstack/react-query';
import { sessionsQueryOptions } from '../factory';

// Consumer hook: the home list of past forge sessions.
export function useSessions() {
  return useQuery(sessionsQueryOptions());
}
