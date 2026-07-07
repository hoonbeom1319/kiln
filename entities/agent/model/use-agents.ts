'use client';

import { useQuery } from '@tanstack/react-query';
import { agentsQueryOptions } from '../factory';

// Detected local agents (installed CLIs) for the picker.
export function useAgents() {
  return useQuery(agentsQueryOptions());
}
