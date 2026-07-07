// Forge controller — the only entry point the BFF routes call (conventions.md §9).
// Wraps the in-memory job registry; routes never touch the registry directly.

import {
  getJob,
  isTerminal,
  startForge,
  startRevise,
  startRollback,
  subscribe,
  toSnapshot,
  type StartForgeInput,
  type StartReviseInput,
} from '@/server/forge/job-registry';
import type { JobSnapshot, KilnEvent } from '@/server/types/job';

export type { JobSnapshot, KilnEvent } from '@/server/types/job';
export type { StartForgeInput, StartReviseInput } from '@/server/forge/job-registry';

// Start a run, return its snapshot (carrying the id the client streams on).
export async function createForgeJob(input: StartForgeInput): Promise<JobSnapshot> {
  const job = await startForge(input);
  return toSnapshot(job);
}

// Start a chat-style revision of an existing project; streams on the same job stream as forge.
export async function createReviseJob(input: StartReviseInput): Promise<JobSnapshot> {
  const job = await startRevise(input);
  return toSnapshot(job);
}

// Roll a project back to a past version; also runs as a streamed job.
export async function createRollbackJob(name: string, target: number): Promise<JobSnapshot> {
  const job = await startRollback(name, target);
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
