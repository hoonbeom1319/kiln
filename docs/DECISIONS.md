# Kiln — 결정 기록 · 아키텍처 · 로드맵

> 이 문서가 Kiln 프로젝트의 **source of truth**다. README는 남에게 보여주는 소개 페이지, 이 문서는 우리가 무엇을·왜 정했는지의 기록.
> 최초 작성: 2026-07-07 (atelier 세션에서 논의 후 kiln repo 생성).

---

## 무엇을 옮기고 무엇을 다시 짓나

atelier 자산은 두 층으로 나뉜다:

**그대로 재사용 (포터블 — 모델·플랫폼 무관)**
- `scripts/*.js` 게이트 — lint-prd, shoot(Playwright 렌더), pack-handoff, lint-handoff, test-project + `lib/`(crawl·controls·a11y). 순수 Node라 어디서 돌리든 동일한 자동 게이트.
- 산출물 규격 — 외부 의존성 없는 독립 HTML, `tokens.css` 2단 구조, handoff self-contained 패키지.
- 절차 지식 — 7단계 파이프라인, 3층 검증, 청크 진행 (프롬프트로 이식).

**다시 짜야 함 (Claude Code 전용 → 재구현)**
- `agent()` / `Workflow` / `parallel` / `pipeline` 오케스트레이션 프리미티브
- `schema` 강제 structured output (툴콜 레이어 검증·재시도)
- `.claude/agents/*.md` 서브에이전트 = "깨끗한 새 컨텍스트에서 적대적 검증" 패턴
- SKILL 호출·STATUS 기반 단계 전이

> **핵심: 근육(게이트 스크립트)과 결과물 규격은 산다. 두뇌(오케스트레이션)만 이식한다.**
> 품질을 지탱하는 자동 게이트(Playwright 1·2층, a11y, lint)는 모델을 바꿔도 그대로 물려받는다.

---

## 결정 사항 (2026-07-07)

- **대상**: 남에게 파는/공유하는 **SaaS**. 외부 사용자가 각자 프로젝트를 돌린다.
- **모델**: 우선 **Gemini API**(크레딧 보유)로 개발. 단 **모델 교체 가능**해야 한다 — POC 돌리며 단계별로 갈아탈지 결정.
  - → **provider 추상화 계층 필수.** `generate(prompt, schema) → 검증된 JSON` 하나의 인터페이스 뒤에 Gemini/Claude/etc를 꽂는다. Gemini SDK를 코드 전반에 직접 박지 않는다.
  - → 멀티모델 하이브리드 여지: 기계적 단계는 싼 모델, hi-fi 빌드·최종 판정만 강한 모델.
- **오케스트레이션**: **LangGraph** 유력 — provider 추상화·영속성·재개(resume)·관찰가능성을 얻고, atelier의 pipeline/parallel/다수결/"리디자인 1회"가 그래프 노드로 거의 1:1 이식. (직접 100줄 어댑터 + 별도 잡 큐도 대안.)

## Gemini 품질에 대한 열린 질문 (미결)

- 지금 만족도의 상당 부분은 **Opus 특성**(하이파이 HTML의 비주얼 충실도 + 적대적 검증의 냉정함)에서 나온다.
- Gemini가 "같을지"는 추측 불가 → **A/B로 실측한다** (로드맵 ①). atelier `_fixture` 픽스처 활용.

## SaaS라서 새로 생기는 실물 과제

1. **샌드박싱** — 생성 HTML + 헤드리스 Chromium 렌더를 테넌트별 격리(브라우저 풀/컨테이너).
2. **실행당 비용 미터링** — forge 한 방 = 수십 모델콜 + 렌더 + 검증. run당 원가를 재고 요금 반영.
3. **스토리지** — `projects/<name>/` 로컬 FS → 테넌트 격리 오브젝트 스토리지(S3류). atelier 스크립트가 상대경로 기반이라 이식 용이.
4. **잡 큐 + 진행 스트리밍** — 몇 분~십몇 분짜리 long-running job을 SSE/WebSocket로 phase 진행 스트리밍.

---

## 로드맵 — 가장 위험한 가정을 먼저 죽인다

1. **① Gemini 품질 A/B (첫 삽)** — GO/NO-GO 게이트. atelier `_fixture` 픽스처로 같은 PRD를 Gemini판 vs Opus판 hi-fi로 뽑아 `design-verifier` 점수로 비교. **이 A/B 하네스를 provider 추상화 계층으로 짜서 그대로 프로덕션 모델 스위처로 승격** — 버리는 코드 0.
2. **② 오케스트레이터 LangGraph 포팅** — forge-plan/forge-design을 그래프 노드로. 게이트 스크립트(lint-*, shoot, Playwright)는 그대로 node 호출로 노드 안에 박음.
3. **③ 웹 얇게** — 잡 큐 + 진행 스트리밍 + 테넌트 스토리지 격리.

---

## 진행상황 로그

