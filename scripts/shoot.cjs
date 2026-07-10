#!/usr/bin/env node
// 렌더 게이트(shoot) — design-verifier가 *소스*만 읽던 픽셀맹을 깬다. 화면을 헤드리스 크로미움으로
// *실제 렌더*해 PNG로 떨구고, 렌더된 결과가 blank/near-uniform인지 결정론적으로 판정한다.
//
//   node scripts/shoot.cjs <project> [WxH]
//   예: node scripts/shoot.cjs example-lunch-vote 1280x900
//
// 배경(kiln C2 착수 ①): design-verifier(design.js)는 모델이 HTML *텍스트*를 읽는 판정 — 픽셀을
// 안 본다. isBlankScreen 가드도 HTML *소스* 기반이라, 소스는 멀쩡한데 렌더가 흰 화면/찌그러짐인
// 실패는 못 잡았다. 이 게이트가 각 화면을 실제 렌더해서 (a) PNG를 _shots/에 남기고 — 착수 ③
// vision 판정의 입력 — (b) 렌더된 DOM·픽셀 지표로 blank를 잡는다. 모델 비용 0.
//
// 대상은 projects/<project>/screens/*.html 로 고정(빌더가 화면을 항상 screens/에 쓴다).
// 출력: projects/<project>/_shots/screens/<name>.png. _shots/ 는 .gitignore 대상.
// 리포트는 lint-*.cjs와 동일한 ✅/⚠️/❌ UX — gateSummary()가 그대로 압축한다.
//
// exit 1: 렌더된 blank 화면 발견(하드 실패). exit 0: 전 화면 정상 / 브라우저 미설치로 스킵(advisory).
const fs = require('fs');
const path = require('path');
const { ensureChromium } = require('./ensure-chromium.cjs');

const project = process.argv[2];
const vp = process.argv[3] || '1280x900';
if (!project || project.startsWith('-')) {
  console.error('사용법: node scripts/shoot.cjs <project> [WxH]');
  process.exit(1);
}

// KILN_PROJECTS_ROOT(패키징 런처가 주입) 우선, 없으면 repo-상대 — lint-prd.cjs와 동일 규칙.
const PROJECTS_ROOT = process.env.KILN_PROJECTS_ROOT
  ? path.resolve(process.env.KILN_PROJECTS_ROOT)
  : path.join(path.resolve(__dirname, '..'), 'projects');

const srcDir = path.join(PROJECTS_ROOT, project, 'screens');
const outDir = path.join(PROJECTS_ROOT, project, '_shots', 'screens');

