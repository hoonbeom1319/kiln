import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Version stacking for the chat-style revise engine. Each version is a FULL immutable snapshot
// of a project's source artifacts under projects/<name>/versions/v<N>/. The working tree (the
// project's top-level files) is always the current head; a version dir is what head looked like
// at that number. Full snapshots (not diffs) make compare and rollback trivial and keep the
// scheme legible for a local/MVP scope — disk is cheap, clarity wins (DECISIONS.md).
//
// revisions.json is the chat thread + head pointer:
//   { head: N, entries: [ {version, kind, at, feedback?, note?, plan?, changed?} ] }
// entry v1 is the forged baseline (kind 'forge', no feedback); each revise appends v(N+1).

// Source artifacts that define a version. Handoff/ is DERIVED (re-packed from these) so it is
// not snapshotted — rollback re-runs the handoff stage to rebuild it.
const SNAPSHOT_ITEMS = [
  'idea.txt',
  'PRD.md',
  '00-flow.md',
  'foundation',
  'screens',
  'traceability.json',
  'design-verify.md',
  'STATUS.md',
];

function logPath(dir) {
  return join(dir, 'revisions.json');
}
function versionDir(dir, version) {
  return join(dir, 'versions', `v${version}`);
}

// Read the revision log, or synthesize the baseline for a project forged before versioning
// existed (head 1 = the current working tree, one 'forge' entry).
export async function readLog(dir) {
  const p = logPath(dir);
  if (existsSync(p)) {
    try {
      return JSON.parse(await readFile(p, 'utf8'));
    } catch {
      /* corrupt — fall through to a fresh baseline */
    }
  }
  return { head: 1, entries: [{ version: 1, kind: 'forge', at: null, note: '초기 생성(forge)' }] };
}

export async function writeLog(dir, log) {
  await writeFile(logPath(dir), `${JSON.stringify(log, null, 2)}\n`);
}

// Copy the current working-tree artifacts into versions/v<version>/ (overwriting if present).
async function snapshot(dir, version) {
  const dest = versionDir(dir, version);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const item of SNAPSHOT_ITEMS) {
    const src = join(dir, item);
    if (existsSync(src)) await cp(src, join(dest, item), { recursive: true });
  }
}

// Ensure the pre-revision baseline (v1) is archived before we mutate the working tree, so the
// forged original is always recoverable. Idempotent — only snapshots if v1 is missing.
export async function ensureBaseline(dir) {
  if (!existsSync(versionDir(dir, 1))) await snapshot(dir, 1);
}

// After a revision has been applied to the working tree, archive the new state as the next
// version and append its entry. Returns the updated log.
export async function commitRevision(dir, { feedback, plan, note, changed, at }) {
  const log = await readLog(dir);
  const version = log.head + 1;
  await snapshot(dir, version);
  log.entries.push({ version, kind: 'revise', at: at ?? null, feedback, note, plan, changed });
  log.head = version;
  await writeLog(dir, log);
  return { log, version };
}

// Restore a past version's artifacts to the working tree and record it as a new head (linear,
// non-destructive history). The caller re-packs handoff/ afterward so the gallery reflects it.
export async function rollback(dir, target, { at } = {}) {
  const src = versionDir(dir, target);
  if (!existsSync(src)) throw new Error(`버전 없음: v${target}`);
  const log = await readLog(dir);
  await ensureBaseline(dir); // never lose the pre-rollback baseline
  for (const item of SNAPSHOT_ITEMS) {
    const from = join(src, item);
    const to = join(dir, item);
    if (existsSync(to)) await rm(to, { recursive: true, force: true });
    if (existsSync(from)) await cp(from, to, { recursive: true });
  }
  const version = log.head + 1;
  await snapshot(dir, version);
  log.entries.push({ version, kind: 'rollback', at: at ?? null, from: target, note: `v${target}로 롤백` });
  log.head = version;
  await writeLog(dir, log);
  return { log, version };
}

// The conversational history the revise planner sees: prior entries as compact turns.
export function historyText(log) {
  const turns = (log.entries || [])
    .filter((e) => e.kind === 'revise' && (e.feedback || e.note))
    .map((e) => `- (v${e.version}) 요청: ${e.feedback || '—'}${e.note ? ` · 처리: ${e.note}` : ''}`);
  return turns.length ? turns.join('\n') : '(이전 수정 없음 — 첫 수정)';
}
