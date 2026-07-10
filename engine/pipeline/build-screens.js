import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../model/generate.js';
import { runAgentic } from '../model/agentic.js';
import { PROJECTS_ROOT } from './project.js';

// Hi-fi builder for the pipeline. Unlike the A/B harness (which embeds HTML in JSON via
// structured output — robust only on strong models), this uses a delimiter format so the
// model never has to JSON-escape a large HTML blob. That makes it reliable on gemini-flash
// too, which chokes on HTML-in-JSON. One call, multiple files, parsed by regex.

const FILE_RE = /<<<FILE\s+([^\n>]+?)>>>\s*\n([\s\S]*?)\n?<<<END>>>/g;

export const buildSystem = `너는 Kiln 파이프라인의 하이파이 UI 빌더다. 승인된 PRD·흐름 계약·디자인 토큰을 받아
HIGH-FIDELITY 자립형(self-contained) HTML 화면을 만든다 — 와이어프레임이 아니라 프로덕션 비주얼 품질.

품질 규칙(atelier 게이트 규격 계승):
- 각 화면은 외부 CSS/JS/폰트/이미지 요청이 없는 하나의 self-contained HTML. <style>에 토큰을 인라인한다.
- hi-fi = hi-fi. "와이어 + 색"이 아니다. 깊이/elevation(그림자·레이어), 여백 리듬, 타이포 위계(제목/본문/캡션),
  마이크로 인터랙션·상태 표현(hover/active/focus/disabled), 진짜 내용(lorem·빈 껍데기 금지)으로 판정받는다.
- 인터랙티브 컨트롤은 wired(동작 또는 상태 변화)이거나 명시적으로 "[범위 밖]" 라벨. 죽은 컨트롤 금지.
- 대상 뷰포트·흐름 계약을 정확히 지킨다. 임의 기능·범위 이탈 금지.

출력 형식(중요): JSON 아님. 흐름의 hi-fi 화면마다 아래 블록을 그대로 낸다. 블록 밖 산문 금지.
<<<FILE screens/<이름>.html>>>
<!doctype html> ... 전체 HTML ...
<<<END>>>`;

export function buildPrompt(contract) {
  return `프로젝트 "${contract.name}"의 하이파이 화면을 만들어라.

## PRD
${contract.prd}

## 흐름 계약(00-flow.md) — 여기 적힌 hi-fi 화면을 그대로 만든다
${contract.flow}

## 디자인 토큰(foundation/tokens.css) — 인라인해서 사용
\`\`\`css
${contract.tokens}
\`\`\`

흐름의 hi-fi 화면을 각각 self-contained hi-fi HTML로. 각 화면은 <<<FILE screens/이름.html>>> … <<<END>>> 블록으로.`;
}

export async function buildScreens({ model, contract, temperature, maxTokens = 24000 }) {
  const res = await generate(buildPrompt(contract), { model, system: buildSystem, temperature, maxTokens });
  return parseFiles(res, '빌드 출력에서 <<<FILE …>>> 블록을 찾지 못함');
}

// --- coherent subset rebuild (revise) ---
// Regenerate only the named screens, but with the FULL design context so the result stays
// coherent with everything else: the current tokens/flow/PRD as the contract, the unchanged
// sibling screens as visual reference (match their language), and each target's current HTML as
// the base to modify. This is what makes chat-scoped revise keep cross-screen consistency.

export const reviseSystem = `${buildSystem}

[개정 모드] 지금은 기존 제품의 일부 화면만 다시 만든다. 반드시:
- 함께 주어진 **레퍼런스 화면들의 시각 언어**(레이아웃 규칙·컴포넌트 모양·타이포·간격·상호작용 패턴)와 **일치**시킨다. 튀는 새 스타일을 만들지 마라.
- 각 대상 화면의 **현재 HTML을 출발점**으로, 개정 지침이 요구하는 부분만 바꾸고 나머지 완성도는 보존한다.
- 지정된 대상 화면만 출력한다(레퍼런스 화면은 다시 내지 마라).`;

