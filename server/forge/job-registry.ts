// In-memory job registry. This is where the pipeline's emit seam (pipeline/events.js) is
// subscribed: startForge() creates a reporter whose listener buffers every event and fans
// it out to live SSE subscribers. "실시간 스트리밍" comes for free — the pipeline is
// unchanged; the web layer just listens.
//
// MVP scope (DECISIONS.md ③ 웹 얇게): single-process, in-memory, no auth, no persistence.
// A job is lost on server restart — fine for a local/screen-share demo. Swap this module
// for a queue + store when tenants and durability arrive.

import { createReporter } from '@/engine/pipeline/events.js';
import { forge } from '@/engine/pipeline/forge.js';
import { projectName, scaffold, nowStamp } from '@/engine/pipeline/project.js';
import { writeSession, countProjectScreens } from '@/server/forge/session-store';
import type { ForgeResult, JobSnapshot, JobStatus, KilnEvent } from '@/server/types/job';

type Subscriber = (ev: KilnEvent) => void;

interface JobRecord {
  id: string;
  idea: string;
  name: string;
  status: JobStatus;
  events: KilnEvent[];
  subscribers: Set<Subscriber>;
  result?: ForgeResult;
  error?: string;
  createdAt: number;
}

// Persist the store across dev HMR / route-module boundaries so a job started by the POST
// handler is visible to the SSE GET handler in the same process.
const store: Map<string, JobRecord> =
  (globalThis as any).__kilnJobs ?? ((globalThis as any).__kilnJobs = new Map());

let counter: number = (globalThis as any).__kilnJobSeq ?? 0;
function nextId(): string {
  counter += 1;
  (globalThis as any).__kilnJobSeq = counter;
  return `job-${nowStamp()}-${counter}`;
}

export interface StartForgeInput {
  idea: string;
  name?: string;
  model?: string;
  judge?: string;
}

// Kick off a forge run in the background and return the job id immediately. The pipeline
// runs for minutes; callers stream progress via subscribe()/snapshot().
export async function startForge(input: StartForgeInput): Promise<JobRecord> {
  const idea = input.idea.trim();
  const name = projectName(idea, input.name, nowStamp());
  const ctx = await scaffold({ name, idea });

  const id = nextId();
  const job: JobRecord = {
    id,
    idea,
    name,
    status: 'running',
    events: [],
    subscribers: new Set(),
    createdAt: Date.now(),
  };
  store.set(id, job);

  // Persist the session as soon as the run starts so it shows on the home list while running.
  // Fire-and-forget: a failed write must never break the run (persistText helper swallows).
  void persistSession(name, { idea, status: 'running', createdAt: job.createdAt });

  // Subscribe to the emit seam: stamp, buffer, fan out.
  const { emit } = createReporter((raw: KilnEvent) => {
    const ev: KilnEvent = { ...raw, t: Date.now() };
    job.events.push(ev);
    for (const fn of job.subscribers) {
      try {
        fn(ev);
      } catch {
        /* a dead subscriber must never break the run */
      }
    }
  });

  emit('step', { msg: `프로젝트: ${name} — "${idea}"` });

  // Fire and forget. The engine reports progress through emit; we only translate the
  // terminal outcome into a final done/error event the stream can close on.
  forge(ctx, { emit, model: input.model || 'gemini-flash', judge: input.judge || 'gemini-pro' })
    .then(async (result: ForgeResult) => {
      job.result = result;
      job.status = 'done';
      emit('done', { name, dir: `projects/${name}` });
      // Persist the finished session, carrying the full event log for the future revise
      // engine and the built screen count for the list row.
      const screenCount = await countProjectScreens(name).catch(() => 0);
      void persistSession(name, { status: 'done', screenCount, events: job.events });
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      job.error = msg;
      job.status = 'error';
      emit('error', { msg });
      void persistSession(name, { status: 'error', events: job.events });
    });

  return job;
}

// Persist without ever throwing into the run. Session persistence is best-effort — the
// forge itself already wrote its artifacts to disk.
async function persistSession(
  name: string,
  patch: Parameters<typeof writeSession>[1],
): Promise<void> {
  try {
    await writeSession(name, patch);
  } catch {
    /* a failed session write must not affect the run or its stream */
  }
}

export function getJob(id: string): JobRecord | undefined {
  return store.get(id);
}

// Serializable view (drops the live subscriber set).
export function toSnapshot(job: JobRecord): JobSnapshot {
  return {
    id: job.id,
    idea: job.idea,
    name: job.name,
    status: job.status,
    events: job.events,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
  };
}

// Subscribe to future events. Returns an unsubscribe fn. Buffered (past) events are NOT
// replayed here — the caller replays job.events first, then subscribes, so nothing is
// missed and nothing is doubled.
export function subscribe(id: string, fn: Subscriber): () => void {
  const job = store.get(id);
  if (!job) return () => {};
  job.subscribers.add(fn);
  return () => job.subscribers.delete(fn);
}

export function isTerminal(status: JobStatus): boolean {
  return status === 'done' || status === 'error';
}
