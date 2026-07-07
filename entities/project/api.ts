import type { SessionListResponse, SessionMeta } from './types';

// BFF call for the project entity: the home list of past forge sessions.
export async function fetchSessions(): Promise<SessionMeta[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`세션 목록 불러오기 실패 (${res.status})`);
  const body = (await res.json()) as SessionListResponse;
  return body.sessions ?? [];
}
