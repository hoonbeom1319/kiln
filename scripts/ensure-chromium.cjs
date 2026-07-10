// Bootstrap the render gate's browser — "첫 렌더 자동 다운로드"(kiln C2 착수 ②).
//
// The shoot gate renders with a headless Chromium. Bundling the ~150MB binary per platform would
// balloon the package, and reusing the system Edge/Chrome gives version-drift → pixel drift (fatal
// for a pixel gate). So we download ONE pinned Chromium on the first render that needs it and reuse
// it forever after (playwright's default per-user cache — ~/.cache/ms-playwright or
// %LOCALAPPDATA%\ms-playwright — survives across runs). The trigger lives HERE, at the render seam,
// not in the launcher: both consumers (the engine's shoot gate and the agentic builder's own
// `node scripts/shoot.cjs` tool call) go through shoot.cjs, so one call site covers both, exactly
// at "첫 렌더 필요 시점".
//
// Idempotent + graceful: if Chromium is already present it does nothing; if the download fails (or
// playwright isn't installed at all) it returns 'skipped' and shoot degrades to its advisory skip.
const fs = require('fs');
const { spawnSync } = require('child_process');

// Load the chromium handle from whichever playwright package is present (same order as shoot.cjs).
function loadChromium() {
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      return require(pkg).chromium;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

// 'ready' — binary already installed · 'installed' — downloaded just now · 'skipped' — unavailable.
function ensureChromium() {
  const chromium = loadChromium();
  if (!chromium) return 'skipped'; // playwright not installed — shoot's own guard will skip too

  // executablePath() returns where the pinned browser SHOULD live; if that file exists we're set.
  let exe = null;
  try {
    exe = chromium.executablePath();
  } catch {
    exe = null; // some versions throw when the browser isn't downloaded yet
  }
  if (exe && fs.existsSync(exe)) return 'ready';

  // First render on this machine — download Chromium once. Use the playwright CLI with the SAME
  // node that's running us, so it works in the packaged app where a bare `npx playwright` may not
  // resolve. `install --with-deps` is Linux-only sugar; plain `install chromium` is cross-platform.
  let cli = null;
  for (const spec of ['playwright/cli.js', 'playwright-core/cli.js']) {
    try {
      cli = require.resolve(spec);
      break;
    } catch {
      /* next candidate */
    }
  }
  if (!cli) return 'skipped';

  process.stderr.write('\n  ⏳ 첫 렌더 준비 — Chromium 다운로드(최초 1회, 이후 캐시 재사용)…\n');
  const r = spawnSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit' });
  if (r.status === 0) {
    process.stderr.write('  ✅ Chromium 준비 완료.\n');
    return 'installed';
  }
  process.stderr.write('  ⚠️  Chromium 다운로드 실패 — 렌더 게이트는 스킵으로 진행(데모 계속).\n');
  return 'skipped';
}

module.exports = { ensureChromium };