export function revisePrompt({ contract, targets, references, guidance }) {
  const ref = references.length
    ? references
        .map((r) => `<<<REF ${r.path}>>>\n${r.html}\n<<<END>>>`)
        .join('\n\n')
    : '(레퍼런스 화면 없음 — 전체 재생성)';
  const tgt = targets
    .map((t) => `<<<CURRENT ${t.path}>>>\n${t.html || '(신규 화면 — 새로 작성)'}\n<<<END>>>`)
    .join('\n\n');
  return `프로젝트 "${contract.name}"의 일부 화면을 개정한다.

## 개정 지침(무엇을·어떻게)
${guidance}

## 디자인 토큰(foundation/tokens.css) — 인라인해서 사용
\`\`\`css
${contract.tokens}
\`\`\`

## 흐름 계약(00-flow.md)
${contract.flow}

## 레퍼런스 화면(이 시각 언어에 맞춰라 — 다시 출력하지 마라)
${ref}

## 개정 대상 화면(현재 상태 — 이걸 출발점으로 지침대로 고쳐라)
${tgt}

각 대상 화면을 self-contained hi-fi HTML로, <<<FILE screens/이름.html>>> … <<<END>>> 블록으로만 출력하라.`;
}

export async function buildRevised({ model, contract, targets, references = [], guidance, temperature, maxTokens = 24000 }) {
  const res = await generate(revisePrompt({ contract, targets, references, guidance }), {
    model,
    system: reviseSystem,
    temperature,
    maxTokens,
  });
  return parseFiles(res, '개정 출력에서 <<<FILE …>>> 블록을 찾지 못함');
}

// --- agentic build (C2 착수 ②) ---
// The render-in-loop path. Instead of one generate() call returning HTML for us to write, the
// agent writes screens/*.html itself, renders them with the shoot gate (an allowed Bash tool),
// reads the resulting PNGs, and fixes whatever came out blank/ugly — atelier's self-correction,
// restored. Same quality rules as the one-shot builder; only the output mechanism differs (real
// files + a real renderer instead of a delimiter blob). Falls back to buildScreens() upstream
// when the provider isn't agentic (design.js).

export const agenticBuildSystem = `너는 Kiln 파이프라인의 하이파이 UI 빌더 에이전트다. 승인된 PRD·흐름 계약·디자인 토큰을 받아
HIGH-FIDELITY 자립형(self-contained) HTML 화면을 파일로 직접 쓰고, 렌더해서 눈으로 확인하며 고친다.

품질 규칙(atelier 게이트 규격 계승):
- 각 화면은 외부 CSS/JS/폰트/이미지 요청이 없는 하나의 self-contained HTML. <style>에 토큰을 인라인한다.
- hi-fi = hi-fi. "와이어 + 색"이 아니다. 깊이/elevation(그림자·레이어), 여백 리듬, 타이포 위계(제목/본문/캡션),
  마이크로 인터랙션·상태 표현(hover/active/focus/disabled), 진짜 내용(lorem·빈 껍데기 금지)으로 판정받는다.
- 인터랙티브 컨트롤은 wired(동작 또는 상태 변화)이거나 명시적으로 "[범위 밖]" 라벨. 죽은 컨트롤 금지.
- 대상 뷰포트·흐름 계약을 정확히 지킨다. 임의 기능·범위 이탈 금지.

작업 방식(툴 루프 — 이게 핵심이다):
1. 흐름 계약의 각 hi-fi 화면을 Write 툴로 <screens 디렉토리>/<이름>.html 에 쓴다.
2. 전 화면을 쓴 뒤 Bash로 정확히 \`node scripts/shoot.cjs <프로젝트명>\` 을 실행해 렌더한다.
3. 렌더 결과 PNG(_shots/screens/<이름>.png)를 Read 툴로 열어 **실제 픽셀을 직접 본다**. 리포트의 ❌blank·⚠️near-uniform도 확인한다.
4. blank·흰 화면·찌그러짐·저품질이 보이면 Edit로 해당 HTML을 고치고 2로 돌아가 다시 렌더한다.
5. 전 화면이 정상 렌더로 확인되면 종료한다. 마지막에 만든 화면 목록을 한 줄로 요약한다.
남은 턴이 부족하면 완성도 높은 화면 우선으로 마무리한다. 델리미터·JSON 출력 금지 — 산출물은 오직 디스크의 파일이다.`;

