---
name: kiln-model-strategy
description: Kiln의 모델·오케스트레이션 전략 — 로컬 우선 BYO-에이전트로 피벗(Gemini 제거)
metadata:
  type: project
---

**제품 정체성 확정(2026-07-07 밤5): "로컬 우선 / BYO-에이전트 하네스".** Gemini를 **완전히 걷어내고**, 사용자의 로컬 코딩 에이전트(**claude-code · codex**)를 1급 실행 경로로 삼는다. 운영자는 하네스만 제공, 실행은 사용자 머신·구독·모델 → **운영자 비용 0**.

**왜 로컬이어야 하나(사용자 질문에서 판가름)**: "SaaS인데 왜 사용자 로컬 터미널을 못 여나?" → **브라우저 보안 모델상 불가**. klin.com 서버는 방문자와 다른 머신이고, 브라우저 JS는 샌드박스라 로컬 프로세스 실행 불가. vscode.dev가 터미널 붙이는 것도 마법이 아니라 Codespaces(클라우드 VM, 비용 있음) 또는 Remote Tunnel(사용자가 로컬 데몬 선실행)일 뿐. **삼각 트레이드오프**: `설치 없음`·`로컬 실행(비용 0)`·`호스티드 URL` — 셋 중 둘만 가능. seam 덕에 **둘 다 낸다**: klin.com=호스티드(체험, 운영자 API 비용) + `npx kiln`/앱=로컬(비용 0). "실행 위치(로컬)"와 "배포 형태(clone/npx/앱/데몬)"는 **별개 축**.

**구현됨(엔진 코어)**: `providers/gemini.js` 삭제·config에서 `gemini-*` 제거·파이프라인/bin/web 기본 모델 → `claude-code`. **멀티모델 하이브리드(싼 빌드/강한 판정) 폐기** — 로컬 단일 구독엔 싼 티어 없음, 한 에이전트가 build·judge·plan 전 역할. `engine/model/agents.js` `detectAgents()`(크로스플랫폼 PATH 탐지 + `--version`), `agent-cli.js`(공유 spawn, win32 shell:true로 .cmd), `providers/codex.js`(`codex exec --json` JSONL 파싱). 웹: `GET /api/agents`→`features/agent-picker`(감지된 것만, 자동선택)→forge/revise에 선택 alias 전달. **검증**: claude(2.1.202)·codex(0.112.0) 감지, 웹 forge가 claude-code(로컬 Opus)로 완주(PRD 205줄). **codex는 이 계정 ChatGPT 플랜이 어떤 codex 모델도 미지원 → provider가 에러 깔끔히 표면화**(사용자 플랜 이슈). 상세 `docs/DECISIONS.md` 밤5. 배포 포장(npx→앱→데몬)이 다음.

---
아래는 피벗 이전 맥락(보존):

Kiln은 **Gemini API**로 먼저 개발한다(사용자가 Gemini 크레딧 보유). 단 **모델 교체 가능성이 최우선 설계 제약** — POC 돌리며 단계별로 다른 모델(Claude 등)로 갈아탈지 결정할 예정.

**Why:** 지금 atelier 만족도의 상당 부분이 Opus 특성(하이파이 HTML 비주얼 충실도 + 적대적 검증의 냉정함)에서 나오는데, Gemini가 같을지는 미검증. 실측 전까지 특정 모델에 묶으면 안 됨.

**How to apply:**
- Gemini SDK를 코드 전반에 직접 박지 말 것. **provider 추상화 계층 필수** — `generate(prompt, schema) → 검증된 JSON` 하나의 인터페이스 뒤에 Gemini/Claude/etc를 꽂는다.
- 멀티모델 하이브리드 여지 열어둘 것: 기계적 단계는 싼 모델, hi-fi 빌드·최종 판정만 강한 모델.
- 오케스트레이션은 **LangGraph** 유력(provider 추상화·영속성·재개·관찰가능성 + atelier의 pipeline/parallel/다수결이 그래프 노드로 1:1 이식). 직접 어댑터+별도 잡 큐도 대안.

**BYO 로컬 에이전트 provider(2026-07-07) — 운영자 비용 0 노선.** provider seam에 `claude-code` 추가(`src/providers/claude-code.js`): 호스티드 API 키가 아니라 **사용자의 로컬 `claude` CLI**(`claude -p --output-format json --max-turns 1`, stdin=prompt)를 spawn. 실행이 사용자 머신·사용자 auth/구독·사용자가 고른 모델(--model 없으면 CC 기본=여기선 Opus)에서 돎 → **하네스 운영자는 API 비용 0**(DECISIONS "실행당 비용 미터링"이 로컬/셀프호스트에선 증발). supportsStructured=false(generate가 JSON추출+repair). 크로스플랫폼: `KILN_CLAUDE_BIN || (win32?'claude.exe':'claude')`, 특이 위치는 env 오버라이드.

**제품 정체성 갈림길(미결)**: 이 노선은 "호스티드 SaaS(방문자 각자 프로젝트)"와 충돌 — 서버가 원격 방문자 터미널엔 손 못 뻗음. 대신 **"로컬 우선 / BYO-에이전트 하네스"**(사용자가 이미 켜둔 Claude Code/Codex를 씀, 너는 atelier 하네스만 제공)로 피벗하는 방향. seam 덕에 **둘 다 보유 가능**(호스티드=gemini, 로컬=claude-code/codex). 사용자 비전: "나는 하네스만, 실행은 사용자 로컬 에이전트, 내 비용 0."

관련: [[kiln-roadmap]] ①이 이 전략을 실측하는 첫 단계. 웹 껍데기·주석 갤러리는 [[kiln-web-shell]].
