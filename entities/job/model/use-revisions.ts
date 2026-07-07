'use client';

import { useQuery } from '@tanstack/react-query';
import { revisionsQueryOptions } from '../factory';

// Fetch a project's revision thread (chat history + versions). Pass null to stay idle.
export function useRevisions(name: string | null) {
  return useQuery({
    ...revisionsQueryOptions(name ?? ''),
    enabled: Boolean(name),
  });
}
