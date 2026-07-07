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
