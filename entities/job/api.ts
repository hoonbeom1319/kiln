import type {
  RevisionLog,
  RollbackRequest,
  StartForgeRequest,
  StartForgeResponse,
  StartReviseRequest,
  Traceability,
} from './types';

// BFF calls for the job entity. The SSE stream is consumed via EventSource in
// model/use-job-stream.ts, not here (fetch can't model a long-lived event stream cleanly).

export async function startForge(req: StartForgeRequest): Promise<StartForgeResponse> {
  const res = await fetch('/api/forge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `forge 시작 실패 (${res.status})`);
  }
  return res.json();
}

// URL of the SSE endpoint for a job (consumed by useJobStream).
export function jobStreamUrl(id: string): string {
  return `/api/forge/${encodeURIComponent(id)}/stream`;
}

// URL of a generated artifact under projects/ (gallery iframes, handoff links).
export function artifactUrl(relPath: string): string {
  return `/api/projects/${relPath.split('/').map(encodeURIComponent).join('/')}`;
}

// URL to download a finished project's whole handoff/ folder as a zip.
export function handoffZipUrl(name: string): string {
  return `/api/handoff/${encodeURIComponent(name)}`;
}

// Fetch the PRD ↔ screen map for a finished project. Returns null if absent (older projects
// forged before traceability existed) so the gallery can fall back gracefully.
export async function fetchTraceability(name: string): Promise<Traceability | null> {
  const res = await fetch(artifactUrl(`${name}/traceability.json`));
  if (!res.ok) return null;
  try {
    return (await res.json()) as Traceability;
  } catch {
    return null;
  }
}

// Start a chat-style revision. Returns the job id to stream (same stream as forge).
export async function startRevise(req: StartReviseRequest): Promise<StartForgeResponse> {
  const res = await fetch('/api/forge/revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `개정 시작 실패 (${res.status})`);
  }
  return res.json();
}

// Roll a project back to a past version. Returns the job id to stream.
export async function startRollback(req: RollbackRequest): Promise<StartForgeResponse> {
  const res = await fetch('/api/forge/rollback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `롤백 실패 (${res.status})`);
  }
  return res.json();
}

// Fetch a project's revision thread (revisions.json). Returns null if absent (never revised).
export async function fetchRevisions(name: string): Promise<RevisionLog | null> {
  const res = await fetch(artifactUrl(`${name}/revisions.json`));
  if (!res.ok) return null;
  try {
    return (await res.json()) as RevisionLog;
  } catch {
    return null;
  }
}
