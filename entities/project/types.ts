// Client-side contract for a persisted forge session. Mirrors server/types/session.ts,
// re-declared here so the browser bundle never imports server code (same pattern as
// entities/job). The list never carries events — those stay server-side for the revise engine.

export type SessionStatus = 'running' | 'done' | 'error';

export interface SessionMeta {
  name: string;
  idea: string;
  status: SessionStatus;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  screenCount: number;
}

// Response of GET /api/projects.
export interface SessionListResponse {
  sessions: SessionMeta[];
}
