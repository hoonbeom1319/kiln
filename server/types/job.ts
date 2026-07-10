// Wire types for a forge run. These mirror the event vocabulary documented in
// pipeline/events.js — the pipeline emits these, the registry buffers them, and the SSE
// route streams them verbatim. The client entity (entities/job) re-declares the same shape
// as its own contract so it never imports server code into the browser bundle.

export type JobStatus = 'running' | 'done' | 'error';

export interface KilnEventBase {
  seq: number;
  t: number; // epoch ms, stamped by the registry when the event is buffered
}

export type KilnEvent =
  | (KilnEventBase & { type: 'phase'; name: string })
  | (KilnEventBase & { type: 'step'; msg: string })
  | (KilnEventBase & {
      type: 'model';
      stage: string;
      model: string;
      usage?: { output?: number };
      attempts?: number;
    })
  | (KilnEventBase & { type: 'gate'; name: string; ok: boolean; summary?: string })
  | (KilnEventBase & { type: 'turn'; text: string })
  | (KilnEventBase & { type: 'tool-call'; tool: string; summary?: string; ok?: boolean; detail?: string })
  | (KilnEventBase & { type: 'artifact'; path: string; kind?: string })
  | (KilnEventBase & { type: 'warn'; msg: string })
  | (KilnEventBase & {
      type: 'revision';
      version: number;
      note: string;
      changed: string[];
      feedback: string;
    })
  | (KilnEventBase & { type: 'done'; name?: string; dir?: string })
  | (KilnEventBase & { type: 'error'; msg: string });

// The value forge() resolves to (pipeline/forge.js).
export interface ForgeResult {
  name: string;
  dir: string;
  prdGate: boolean;
  verdict?: string;
  handoffGate: boolean;
}

// Serializable snapshot of a job — what the BFF returns and streams (minus live subscribers).
export interface JobSnapshot {
  id: string;
  idea: string;
  name: string;
  status: JobStatus;
  events: KilnEvent[];
  result?: ForgeResult;
  error?: string;
  createdAt: number;
}
