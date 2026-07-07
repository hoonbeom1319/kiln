// Project controller — the only entry point the BFF route calls for session listing/reopen
// (conventions.md §9). Wraps the session store; routes never touch the store directly.

import { listSessions, readSession } from '@/server/forge/session-store';
import type { SessionMeta, SessionRecord } from '@/server/types/session';

export type { SessionMeta, SessionRecord } from '@/server/types/session';

// Home list: every past project, newest first (lightweight rows, no events).
export async function fetchSessions(): Promise<SessionMeta[]> {
  return listSessions();
}

// A single project's full record (includes events once finished). null if unknown.
export async function fetchSession(name: string): Promise<SessionRecord | null> {
  return readSession(name);
}
