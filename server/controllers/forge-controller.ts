// Forge controller — the only entry point the BFF routes call (conventions.md §9).
// Wraps the in-memory job registry; routes never touch the registry directly.

import {
  getJob,
  isTerminal,
  startForge,
  subscribe,
  toSnapshot,
  type StartForgeInput,
} from '@/server/forge/job-registry';
import type { JobSnapshot, KilnEvent } from '@/server/types/job';

export type { JobSnapshot, KilnEvent } from '@/server/types/job';
export type { StartForgeInput } from '@/server/forge/job-registry';

// Start a run, return its snapshot (carrying the id the client streams on).
export async function createForgeJob(input: StartForgeInput): Promise<JobSnapshot> {
  const job = await startForge(input);
  return toSnapshot(job);
}

export function fetchJobSnapshot(id: string): JobSnapshot | null {
  const job = getJob(id);
  return job ? toSnapshot(job) : null;
}

// Atomically capture the buffered events and subscribe to future ones. Because Node runs
// this synchronously with no await between the copy and the subscribe, no event can slip
// through the gap — the SSE route replays `events` then relies on `onEvent` for the rest.
export function openJobStream(
  id: string,
  onEvent: (ev: KilnEvent) => void,
): { events: KilnEvent[]; terminal: boolean; close: () => void } | null {
  const job = getJob(id);
  if (!job) return null;
  const events = [...job.events];
  const terminal = isTerminal(job.status);
  const unsubscribe = subscribe(id, onEvent);
  return { events, terminal, close: unsubscribe };
}