// chromium 런타임 확보 — playwright / @playwright/test 어느 쪽이 깔려 있어도 동작.
// 둘 다 없으면 hard-fail이 아니라 graceful skip(설치 힌트 + exit 0). npx 사용자 마찰 1차 방어선.
function loadChromium() {
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      return require(pkg).chromium;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

// PNG 헤더에서 폭×높이만 파싱(디코드 라이브러리 불필요). 시그니처 8B + IHDR: len 4B + "IHDR" 4B +
// width 4B(offset 16) + height 4B(offset 20), big-endian.
function pngSize(buf) {
  if (!buf || buf.length < 24) return { w: 0, h: 0 };
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// 렌더된 DOM 지표(레이아웃·CSS 적용 후) — HTML 소스가 아니라 '그려진 결과'를 본다.
// page.evaluate에 *함수 자체*를 넘긴다(문자열로 넘기면 표현식으로 평가돼 호출되지 않는다).
function collectMetrics() {
  const b = document.body;
  if (!b) return { bodyH: 0, textLen: 0, visible: 0 };
  const text = (b.innerText || '').replace(/\s+/g, ' ').trim();
  let visible = 0;
  for (const el of b.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none') visible++;
  }
  return { bodyH: Math.round(b.getBoundingClientRect().height), textLen: text.length, visible };
}

async function main() {
  // Bootstrap: download the pinned Chromium on the first render that needs it (idempotent; reused
  // forever after). Runs before loadChromium so the very first render works with no manual setup.
  ensureChromium();
  const chromium = loadChromium();
  if (!chromium) {
    report({ skipped: '크로미움 미설치 — `npx playwright install chromium` 후 렌더 게이트가 켜집니다(그때까지 스킵).' });
    process.exit(0); // 스킵은 실패가 아니다(advisory). 데모는 계속된다.
  }
  if (!fs.existsSync(srcDir)) {
    console.error(`화면 폴더 없음: ${srcDir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.html'));
  if (!files.length) {
    console.error(`html 없음: ${srcDir}`);
    process.exit(1);
  }

  const [pw, ph] = vp.split(/[x×*]/i).map((n) => parseInt(n, 10));
  const width = pw > 0 ? pw : 1280;
  const height = ph > 0 ? ph : 900;

  fs.mkdirSync(outDir, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    // 브라우저 바이너리 미설치 등 런치 실패도 스킵으로 강등(advisory).
    report({ skipped: `크로미움 실행 실패(${e.message.split('\n')[0]}) — \`npx playwright install chromium\` 필요.` });
    process.exit(0);
  }

  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const results = [];
  for (const f of files) {
    const fileUrl = 'file://' + path.join(srcDir, f).replace(/\\/g, '/');
    try {
      await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
    } catch {
      // load 타임아웃(인라인 타이머 등)에도 현재 상태를 찍는다 — 원본 shoot 로직.
    }
    await page.waitForTimeout(400); // 폰트·전환 정착
    const m = (await page.evaluate(collectMetrics).catch(() => null)) || { bodyH: 0, textLen: 0, visible: 0 };
    const buf = await page.screenshot({ fullPage: true });
    const out = path.join(outDir, f.replace(/\.html$/i, '.png'));
    fs.writeFileSync(out, buf);
    const { w, h } = pngSize(buf);
    // near-uniform 힌트: 균일한 이미지는 PNG 압축률이 극단적으로 높아 픽셀당 바이트가 작다.
    const megapx = (w * h) / 1e6;
    const bytesPerMP = megapx > 0 ? buf.length / megapx : 0;
    results.push({ name: f, m, w, h, bytesPerMP, rel: path.relative(PROJECTS_ROOT, out).replace(/\\/g, '/') });
  }
  await browser.close();
  report({ results });
}

// ── 판정 & 리포트(lint-*.cjs와 동일 UX) ──────────────────────────────────────────────
// ❌ blank(하드): 렌더된 body가 사실상 비어 있음 — isBlankScreen(소스판정)의 픽셀 버전.
// ⚠️ flat(권고): 픽셀당 바이트가 극히 낮음 — near-white/와이어풍 가능성(휴리스틱, 강제 아님).
function verdictOf(r) {
  if (r.m.bodyH < 200 || r.m.visible < 8 || r.m.textLen < 30) {
    return { level: 'error', why: `렌더 blank (h=${r.m.bodyH}px, 요소=${r.m.visible}, 글자=${r.m.textLen})` };
  }
  if (r.bytesPerMP > 0 && r.bytesPerMP < 12000) {
    return { level: 'warn', why: `near-uniform 의심 (${Math.round(r.bytesPerMP / 1000)}KB/MP — 흰 화면·와이어풍?)` };
  }
  return { level: 'ok', why: `${r.w}×${r.h} · 요소 ${r.m.visible} · 글자 ${r.m.textLen}` };
}

function report({ results, skipped }) {
  const line = (s) => console.log(s);
  line(`\n 렌더 게이트(shoot) — ${project}\n`);
  if (skipped) {
    line(`  ⚠️  ${skipped}`);
    line('');
    line(' ⚠️  스킵 — 렌더 검증 없이 진행(데모 계속).\n');
    return;
  }
  const errs = [];
  const warns = [];
  for (const r of results) {
    const v = verdictOf(r);
    if (v.level === 'error') { line(`  ❌ ${r.name} — ${v.why}`); errs.push(r.name); }
    else if (v.level === 'warn') { line(`  ⚠️  ${r.name} — ${v.why}`); warns.push(r.name); }
    else line(`  ✅ ${r.name} — ${v.why}`);
  }
  line('');
  if (errs.length) {
    line(` ❌ 실패 — 렌더 blank ${errs.length}/${results.length}: ${errs.join(', ')}. 화면 재생성 권장(데모 계속).\n`);
    process.exitCode = 1;
    return;
  }
  line(` ✅ 통과 — 전 화면 렌더 확인 (${results.length}개)${warns.length ? ` (near-uniform 의심 ${warns.length}개 검토 권장)` : ''}.\n`);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
