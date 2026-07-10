#!/usr/bin/env node
// @hb-kit/kiln launcher — starts the Kiln web workshop locally.
//
//   npx @hb-kit/kiln [--port 4173] [--no-open]
//
// Default port is 4173 (5000 collides with macOS AirPlay Receiver, which 403s). If the chosen
// port is busy it rolls forward (4174, 4175, …) to the first free one.
//
// Results (idea → PRD → design → handoff) are written to ./projects under the directory you run
// this in, so run it wherever you want the output. Generation runs on YOUR local agent CLI
// (claude / codex) — operator cost 0. The web server itself runs from the installed package dir
// (that's where .next + the gate scripts live); KILN_PROJECTS_ROOT bridges the two so your data
// lands in your cwd, not inside the package.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, cpSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverJs = join(pkgDir, '.next', 'standalone', 'server.js');
// Showcase demos bundled in the package (build-dist.mjs seeds these). Copied into the user's
// own projects/ on first run so a fresh install opens with a worked example to look at.
const bundledProjects = join(pkgDir, '.next', 'standalone', 'projects');

function parseArgs(argv) {
  const a = { port: process.env.PORT || process.env.KILN_PORT || '4173', open: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--port' || x === '-p') a.port = argv[++i];
    else if (x === '--no-open') a.open = false;
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`kiln — 아이디어 한 줄을 브라우저에서 구워 개발 인계 패키지로.

사용법:  kiln [옵션]
  --port, -p <n>   포트 (기본 4173, 사용 중이면 다음 빈 포트로 자동 이동)
  --no-open        브라우저 자동 열기 끄기
  --help, -h       이 도움말

· 결과물은 실행한 디렉터리의 ./projects 에 쌓입니다.
· 생성은 로컬 에이전트(claude / codex)로 돌아갑니다 — 미설치 시 화면에서 안내.`);
  process.exit(0);
}

if (!existsSync(serverJs)) {
  console.error('[kiln] 빌드 산출물(.next/standalone)을 찾을 수 없습니다. 패키지가 손상되었을 수 있어요 — 재설치해 보세요.');
  process.exit(1);
}

const userCwd = process.cwd();
const projectsRoot = join(userCwd, 'projects');
const host = process.env.HOSTNAME || '127.0.0.1';

seedExamples(projectsRoot);

// Can we bind this port on `host`? Resolves true if free, false if taken (EADDRINUSE etc.).
// Used to skip a busy port before handing off to the Next server — most notably macOS's AirPlay
// Receiver squatting on 5000, but any collision rolls forward the same way.
function portFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}

// First free port at or after `start` (bounded scan). Returns null if the whole window is busy.
async function pickPort(start, tries = 20) {
  for (let p = start; p < start + tries; p++) {
    if (await portFree(p)) return p;
  }
  return null;
}

const requested = Number.parseInt(args.port, 10) || 4173;
const port = await pickPort(requested);
if (port === null) {
  console.error(`[kiln] ${requested}–${requested + 19} 사이에 빈 포트가 없습니다. --port로 다른 포트를 지정해 주세요.`);
  process.exit(1);
}
if (port !== requested) {
  console.log(`\n  ⚠ 포트 ${requested}이(가) 사용 중 — ${port}로 넘어갑니다.`);
}
const url = `http://localhost:${port}`;

// On a fresh workspace (no ./projects yet, or an empty one), copy the bundled example-*/ demos in
// so the user opens straight into a worked example. Never touches a projects/ that already has
// content — we don't clobber or duplicate onto real runs.
function seedExamples(dest) {
  if (!existsSync(bundledProjects)) return;
  if (existsSync(dest) && readdirSync(dest).length > 0) return;
  const demos = readdirSync(bundledProjects, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && e.name.startsWith('example-'),
  );
  if (!demos.length) return;
  try {
    mkdirSync(dest, { recursive: true });
    for (const d of demos) cpSync(join(bundledProjects, d.name), join(dest, d.name), { recursive: true });
    console.log(`     예시 ${demos.length}종 준비: ${demos.map((d) => d.name).join(', ')}`);
  } catch {
    /* best-effort seeding — a failure here shouldn't block the server from starting */
  }
}

// Run the standalone server from the package dir (so it finds .next + scripts/), but point the
// engine + gates + artifact routes at the user's own projects/ via env.
const env = {
  ...process.env,
  KILN_PROJECTS_ROOT: projectsRoot,
  PORT: String(port),
  HOSTNAME: host,
  NODE_ENV: 'production',
};

console.log(`\n  🔥 Kiln — ${url}`);
console.log(`     결과물: ${projectsRoot}`);
console.log(`     종료: Ctrl+C\n`);

const child = spawn(process.execPath, [serverJs], { cwd: pkgDir, env, stdio: 'inherit' });

if (args.open) {
  // Give the server a moment to bind before opening the browser.
  setTimeout(() => {
    if (!child.killed) openBrowser(url);
  }, 1200);
}

function openBrowser(target) {
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const cmdArgs = platform === 'win32' ? ['/c', 'start', '', target] : [target];
  try {
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* best-effort: the URL is printed above */
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code) => process.exit(code ?? 0));
