---
name: kiln-mvp-pipeline
description: Kiln MVP forge 엔진 구조와 결정 — Gemini 헤드리스 파이프라인(pipeline/)
metadata:
  type: project
---

Kiln MVP는 **Gemini만으로** "아이디어→기획→디자인→handoff" 흐름을 체험시키는 게 목적(Opus vs Gemini 정식 게이트는 Claude 결제 후로 유보 — [[kiln-model-strategy]]).

**엔진(`pipeline/`)** — stage 조립식:
- `stages/prd.js` — idea → PRD.md, **lint-prd 게이트**(blocking, 1회 자동개정).
- `stages/design.js` — PRD → tokens.css + 00-flow.md → hi-fi 화면(`build-screens.js`) → **design-verifier 독립검증**(advisory).
- `stages/handoff.js` — 4종 문서 **결정론적 생성**(token-mapping·hand-off·inventory·index) + pack-handoff + lint-handoff 게이트.
- `forge.js` = 세 stage 합성(무인). 수동모드 `bin/plan.js`·`bin/design.js`는 **같은 stage 함수 재사용** → 구현 1개.
- `events.js` — `emit(type,data)` 진행 seam. 지금은 CLI 출력, 나중에 SSE가 그대로 구독(웹 스트리밍 공짜).

**핵심 결정(왜):**
- 게이트 = atelier 포터블 스크립트를 `scripts/*.cjs`로 **복사**(런타임 atelier 참조 안 함). kiln이 `type:module`이라 `.cjs` 확장자 필수.
- hi-fi 빌드는 **HTML-in-JSON 금지** — flash에서 "Unterminated string"으로 깨진다. `<<<FILE path>>>…<<<END>>>` 구분자 포맷으로 파싱(양 모델 견고). pro는 JSON도 되지만 flash는 안 됨.
- **멀티모델 하이브리드**: 빌드=gemini-flash(싸고 빠름), **최종 판정=gemini-pro**. flash 심판은 입력에 없는 화면을 환각하고 15KB 화면을 thin으로 오탐 → `design.js`에 pro 기본 + reconcile 가드(빌드 안 된 화면 verdict 제거).
- design-verifier는 Gemini가 컨트롤을 안 wired하거나 `[범위 밖]` 라벨을 안 붙여 거의 항상 deadControl FAIL. MVP는 advisory(데모 안 끊음). 빌드 프롬프트 조이면 개선 여지.

**검증됨(2026-07-07)**: `node bin/forge.js "<아이디어>"` → PRD lint PASS · hi-fi 4화면(진짜 hi-fi) · handoff lint PASS(self-contained). projects/는 gitignore.

**웹 껍데기 착수·검증됨(2026-07-07)** → [[kiln-web-shell]](Next.js+FSD, emit seam 구독). **다음**: 실 Gemini 완주 데모 → 친구 반응 → 풀 게이트(다수결·리디자인·trend) 노드 추가. 관련 [[kiln-roadmap]]·[[kiln-overview]].
