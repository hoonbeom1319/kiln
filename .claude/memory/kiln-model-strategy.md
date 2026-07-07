---
name: kiln-model-strategy
description: Kiln의 모델·오케스트레이션 전략 — Gemini 우선이지만 교체 가능해야 함
metadata:
  type: project
---

Kiln은 **Gemini API**로 먼저 개발한다(사용자가 Gemini 크레딧 보유). 단 **모델 교체 가능성이 최우선 설계 제약** — POC 돌리며 단계별로 다른 모델(Claude 등)로 갈아탈지 결정할 예정.

**Why:** 지금 atelier 만족도의 상당 부분이 Opus 특성(하이파이 HTML 비주얼 충실도 + 적대적 검증의 냉정함)에서 나오는데, Gemini가 같을지는 미검증. 실측 전까지 특정 모델에 묶으면 안 됨.

**How to apply:**
- Gemini SDK를 코드 전반에 직접 박지 말 것. **provider 추상화 계층 필수** — `generate(prompt, schema) → 검증된 JSON` 하나의 인터페이스 뒤에 Gemini/Claude/etc를 꽂는다.
- 멀티모델 하이브리드 여지 열어둘 것: 기계적 단계는 싼 모델, hi-fi 빌드·최종 판정만 강한 모델.
- 오케스트레이션은 **LangGraph** 유력(provider 추상화·영속성·재개·관찰가능성 + atelier의 pipeline/parallel/다수결이 그래프 노드로 1:1 이식). 직접 어댑터+별도 잡 큐도 대안.

**BYO 로컬 에이전트 provider(2026-07-07) — 운영자 비용 0 노선.** provider seam에 `claude-code` 추가(`src/providers/claude-code.js`): 호스티드 API 키가 아니라 **사용자의 로컬 `claude` CLI**(`claude -p --output-format json --max-turns 1`, stdin=prompt)를 spawn. 실행이 사용자 머신·사용자 auth/구독·사용자가 고른 모델(--model 없으면 CC 기본=여기선 Opus)에서 돎 → **하네스 운영자는 API 비용 0**(DECISIONS "실행당 비용 미터링"이 로컬/셀프호스트에선 증발). supportsStructured=false(generate가 JSON추출+repair). 크로스플랫폼: `KILN_CLAUDE_BIN || (win32?'claude.exe':'claude')`, 특이 위치는 env 오버라이드.

**제품 정체성 갈림길(미결)**: 이 노선은 "호스티드 SaaS(방문자 각자 프로젝트)"와 충돌 — 서버가 원격 방문자 터미널엔 손 못 뻗음. 대신 **"로컬 우선 / BYO-에이전트 하네스"**(사용자가 이미 켜둔 Claude Code/Codex를 씀, 너는 atelier 하네스만 제공)로 피벗하는 방향. seam 덕에 **둘 다 보유 가능**(호스티드=gemini, 로컬=claude-code/codex). 사용자 비전: "나는 하네스만, 실행은 사용자 로컬 에이전트, 내 비용 0."

관련: [[kiln-roadmap]] ①이 이 전략을 실측하는 첫 단계. 웹 껍데기·주석 갤러리는 [[kiln-web-shell]].
