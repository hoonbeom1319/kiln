// Traceability prompt — maps each built hi-fi screen back to the PRD requirement(s) it
// reflects. One short line per screen; this is the annotation shown beside each screen in
// the gallery, and later the signal revise uses to keep requirements ↔ screens in sync.

export const traceSystem = `너는 PRD와 완성된 hi-fi 화면 목록을 받아, 각 화면이 PRD의 어떤 요구사항·기능을 반영했는지 아주 짧게 요약한다.

규칙:
- 화면마다 reflects를 **한글 1~2줄(최대 90자)**로. 데모 갤러리에서 화면 옆에 붙일 주석이다.
- PRD에 실재하는 기능/요구사항에 근거해라. 화면에 없는 걸 지어내지 마라.
- 주어진 file 목록만 사용한다. 새 파일을 만들지 마라.
- 담백하게. 미사여구·머리말 금지.`;

export function tracePrompt(prd, screens) {
  const list = screens.map((s) => `- ${s.file}${s.title ? ` — ${s.title}` : ''}`).join('\n');
  return `아래 PRD와 화면 목록을 보고, 각 화면이 반영한 PRD 요구사항을 reflects에 1~2줄로 채워라.

## 화면
${list}

## PRD
${prd}`;
}

export const traceSchema = {
  type: 'object',
  required: ['screens'],
  properties: {
    screens: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'reflects'],
        properties: {
          file: { type: 'string' },
          title: { type: 'string' },
          reflects: { type: 'string' },
        },
      },
    },
  },
};
