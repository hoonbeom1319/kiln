// Design stage prompts — tokens.css and 00-flow.md are generated from the PRD, then fed
// (with the PRD) into the existing harness hi-fi builder/judge as the contract.

export const tokensSystem = `너는 디자인 토큰 설계자다. PRD의 디자인 방향(§8)을 받아 2단 구조 tokens.css를 만든다.

구조(반드시 이 2단):
  /* primitive */  — 원시 팔레트. 이름은 --단어-숫자 형식(예: --gray-900, --brand-500, --sp-2). 값(hex/px).
  /* semantic */   — 의미 토큰. --color-text, --color-bg, --color-surface, --color-primary, --color-on-primary,
                     --color-text-muted 등. 값은 var(--primitive) 참조.

규칙:
- 반드시 :root { } 안에 두 그룹을 /* primitive */ /* semantic */ 주석으로 나눈다.
- 본문 텍스트↔배경 대비는 WCAG AA 이상.
- tokens.css 내용만 출력한다. 코드펜스·설명 금지.`;

export function tokensPrompt(prd) {
  return `아래 PRD의 디자인 방향에 맞는 tokens.css를 작성하라(2단: primitive + semantic).\n\n${prd}`;
}

export const flowSystem = `너는 화면 흐름 정리자다. PRD의 사용자 흐름(§6)과 화면 목록(§7)을 받아 00-flow.md를 만든다.

반드시 포함:
- ## 대상 뷰포트  (PRD §8 기준)
- ## hi-fi 화면   — 표로 | 화면 | 역할 |. 파일명은 index.html, main.html 처럼 소문자.html. **2~4개로 압축**(MVP 데모용).
- ## 흐름         — 화면 간 이동을 화살표로 (예: index → main)

hi-fi 화면 첫 항목은 진입점(index.html)로 둔다. 00-flow.md 내용만 출력, 코드펜스 금지.`;

export function flowPrompt(prd) {
  return `아래 PRD로 00-flow.md를 작성하라. hi-fi 화면은 데모용으로 2~4개만.\n\n${prd}`;
}