- **2026-07-07** — kiln repo 생성(atelier 형제 폴더, git init). 이름 확정: **Kiln**(atelier에서 빚고 kiln에서 굽는다). README(소개)·docs/DECISIONS(이 문서)·.claude/memory 씨앗 작성. **다음: kiln 폴더에서 새 Claude 세션 열고 로드맵 ①(Gemini 품질 A/B, provider 추상화 계층) 착수.**
- **2026-07-07** — 로드맵 ① 착수: **provider 추상화 계층 + Gemini 품질 A/B 하네스** 골격 구현. GitHub `hoonbeom1319/kiln` 원격 연결(main).
  - `src/`: `generate(prompt,{schema}) → 검증된 JSON` 단일 인터페이스. `MODELS` 표(config.js)에서만 모델 id를 관리 → 모델 교체는 표 한 줄. providers = echo(오프라인 목)·gemini(`@google/genai`)·claude(`@anthropic-ai/sdk`), SDK는 사용 시점에만 동적 import. 스키마 검증·repair-retry·`.env` 로더·JSON 추출기 모두 **의존성 0**(오프라인 dry-run은 `npm install` 없이 동작).
  - `harness/`: atelier `_fixture` PRD/flow/tokens 로드 → variant별 hi-fi BUILD → 공유 심판 JUDGE(design-verifier render-check 7항목 이식) → ok-rate 점수 → `runAB()`가 build→judge→compare→**GO/NO-GO** 리포트를 `runs/<stamp>/`에 기록. CLI: `node bin/ab.js`.
  - 검증: `node bin/ab.js`(echo,echo) 오프라인 end-to-end 통과(fixture→build→judge→score→report). 상세: [`HARNESS.md`](HARNESS.md).
  - **다음: 실키(GEMINI/ANTHROPIC) 넣고 `--variants gemini-pro,opus`로 실측 → GO/NO-GO 판정. 이후 로드맵 ②(LangGraph 포팅) — 이 `generate()`가 노드 모델 프리미티브.**
- **2026-07-07 (오후)** — 방향 전환: **Gemini만으로 MVP 착수**(Opus vs Gemini 정식 게이트는 Claude 결제 후로 유보). 목적 = 주변 사람에게 "아이디어→기획→디자인→handoff" SaaS 흐름을 체험시키기. 결정: 런타임 API 비용은 무시 가능(run당 센트~$1대) → **슬림 4단계 + 공짜 게이트**로 먼저 끝까지 돌리고, 풀 forge(다수결·리디자인·trend·market)는 나중에 노드 추가로 승격(버리는 코드 0). 전달=로컬/화면공유 먼저, 진행표현=SSE 스트리밍(엔진에 emit seam 심어둠).
  - **헤드리스 forge 엔진 완성**(`pipeline/`): idea → **PRD**(lint-prd 게이트, 1회 자동개정) → **Design**(tokens.css + 00-flow.md + hi-fi 화면 + design-verifier 독립검증) → **Handoff**(4종 문서 결정론적 생성 + pack-handoff + lint-handoff). stage 조립식 → **무인 `bin/forge.js` + 수동 `bin/plan.js`·`bin/design.js`가 같은 stage 공유**.
  - 게이트: atelier 포터블 스크립트를 `scripts/*.cjs`로 복사(kiln/projects/ 사용). hi-fi 빌드는 HTML-in-JSON이 flash에서 깨져 **구분자(`<<<FILE>>>`) 포맷**으로 교체(양 모델 견고). 멀티모델 하이브리드 확정: **빌드=flash(싸고 빠름), 최종 판정=pro**(flash 심판은 화면 환각·오탐 → design.js에서 pro 기본 + reconcile 가드).
  - 실 Gemini 검증 통과: `forge "사내 점심 투표 앱"` → PRD lint PASS · hi-fi 4화면(각 15~22KB, box-shadow/gradient/토큰 166곳, 진짜 hi-fi) · **handoff lint-handoff PASS(self-contained)**. design-verifier는 deadControl로 FAIL(정확한 지적, 데모는 advisory로 계속). 상세 [`HARNESS.md`](HARNESS.md)·`pipeline/`.
  - **다음: SSE 스트리밍 웹 껍데기(입력→진행→결과 갤러리, 로컬·무인증) → 친구 반응 → 값어치 있으면 풀 게이트 노드 추가.**
