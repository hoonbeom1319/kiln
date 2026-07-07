import { generate } from '../model/generate.js';

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
