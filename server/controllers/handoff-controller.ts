// Handoff controller — the entry point the download route calls (conventions.md §9).
// Zips a finished project's handoff/ folder so the user can grab the whole package in one click
// instead of digging into projects/<name>/handoff/ by hand.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { PROJECTS_ROOT } from '@/engine/pipeline/project.js';
import { makeZip, type ZipEntry } from '@/server/lib/zip';

async function collect(dir: string, base: string, out: ZipEntry[]): Promise<void> {
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const abs = join(dir, item.name);
    if (item.isDirectory()) {
      await collect(abs, base, out);
    } else if (item.isFile()) {
      out.push({ name: relative(base, abs).split(sep).join('/'), data: await readFile(abs) });
    }
  }
}

// Zip projects/<name>/handoff/ for download. Returns null if the project has no handoff yet
// (unfinished run) or the name is unsafe. Entries are nested under "<name>-handoff/" so unzipping
// yields one tidy top-level folder ready to hand to a coding agent.
export async function packHandoffZip(name: string): Promise<Buffer | null> {
  const safe = name.replace(/[/\\]/g, '');
  if (!safe || safe.startsWith('.')) return null;

  const projDir = join(PROJECTS_ROOT, safe);
  const handoffDir = join(projDir, 'handoff');
  try {
    if (!(await stat(handoffDir)).isDirectory()) return null;
  } catch {
    return null;
  }

  const files: ZipEntry[] = [];
  await collect(handoffDir, handoffDir, files);

  // Resilience: pack-handoff copies the sources (screens/PRD/flow/foundation) into handoff/ so the
  // package is self-contained. If that step failed, handoff/ holds only the generated docs — backfill
  // the missing sources from the project root so the download is never a docs-only shell (this is the
  // same failure that used to leave the gallery blank).
  const present = new Set(files.map((f) => f.name));
  const has = (rel: string) => [...present].some((p) => p === rel || p.startsWith(`${rel}/`));
  const backfill = async (rel: string) => {
    if (has(rel)) return;
    const src = join(projDir, rel);
    try {
      const info = await stat(src);
      if (info.isDirectory()) {
        const sub: ZipEntry[] = [];
        await collect(src, src, sub);
        for (const f of sub) files.push({ name: `${rel}/${f.name}`, data: f.data });
      } else if (info.isFile()) {
        files.push({ name: rel, data: await readFile(src) });
      }
    } catch {
      /* source absent — nothing to backfill */
    }
  };
  for (const rel of ['screens', 'foundation', 'PRD.md', '00-flow.md']) await backfill(rel);

  if (!files.length) return null;

  return makeZip(files.map((f) => ({ name: `${safe}-handoff/${f.name}`, data: f.data })));
}