export function agenticBuildTask({ contract, screensDir, shotsDir }) {
  return `프로젝트 "${contract.name}"의 하이파이 화면을 만들어라.

경로(정확히 지킬 것 — 다른 위치를 뒤지지 마라):
- 화면 HTML: ${screensDir}/<이름>.html
- 렌더 실행: 저장소 루트 기준 \`node scripts/shoot.cjs ${contract.name}\` (뷰포트 생략 = 1280x900)
- 렌더 결과 PNG: ${shotsDir}/<이름>.png  ← Read 툴로 이 파일을 직접 열어 픽셀을 확인한다

## PRD
${contract.prd}

## 흐름 계약(00-flow.md) — 여기 적힌 hi-fi 화면을 그대로 만든다
${contract.flow}

## 디자인 토큰(foundation/tokens.css) — 각 화면 <style>에 인라인
\`\`\`css
${contract.tokens}
\`\`\`

작업 방식(시스템 지침)대로: 화면을 쓰고 → 렌더하고 → PNG를 열어 보고 → 고치는 루프를 돌려라.`;
}

// Run the agentic builder against a project's real files. The agent writes to <ctx.dir>/screens
// and renders via scripts/shoot.cjs (KILN_PROJECTS_ROOT-scoped, cwd = repo root). Turn/tool-call
// progress is forwarded to emit as SSE sub-events. Returns the built screens read back off disk in
// the same { path, html } shape as buildScreens, so the design stage's downstream is unchanged.
export async function buildScreensAgentic({ model, contract, ctx, emit, maxTurns }) {
  const screensDir = join(ctx.dir, 'screens');
  const shotsDir = join(ctx.dir, '_shots', 'screens'); // where shoot.cjs writes the PNGs
  const onEvent = (kind, data) => emit(kind, data);

  const out = await runAgentic(agenticBuildTask({ contract, screensDir, shotsDir }), {
    model,
    system: agenticBuildSystem,
    tools: ['Write', 'Read', 'Edit', 'Bash'], // the build toolset — no WebFetch/Task/etc.
    maxTurns: maxTurns ?? Number(process.env.KILN_AGENTIC_MAX_TURNS || 8),
    cwd: process.cwd(), // repo root — `node scripts/shoot.cjs` resolves like runGate spawns it
    addDir: ctx.dir, // grant writes to the project dir (may be outside cwd)
    env: { KILN_PROJECTS_ROOT: PROJECTS_ROOT }, // shoot writes to the pipeline's projects root
    onEvent,
  });

  // Turn budget spent before the agent declared done — the written screens still stand; the
  // engine's render gate + design-verifier judge them next. Warn, don't discard.
  if (out.maxTurnsHit) {
    emit('warn', { msg: `agentic 빌더 턴 예산(${out.turns}) 소진 — 현재까지 화면으로 진행(엔진 게이트가 판정)` });
  }

  const files = await readScreens(screensDir);
  if (!files.length) {
    const err = new Error(
      'agentic 빌더가 화면 파일을 하나도 쓰지 못했습니다 — 다시 시도하거나 다른 에이전트/모델을 선택해 주세요.',
    );
    err.lastText = out.result;
    throw err;
  }
  return {
    model: out.model,
    provider: out.provider,
    usage: out.usage,
    attempts: out.turns || 1,
    files,
  };
}

// Read back the screens the agent wrote, sorted, as { path:'screens/x.html', html }.
async function readScreens(screensDir) {
  let names;
  try {
    names = (await readdir(screensDir)).filter((n) => n.toLowerCase().endsWith('.html')).sort();
  } catch {
    return [];
  }
  const files = [];
  for (const n of names) {
    const html = await readFile(join(screensDir, n), 'utf8');
    if (html.trim()) files.push({ path: `screens/${n}`, html });
  }
  return files;
}

function parseFiles(res, errMsg) {
  const files = [];
  for (const m of res.text.matchAll(FILE_RE)) {
    const path = m[1].trim();
    const html = m[2].trim();
    if (path && html) files.push({ path, html });
  }
  if (!files.length) {
    const err = new Error(errMsg);
    err.lastText = res.text;
    throw err;
  }
  return { model: res.model, provider: res.provider, usage: res.usage, attempts: res.attempts, files };
}
