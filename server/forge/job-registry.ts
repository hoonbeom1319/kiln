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
import { reviseStage } from '@/engine/pipeline/stages/revise.js';
import { handoffStage } from '@/engine/pipeline/stages/handoff.js';
import { rollback as rollbackVersion } from '@/engine/pipeline/versions.js';
import { projectName, scaffold, loadProject, nowStamp } from '@/engine/pipeline/project.js';
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

  const job = createJob({ idea, name });

  // Persist the session as soon as the run starts so it shows on the home list while running.
  // Fire-and-forget: a failed write must never break the run (persistSession swallows).
  void persistSession(name, { idea, status: 'running', createdAt: job.createdAt });

  const emit = attachReporter(job);
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

export interface StartReviseInput {
  name: string;
  feedback: string;
  model?: string;
  planner?: string;
}

// Kick off a chat-style revision of an existing project. Runs the SAME reviseStage as the CLI
// (engine/pipeline/stages/revise.js): scope the change, regenerate only the affected artifacts
// coherently, re-pack handoff, stack a new version. Streams via the same seam as forge, so the
// client reuses /api/forge/[id]/stream and the ProgressStream widget unchanged.
export async function startRevise(input: StartReviseInput): Promise<JobRecord> {
  const feedback = input.feedback.trim();
  const ctx = await loadProject(input.name); // throws if the project doesn't exist
  const job = createJob({ idea: feedback, name: input.name });
  const emit = attachReporter(job);
  emit('step', { msg: `개정: ${input.name} — "${feedback}"` });

  reviseStage(ctx, {
    feedback,
    emit,
    model: input.model || 'gemini-flash',
    planner: input.planner || 'gemini-pro',
  })
    .then(async (r: { version: number }) => {
      job.result = { name: input.name, dir: `projects/${input.name}`, prdGate: true, verdict: `v${r.version}`, handoffGate: true };
      job.status = 'done';
      emit('done', { name: input.name, dir: `projects/${input.name}` });
      // Bump the session (status/updatedAt/screenCount). The authoritative chat thread lives in
      // revisions.json (engine-owned); we don't overwrite session.events with just the revise run.
      const screenCount = await countProjectScreens(input.name).catch(() => 0);
      void persistSession(input.name, { status: 'done', screenCount });
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      job.error = msg;
      job.status = 'error';
      emit('error', { msg });
    });

  return job;
}

// Roll a project back to a past version. Restores that version's source artifacts to the working
// tree, re-packs handoff so the gallery reflects it, and stacks the restore as a new head (linear,
// non-destructive). Streams as a job so the UI shows progress and refreshes on done.
export async function startRollback(name: string, target: number): Promise<JobRecord> {
  const ctx = await loadProject(name);
  const job = createJob({ idea: `v${target}로 롤백`, name });
  const emit = attachReporter(job);
  emit('phase', { name: 'Rollback' });
  emit('step', { msg: `버전 v${target}로 되돌리는 중` });

  (async () => {
    const { version } = await rollbackVersion(ctx.dir, target, { at: Date.now() });
    await handoffStage(ctx, { emit });
    emit('revision', { version, note: `v${target}로 롤백`, changed: [`→ v${target}`], feedback: '' });
    emit('done', { name, dir: `projects/${name}` });
    const screenCount = await countProjectScreens(name).catch(() => 0);
    void persistSession(name, { status: 'done', screenCount });
  })().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    job.error = msg;
    job.status = 'error';
    emit('error', { msg });
  });

  return job;
}

// --- shared job plumbing ---

// Create + register a fresh running job.
function createJob({ idea, name }: { idea: string; name: string }): JobRecord {
  const job: JobRecord = {
    id: nextId(),
    idea,
    name,
    status: 'running',
    events: [],
    subscribers: new Set(),
    createdAt: Date.now(),
  };
  store.set(job.id, job);
  return job;
}

// Subscribe the job to a reporter's emit seam: stamp, buffer, fan out to live SSE subscribers.
function attachReporter(job: JobRecord): (type: string, data?: Record<string, unknown>) => void {
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
  return emit;
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
