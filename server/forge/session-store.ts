// Session store — persists each forge run to projects/<name>/session.json so the web layer
// can list past projects and reopen them. In-repo filesystem, single process; swap for a
// tenant-scoped object store when the SaaS multi-tenant story lands (DECISIONS.md).
//
// The job registry writes here on start (running) / done / error. Reads synthesize a record
// for older projects (lunchvote·runcrew·proj-*) that predate session.json: idea from
// idea.txt, status from whether handoff/index.html exists, timestamps from the dir's stat,
// screenCount from the built screens.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTS_ROOT } from '@/engine/pipeline/project.js';
import type { SessionMeta, SessionRecord } from '@/server/types/session';

function sessionPath(name: string): string {
  return join(PROJECTS_ROOT, name, 'session.json');
}

// Merge a patch into projects/<name>/session.json. Preserves createdAt across writes and
// always stamps updatedAt. The registry calls this at each lifecycle transition.
export async function writeSession(
  name: string,
  patch: Partial<SessionRecord>,
): Promise<void> {
  const existing = (await readSession(name)) ?? null;
  const now = Date.now();
  const record: SessionRecord = {
    name,
    idea: patch.idea ?? existing?.idea ?? '',
    status: patch.status ?? existing?.status ?? 'running',
    createdAt: existing?.createdAt ?? patch.createdAt ?? now,
    updatedAt: now,
    screenCount: patch.screenCount ?? existing?.screenCount ?? 0,
    ...(patch.events ?? existing?.events ? { events: patch.events ?? existing?.events } : {}),
  };
  await writeFile(sessionPath(name), `${JSON.stringify(record, null, 2)}\n`);
}

// Read projects/<name>/session.json. Returns null if the file is absent or unparseable —
// callers synthesize (listSessions) or treat as missing.
export async function readSession(name: string): Promise<SessionRecord | null> {
  const p = sessionPath(name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(await readFile(p, 'utf8')) as SessionRecord;
  } catch {
    return null;
  }
}

// Count built hi-fi screens (.html) for a project. Prefer the packaged handoff/screens; fall
// back to the working screens/ dir for runs that never reached handoff.
async function countScreens(dir: string): Promise<number> {
  for (const sub of ['handoff/screens', 'screens']) {
    const abs = join(dir, sub);
    if (!existsSync(abs)) continue;
    try {
      const files = await readdir(abs);
      const html = files.filter((f) => f.toLowerCase().endsWith('.html'));
      if (html.length) return html.length;
    } catch {
      /* unreadable dir — treat as none */
    }
  }
  return 0;
}

// Count a project's built screens by name (used by the registry when a run finishes).
export async function countProjectScreens(name: string): Promise<number> {
  return countScreens(join(PROJECTS_ROOT, name));
}

// Reconstruct a SessionMeta for a project that has no session.json (forged before this store
// existed). Best-effort: idea from idea.txt, done iff handoff/index.html was packaged,
// timestamps from the directory's stat.
async function synthesize(name: string, dir: string): Promise<SessionMeta> {
  const ideaPath = join(dir, 'idea.txt');
  const idea = existsSync(ideaPath) ? (await readFile(ideaPath, 'utf8')).trim() : '';
  const done = existsSync(join(dir, 'handoff', 'index.html'));
  const info = await stat(dir);
  return {
    name,
    idea,
    status: done ? 'done' : 'error',
    createdAt: info.birthtimeMs || info.mtimeMs,
    updatedAt: info.mtimeMs,
    screenCount: await countScreens(dir),
  };
}

// List every project under projects/ as a lightweight row, newest first. Reads session.json
// where present, synthesizes where not. Never includes events (list stays cheap).
export async function listSessions(): Promise<SessionMeta[]> {
  if (!existsSync(PROJECTS_ROOT)) return [];
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const rows = await Promise.all(
    dirs.map(async (e): Promise<SessionMeta | null> => {
      const dir = join(PROJECTS_ROOT, e.name);
      // Only real project dirs (must carry an idea or a session record).
      if (!existsSync(join(dir, 'idea.txt')) && !existsSync(sessionPath(e.name))) return null;
      const saved = await readSession(e.name);
      if (saved) {
        const { events: _events, ...meta } = saved;
        return meta;
      }
      return synthesize(e.name, dir);
    }),
  );

  return rows
    .filter((r): r is SessionMeta => r !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
