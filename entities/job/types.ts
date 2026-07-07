// Client-side contract for a forge run. Mirrors the wire shape emitted by pipeline/events.js
// (and typed in server/types/job.ts). Re-declared here so the browser bundle never imports
// server code. Keep in sync with the emit vocabulary.

export type JobStatus = 'running' | 'done' | 'error';

interface KilnEventBase {
  seq: number;
  t: number;
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

export type KilnEventType = KilnEvent['type'];

// Response of POST /api/forge.
export interface StartForgeResponse {
  id: string;
  name: string;
  status: JobStatus;
}

export interface StartForgeRequest {
  idea: string;
  name?: string;
  model?: string;
  judge?: string;
}

// PRD ↔ screen traceability (projects/<name>/traceability.json). One short line per screen
// saying which PRD requirement it reflects — shown beside each screen in the gallery.
export interface TraceScreen {
  file: string;
  title?: string;
  reflects: string;
}

export interface Traceability {
  screens: TraceScreen[];
}

// Chat-style revision thread (projects/<name>/revisions.json). Entry v1 is the forged baseline;
// each revise/rollback appends a new version. This is what the revise thread widget renders.
export type RevisionKind = 'forge' | 'revise' | 'rollback';

export interface RevisionEntry {
  version: number;
  kind: RevisionKind;
  at: number | null;
  feedback?: string; // the user's request (revise entries)
  note?: string; // the assistant's plan explanation
  changed?: string[]; // artifacts touched
  from?: number; // source version (rollback entries)
}

export interface RevisionLog {
  head: number;
  entries: RevisionEntry[];
}

// POST /api/forge/revise
export interface StartReviseRequest {
  name: string;
  feedback: string;
  model?: string;
  planner?: string;
}

// POST /api/forge/rollback
export interface RollbackRequest {
  name: string;
  version: number;
}
