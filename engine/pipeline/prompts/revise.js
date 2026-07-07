// Revise prompts. The engine is CHAT-SCOPED, not screen-scoped: a revision reasons over the
// whole project (PRD · flow · tokens · every screen) and decides which artifacts must change to
// satisfy the feedback while keeping the design coherent — because coherence (tokens, shared
// components, cross-screen flow) is a GLOBAL property (DECISIONS.md).
//
// Step 1 is the PLAN (this schema): scope the change. Step 2 applies it — the apply logic in
// stages/revise.js enforces the coherence rules (e.g. tokens change ⇒ every screen rebuilds),
// so the plan only has to name intent + scope, not micro-manage the cascade.

export const planSystem = `너는 Kiln의 디자인 개정 기획자다. 완성된 제품(PRD·화면 흐름·디자인 토큰·hi-fi 화면 전체)과 사용자의 자연어 피드백을 받아,
**무엇을 바꿔야 하는지**를 판단한다. 개별 화면 수리공이 아니라 제품 전체의 일관성을 지키는 사람이다.

판단 원칙:
- 디자인 일관성은 **전역 속성**이다. 토큰(색·타이포·간격)을 바꾸면 그 토큰을 인라인한 **모든 화면**이 함께 바뀌어야 한다 → 이 경우 scope.tokens=true로 두면 apply가 전 화면을 재생성한다(screens에 일일이 나열하지 마라).
- 특정 화면 한둘의 레이아웃·문구·컴포넌트만 바꾸는 국소 수정이면 scope.tokens=false로 두고 screens에 그 파일명만 넣는다. apply가 형제 화면들을 레퍼런스로 줘서 시각 언어를 일치시킨다.
- 흐름/화면 구성이 바뀌면(화면 추가·삭제·역할 변경) scope.flow=true. 새 요구사항이 생겨 PRD 자체가 바뀌어야 하면 scope.prd=true.
- **최소 변경 원칙**: 피드백을 만족하는 데 꼭 필요한 산출물만 바꾼다. 요청에 없는 것을 임의로 바꾸지 마라.
- guidance에는 빌더/작성자에게 넘길 **구체적이고 실행 가능한 지시**를 적는다(무엇을·어디를·어떻게). 모호한 형용사 나열 금지.

note는 사용자에게 채팅으로 보여줄 한국어 설명이다(무엇을 왜 바꾸는지 2~3문장). 담백하게.`;

// The plan the model returns. `screens` lists screen filenames to regenerate; when
// scope.tokens is true the apply step expands this to every screen regardless.
export const planSchema = {
  type: 'object',
  required: ['intent', 'note', 'scope', 'screens', 'guidance'],
  properties: {
    intent: { type: 'string' }, // one-line restatement of what the user wants
    note: { type: 'string' }, // human-facing chat explanation of the plan
    scope: {
      type: 'object',
      required: ['prd', 'tokens', 'flow'],
      properties: {
        prd: { type: 'boolean' },
        tokens: { type: 'boolean' },
        flow: { type: 'boolean' },
      },
    },
    screens: { type: 'array', items: { type: 'string' } }, // filenames, e.g. ["main.html"]
    guidance: { type: 'string' }, // concrete instructions carried into the regeneration
  },
};

export function planPrompt({ idea, prd, flow, tokens, screens, history, feedback }) {
  const screenList = screens
    .map((s) => `- ${s.file}${s.title ? ` — ${s.title}` : ''}${s.reflects ? ` (반영: ${s.reflects})` : ''}`)
    .join('\n');
  return `아이디어: ${idea}

## 지금까지의 수정 대화
${history}

## 현재 화면 목록
${screenList}

## 현재 디자인 토큰(foundation/tokens.css)
\`\`\`css
${tokens}
\`\`\`

## 현재 흐름(00-flow.md)
${flow}

## 현재 PRD(요약 참고 — 필요한 부분만)
${clip(prd, 4000)}

---
## 사용자의 새 피드백
${feedback}

위 피드백을 만족시키되 제품 전체의 일관성을 지키려면 무엇을 바꿔야 하는가? scope와 screens, guidance를 채워라.`;
}

// --- incremental artifact revisers (step 2) ---

export const prdReviseSystem = `너는 기존 PRD를 사용자 피드백에 맞게 **개정**하는 기획자다. 처음부터 새로 쓰지 말고, 기존 PRD의 구조(## 1~11 섹션)와 내용을 최대한 보존하면서 피드백이 요구하는 부분만 정확히 반영한다.
규칙: 11개 섹션 번호·제목 헤더를 그대로 유지한다. 피드백과 무관한 섹션은 건드리지 않는다. 코드펜스 없이 PRD.md 본문 전체(Markdown)만 출력한다. 한국어.`;

export function prdRevisePrompt({ prd, feedback, guidance }) {
  return `## 현재 PRD
${prd}

## 반영할 피드백
${feedback}

## 개정 지침
${guidance || '(피드백대로)'}

위 PRD를 개정해 전체 본문을 다시 출력하라(변경 없는 섹션도 그대로 포함해 완전한 문서로).`;
}

export const tokensReviseSystem = `너는 디자인 토큰을 개정한다. 기존 tokens.css의 2단 구조(/* primitive */ + /* semantic */)와 semantic 토큰 이름을 그대로 유지하되, 피드백이 요구하는 값(색·타이포·간격 등)만 바꾼다.
규칙: :root{} 안 2단 구조 유지. semantic 토큰 이름을 바꾸거나 없애지 마라(화면들이 그 이름을 참조한다). 본문 텍스트↔배경 대비 WCAG AA 이상. tokens.css 내용만 출력, 코드펜스·설명 금지.`;

export function tokensRevisePrompt({ tokens, prd, feedback, guidance }) {
  return `## 현재 tokens.css
${tokens}

## PRD 디자인 방향(참고)
${clip(sectionOf(prd, '8'), 1500)}

## 반영할 피드백
${feedback}

## 개정 지침
${guidance || '(피드백대로)'}

위 토큰을 개정해 tokens.css 전체를 다시 출력하라.`;
}

export const flowReviseSystem = `너는 화면 흐름(00-flow.md)을 개정한다. 기존 형식(## 대상 뷰포트 / ## hi-fi 화면 표 / ## 흐름)을 유지하되 피드백대로 화면을 추가·삭제·역할 변경한다.
규칙: hi-fi 화면 표의 파일명은 소문자.html. 진입점은 index.html. 데모용으로 2~4개 유지. 00-flow.md 내용만 출력, 코드펜스 금지.`;

export function flowRevisePrompt({ flow, prd, feedback, guidance }) {
  return `## 현재 00-flow.md
${flow}

## PRD(참고)
${clip(prd, 3000)}

## 반영할 피드백
${feedback}

## 개정 지침
${guidance || '(피드백대로)'}

위 흐름을 개정해 00-flow.md 전체를 다시 출력하라.`;
}

function clip(s, n) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n) + '\n…(생략)' : str;
}

// Best-effort extraction of a numbered PRD section ("## 8. …" up to the next "## ").
function sectionOf(prd, num) {
  const re = new RegExp(`##\\s*${num}\\.[\\s\\S]*?(?=\\n##\\s|$)`);
  const m = String(prd || '').match(re);
  return m ? m[0] : '';
}
