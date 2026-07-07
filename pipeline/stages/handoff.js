import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runGate, gateSummary } from '../gates.js';
import { noteStatus } from '../project.js';

// Stage 3 — handoff. Assemble the self-contained hand-off package, then run the atelier
// pack + lint gates. The 4 package docs are generated DETERMINISTICALLY (template + parsed
// tokens) rather than by the model: lint-handoff is strict, and deterministic assembly is
// what reliably passes it (the model's creative value in these docs is low anyway).
export async function handoffStage(ctx, { emit } = {}) {
  emit('phase', { name: 'Handoff' });
  const HO = join(ctx.dir, 'handoff');
  await mkdir(HO, { recursive: true });

  // Inputs produced by earlier stages.
  const tokensCss = existsSync(join(ctx.dir, 'foundation', 'tokens.css'))
    ? await readFile(join(ctx.dir, 'foundation', 'tokens.css'), 'utf8') : '';
  const screenDir = join(ctx.dir, 'screens');
  const screens = existsSync(screenDir)
    ? (await readdir(screenDir)).filter((f) => f.endsWith('.html')) : [];

  emit('step', { msg: 'handoff 문서 4종 생성(token-mapping · hand-off · inventory · index)' });
  await writeFile(join(HO, 'token-mapping.md'), tokenMapping(ctx.name, tokensCss));
  await writeFile(join(HO, 'hand-off.md'), handOff(ctx.name));
  await writeFile(join(HO, 'component-inventory.md'), componentInventory(ctx.name, screens));
  await writeFile(join(HO, 'index.html'), visualDoc(ctx.name, ctx.idea, screens));
  emit('artifact', { path: `projects/${ctx.name}/handoff/` });

  // pack: copy PRD/00-flow/foundation/screens into handoff/ and rewrite ../ → ./
  emit('step', { msg: 'pack-handoff — self-contained 패키징' });
  const pack = await runGate('pack-handoff.cjs', ctx.name);
  emit('gate', { name: 'pack-handoff', ok: pack.ok, summary: gateSummary(pack.output) });

  // lint: completeness gate
  const lint = await runGate('lint-handoff.cjs', ctx.name);
  emit('gate', { name: 'lint-handoff', ok: lint.ok, summary: gateSummary(lint.output) });
  if (!lint.ok) emit('warn', { msg: 'lint-handoff 미통과 — 아래 리포트 확인(데모 계속)\n' + lint.output.split('\n').filter((l) => l.includes('❌')).join('\n') });

  await noteStatus(ctx.dir, `handoff: 패키지 4종 + ${screens.length}화면 (lint-handoff ${lint.ok ? 'PASS' : 'FAIL'})`);
  return { dir: HO, gate: lint.ok };
}

// --- deterministic package docs ---

function semanticTokens(css) {
  const all = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
  const isPrimitive = (t) => /^--[a-z]+(-[a-z]+)*-\d+$/.test(t);
  return all.filter((t) => !isPrimitive(t));
}

function tokenMapping(name, css) {
  const sem = semanticTokens(css);
  const rows = sem.length
    ? sem.map((t) => `| \`${t}\` | ${roleOf(t)} | \`${targetOf(t)}\` |`).join('\n')
    : '| (semantic 토큰 없음) | | |';
  return `# 토큰 매핑표 — ${name} → 대상 시스템

semantic 토큰을 대상 토큰 시스템에 매핑한다(통째 복붙 금지). primitive(\`--word-숫자\`)는 값이라 매핑 불필요.

| 우리 semantic 토큰 | 역할 | 대상 시스템 토큰(예시) |
|---|---|---|
${rows}
`;
}

function roleOf(t) {
  if (/on-primary|on-accent/.test(t)) return 'primary 위 텍스트';
  if (/text-muted|muted|secondary/.test(t)) return '보조 텍스트';
  if (/text/.test(t)) return '본문 텍스트';
  if (/bg|background|canvas/.test(t)) return '페이지 배경';
  if (/surface|card/.test(t)) return '표면';
  if (/primary|accent|brand/.test(t)) return '브랜드/강조';
  if (/border|line|divider/.test(t)) return '경계선';
  if (/radius/.test(t)) return '모서리';
  if (/space|spacing|gap|sp-/.test(t)) return '여백';
  return '토큰';
}
function targetOf(t) {
  if (/on-primary/.test(t)) return 'accent.on';
  if (/muted|secondary/.test(t)) return 'text.secondary';
  if (/text/.test(t)) return 'text.primary';
  if (/bg|canvas/.test(t)) return 'bg.canvas';
  if (/surface|card/.test(t)) return 'bg.surface';
  if (/primary|accent|brand/.test(t)) return 'accent.base';
  if (/border|divider/.test(t)) return 'border.default';
  return 'token.map';
}

function handOff(name) {
  return `# ${name} 디자인 인계 — 대상 앱에 구현

## 목표
아래 디자인 산출물을 대상 앱의 컨벤션으로 구현한다. 디자인은 참고, 흐름·기능은 계약(필수).

## 먼저 읽을 것
- 제품 요구사항: \`./PRD.md\` — 배경·목표·기능·데이터 모델·범위 외.
- 디자인 패키지:
  - chosen final 화면 \`./screens/\` — 최종 비주얼
  - \`./index.html\` — 화면 갤러리 + 흐름
  - \`./token-mapping.md\` — semantic 토큰 매핑
  - \`./component-inventory.md\` — 컴포넌트 인벤토리
  - \`./00-flow.md\` — 흐름·기능 계약

## 지킬 것 (계약)
- 화면 목록·내비게이션·기능 동작은 디자인대로.
- 토큰은 매핑표대로 대상 시스템 토큰에 매핑(통째 복붙 금지).

## 만들 순서 (제안)
1. 토큰 매핑 반영 → 2. 공통 컴포넌트 → 3. 화면 조립 → 4. 흐름·상태 연결

## 검수
- 흐름·기능이 00-flow.md 계약대로 동작하는지 확인.
`;
}

function componentInventory(name, screens) {
  return `# 컴포넌트 인벤토리 — ${name}

이 MVP 패키지는 공통 컴포넌트를 별도 파일로 분리하지 않는다 — 각 화면(\`./screens/\`) 안에 인라인되어 있다.
대상 앱 구현 시 아래 화면에서 반복되는 UI(버튼·카드·입력·내비 등)를 대상 시스템의 공통 컴포넌트로 추출한다.

## 화면
${screens.map((s) => `- \`./screens/${s}\``).join('\n') || '- (없음)'}
`;
}

function visualDoc(name, idea, screens) {
  const cards = screens.map((s) => `
    <figure class="card">
      <figcaption>${s}</figcaption>
      <iframe src="screens/${s}" title="${s}" loading="lazy"></iframe>
    </figure>`).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — 화면 갤러리</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; background: #0f1115; color: #e8eaed; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  p.idea { color: #9aa0a6; margin: 0 0 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.5rem; }
  .card { margin: 0; border: 1px solid #2a2d34; border-radius: 12px; overflow: hidden; background: #16181d; }
  figcaption { padding: .6rem .9rem; font-weight: 600; border-bottom: 1px solid #2a2d34; }
  iframe { width: 100%; height: 520px; border: 0; background: #fff; display: block; }
</style>
</head>
<body>
  <h1>${name} — 화면 갤러리</h1>
  <p class="idea">${idea}</p>
  <div class="grid">${cards}
  </div>
</body>
</html>
`;
}
