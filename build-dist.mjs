// Assemble the standalone dist after `next build` (output: 'standalone').
// Next traces a self-contained server into .next/standalone but does NOT copy the client assets
// or public/ next to it — we do that here — and it pulls in the repo's projects/ (dev data) which
// we drop. Run via `npm run dist` (prepack), so `npm publish`/`npm pack` always ship a correct tree.
import { cpSync, rmSync, existsSync } from 'node:fs';
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

// 3) drop dev data that file-tracing copied into the bundle (user data lives in their cwd at runtime).
rmSync(join(standalone, 'projects'), { recursive: true, force: true });

console.log('[build-dist] standalone 조립 완료 — static 복사 · projects 제거.');
