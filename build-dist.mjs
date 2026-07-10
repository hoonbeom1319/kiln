// Assemble the standalone dist after `next build` (output: 'standalone').
// Next traces a self-contained server into .next/standalone but does NOT copy the client assets
// or public/ next to it — we do that here — and it pulls in the repo's projects/ (dev data) which
// we drop, re-seeding only the committed example-*/ showcase projects (the launcher copies those
// into the user's own projects/ on first run). Run via `npm run dist` (prepack), so
// `npm publish`/`npm pack` always ship a correct tree.
import { cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const standalone = join(root, '.next', 'standalone');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('[build-dist] .next/standalone/server.js 없음 — 먼저 `next build`(output: standalone)를 실행하세요.');
  process.exit(1);
}

// 1) client assets — standalone omits .next/static, but server.js serves /_next/static from there.
cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });

// 2) public/ if it ever exists (none today; future-proof).
const pub = join(root, 'public');
if (existsSync(pub)) cpSync(pub, join(standalone, 'public'), { recursive: true });

// 3) reset the bundle's projects/ to exactly the committed example-*/ showcase demos.
//    File-tracing drags the whole repo projects/ (real dev runs) in — drop all of it, then copy
//    back only example-*/. These are the seed source the launcher (bin/kiln.js) copies into the
//    user's own projects/ on first run; user data itself lives in their cwd, never in the package.
const bundleProjects = join(standalone, 'projects');
rmSync(bundleProjects, { recursive: true, force: true });

const repoProjects = join(root, 'projects');
const examples = existsSync(repoProjects)
  ? readdirSync(repoProjects, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith('example-'))
  : [];
for (const e of examples) {
  cpSync(join(repoProjects, e.name), join(bundleProjects, e.name), { recursive: true });
}

console.log(`[build-dist] standalone 조립 완료 — static 복사 · projects → example-* ${examples.length}종(${examples.map((e) => e.name).join(', ') || '없음'}).`);