- **2026-07-07 (저녁)** — **SSE 스트리밍 웹 껍데기 착수·기동**(로드맵 ③ 첫 수직 슬라이스). 스택 = **Next.js 15 + FSD**(App Router, `conventions.md` SSOT). 착수 직전 컨벤션에서 `src/` 래퍼 제거 → FSD 레이어를 **repo 루트 직속**(`application/`·`app/`·`screens/`·`widgets/`·`features/`·`entities/`·`shared/`·`server/`)에 두고 엔진(`src/`)·`pipeline/`·`harness/`와 공존. `@/*` alias = repo 루트. **엔진 churn 0.**
  - **emit seam 그대로 물림**: `server/forge/job-registry.ts`가 `createReporter`로 `forge()` 실행 → 이벤트 **버퍼링 + SSE 구독자 fan-out**(인메모리, 무인증, 무영속 — 로컬 데모 범위). `server/controllers/forge-controller.ts`가 유일 진입점(§9). BFF: `POST /api/forge`(job 시작), `GET /api/forge/[id]/stream`(SSE — 버퍼 replay + 라이브 + done/error에 close, seq dedupe·순서보장), `GET /api/projects/[...path]`(산출물 서빙, path-traversal 가드). 전부 `runtime='nodejs'`.
  - 클라(FSD): `entities/job`(계약타입·`use-job-stream` EventSource hook·mutation) → `features/forge-run`(입력폼) → `widgets/progress-stream`(라이브 피드, CLI 어휘 1:1)·`widgets/result-gallery`(done 시 handoff `index.html` iframe) → `screens/forge` 조립. TanStack Query·Zustand 경계 준수.
  - **검증(브라우저 end-to-end)**: `npm run dev` → 입력→POST→SSE 진행 스트리밍이 실시간 렌더(phase/step/model/gate/warn/artifact/terminal), 상태 pill, 한글 UTF-8 정상, 콘솔 에러 0. 산출물 서빙(`lunchvote/handoff/index.html`, `text/html`)·traversal 404 가드 확인. echo(오프라인)는 hi-fi build의 `<<<FILE>>>` 포맷을 못 만들어 build에서 종료 → **초기단계 스트리밍 검증용**, 완주 갤러리는 실 Gemini 필요(엔진에서 기검증).
  - **다음: 실 Gemini 완주 데모(갤러리 iframe까지) → 친구 반응. 이후 로드맵 ② LangGraph 포팅 또는 풀 게이트 노드 승격.**
- **2026-07-07 (밤)** — 실 Gemini **완주 데모(웹 경유)**: `사내 점심 투표 앱` → PRD lint PASS · hi-fi 4화면(index/login/past_votes/suggest_menu, 10~22KB 진짜 hi-fi) · handoff PASS, 브라우저 갤러리 확인(약 3분). 웹 SSE 껍데기가 실 파이프라인을 산출물까지 완주시킴을 실증.
  - **제품 방향 결정 — 반복 고도화는 "프로젝트 스코프 채팅형"으로 간다(화면별 수정 아님).** 이유(사용자): 화면 단위 수정은 **전체 디자인 변경·교차 화면 일관성**에서 어긋난다 — design coherence는 **전역 속성**(tokens·컴포넌트·흐름이 화면을 가로지름). 채팅이 프로젝트 전체 컨텍스트를 쥐고 있어야 revise가 일관성을 지킨다.
    - → 엔진 `revise(ctx, feedback, history)`는 '한 화면 재생성'이 아니라 **전역 컨텍스트 인지 재생성**: 피드백을 받아 무엇이 바뀌어야 하는지(전역 토큰? 특정 화면? 여러 화면?) 판단하고, **영향받은 산출물만 write하되 나머지와 일관되게** 재생성. 새 **버전**으로 쌓아 비교·롤백.
    - → 부수 결정 **PRD↔화면 traceability**: '이 화면이 PRD의 어느 내용을 반영했나' 매핑을 만든다. 같은 데이터를 **이중 활용** — (a) 갤러리에서 화면 옆 주석(사용자 요청), (b) revise가 "요구사항 추가/변경 시 어느 화면을 동기화할지" 판단하는 근거.
  - **PRD↔화면 traceability + 주석 갤러리 구현·검증(2026-07-07 밤)**: designStage 끝에 pass 추가 — PRD + 빌드된 화면(file·title) → `generate(schema)`로 화면당 `reflects` 1~2줄(한글, 근거 기반) → `projects/<name>/traceability.json`(빌드된 화면과 reconcile, 스트리밍됨). 웹: `entities/job`에 fetchTraceability+`useTraceability`(queryOptions, staleTime∞), `widgets/result-gallery`를 **화면별 iframe + "PRD 반영" 주석** 그리드로 교체(traceability 없으면 handoff/index.html로 폴백). 검증: `사내 점심 투표 앱`에 flash 1콜로 backfill → 4화면 근거 있는 주석, 브라우저 렌더·콘솔 0. **부수(②·① 조각): `?project=<name>` 재열기** — 라이브 job 없이 과거 프로젝트 갤러리 열기(세션 재열기의 down payment).
  - **다음: ① 세션 영속(projects/<name>/에 대화 스레드+버전+이벤트로그 저장, 홈 목록·재열기 정식) → ② 채팅형 revise 엔진(전역 컨텍스트 인지 재생성 + 버전). traceability는 이미 revise 동기화 근거로 준비됨.**

---

## 참조

- 원본 하네스: [`../atelier`](../atelier) — `CLAUDE.md`(형식·품질 규칙), `.claude/skills/{forge,plan,design}/SKILL.md`(공정 절차), `.claude/workflows/`(forge-plan·forge-design 오케스트레이션 참고), `scripts/`(포터블 게이트).
