// Wire types for a persisted forge project session (projects/<name>/session.json).
// The web layer needs to remember past runs: list them on the home screen and reopen a
// finished project's gallery without a live job. This is distinct from the Claude Code
// terminal session (that's the developer's conversation) — this is the *product's* memory of
// what an end user forged.
//
// SessionMeta is the lightweight list row (no events — never shipped in a list response).
// SessionRecord is the full on-disk record; `events` is only present once a run finishes and
// exists for the future chat-style revise engine (history/context), not for the list.

import type { JobStatus, KilnEvent } from './job';

export interface SessionMeta {
  name: string;
  idea: string;
  status: JobStatus;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  screenCount: number;
}

export interface SessionRecord extends SessionMeta {
  events?: KilnEvent[];
}
