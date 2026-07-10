import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Where projects are read/written. Defaults to ./projects under the process cwd (dev + the bin
// CLIs run from the repo). When Kiln is installed and launched as a package, the web server runs
// with cwd = the package dir, so the launcher sets KILN_PROJECTS_ROOT to the user's own directory —
// decoupling "where the app code lives" from "where the user's data goes".
export const PROJECTS_ROOT = process.env.KILN_PROJECTS_ROOT
  ? resolve(process.env.KILN_PROJECTS_ROOT)
  : resolve(process.cwd(), 'projects');

// Derive a filesystem-safe slug. ASCII words from the idea if any; otherwise (e.g. a
// Korean idea) fall back to a timestamped name so runs never collide. A caller-provided
// name always wins.
export function projectName(idea, explicit, stamp) {
  if (explicit) return sanitize(explicit);
  const ascii = String(idea).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (ascii.length >= 3) return ascii.slice(0, 40);
  return `proj-${stamp || nowStamp()}`;
}

function sanitize(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';
}

export function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Create projects/<name>/ and seed STATUS.md + the source idea. Returns the run context
// that every stage receives.
export async function scaffold({ name, idea }) {
  const dir = join(PROJECTS_ROOT, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'idea.txt'), `${idea}\n`);
  if (!existsSync(join(dir, 'STATUS.md'))) {
    await writeFile(join(dir, 'STATUS.md'), statusSeed(name, idea));
  }
  return { name, dir, idea };
}

function statusSeed(name, idea) {
  return `# ${name} — STATUS

아이디어: ${idea}

## 단계
- [ ] 1. 기획 (PRD)
- [ ] 2. 디자인 (tokens + hi-fi)
- [ ] 3. handoff

현재 단계: 기획 대기
`;
}

// Reconstruct the run context for an existing project (manual mode entrypoints).
export async function loadProject(name) {
  const dir = join(PROJECTS_ROOT, name);
  if (!existsSync(dir)) throw new Error(`프로젝트 없음: projects/${name} (먼저 plan/forge로 생성)`);
  const idea = existsSync(join(dir, 'idea.txt')) ? (await readFile(join(dir, 'idea.txt'), 'utf8')).trim() : '';
  return { name, dir, idea };
}

// Append a note line to STATUS.md (used by stages to record what ran).
export async function noteStatus(dir, line) {
  const p = join(dir, 'STATUS.md');
  const cur = existsSync(p) ? await readFile(p, 'utf8') : '';
  await writeFile(p, `${cur.trimEnd()}\n- ${line}\n`);
}
