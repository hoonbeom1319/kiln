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
- **2026-07-07 (밤2) — BYO 로컬 에이전트 provider: 운영자 비용 0 노선(사용자 아이디어).** 세션 영속을 잠깐 세우고 스파이크. provider seam에 **`claude-code`** 추가 — 호스티드 API 키 대신 **사용자의 로컬 `claude` CLI**를 spawn(`claude -p --output-format json --max-turns 1`, stdin=prompt, result/usage 파싱). 실행이 사용자 머신·auth·구독·모델(기본=CC 기본=Opus)에서 돎 → **하네스 운영자 API 비용 0**. `src/providers/claude-code.js`(supportsStructured=false) + config `claude-code` alias + providers/index 등록. 크로스플랫폼 `KILN_CLAUDE_BIN||(win32?claude.exe:claude)`.
  - 검증: `generate('…',{model:'claude-code'})` 단발 통과(provider=claude-code, "김치찌개, 제육볶음, 냉면", input 2973/output 19). 호출당 캐시생성/읽기 토큰 큼(~$0.15어치) — Claude Code가 무거운 시스템 컨텍스트를 매 호출 로드하지만 **사용자 구독**에 얹혀 운영자 비용엔 안 잡힘.
  - **제품 정체성 갈림길**: 이 노선은 "호스티드 SaaS(방문자 각자)"와 충돌(서버가 원격 방문자 터미널에 손 못 뻗음) → **"로컬 우선/BYO-에이전트 하네스"**로 피벗. seam 덕에 호스티드=gemini / 로컬=claude-code(·codex) **병존 가능**. 사용자 비전: "나는 atelier 하네스만, 실행은 사용자 로컬 에이전트, 내 비용 0."
  - **실측 결과(로컬 Opus vs Gemini, 같은 아이디어)**: `lunchvote-opus`(claude-code) 웹 완주(~7.8분) vs `proj-20260707-142306`(gemini, ~3분). **로컬 Opus 압승** — design-verifier **1 ng(create:deadControl)** vs Gemini 6 ng/3화면; 화면 구성이 로그인 빼고 핵심 투표 흐름(홈→만들기→투표→결과)으로 응집; 비주얼(다크+오렌지 브랜드·이모지 카피·카운트다운·득표 시각화)·traceability(흐름 참조·MVP 스코핑·접근성 "색만으로 정보전달 금지")까지 전부 위. **비용 0인데 품질 우위** → DECISIONS가 유보했던 "Opus vs Gemini 게이트"가 결제 없이 판가름(로컬 Opus). 트레이드오프: ~2.5배 느림 + 호출당 CC 시스템 컨텍스트 로드가 무거움(사용자 구독 부담).
  - **→ "로컬 우선/BYO-에이전트 하네스" 노선 설득력 확보.** 다음: provider 커밋 → 세션 영속(①) 재개. 제품 정체성(로컬 vs 호스티드)은 seam으로 병존 가능하니 계속 열어둠.
- **2026-07-07 (밤3) — 세션 영속(①) 완료 + 엔진 `/engine` 재배치.** 먼저 "세션" 개념 정리: **제품의 프로젝트 세션**(idea·status·버전·이벤트)과 **Claude Code 터미널 세션**(개발자 대화)은 별개다. `claude-code` provider가 로컬이라 실행이 사용자 머신에서 돌아도(그것도 `--max-turns 1` 무상태 단발), 제품이 프로젝트를 기억하는 건 자동이 아니라 **별도 기능**. → ① 구현.
  - **① 세션 영속**: `server/forge/session-store.ts`(`writeSession` merge+createdAt 보존·`readSession`·`listSessions`) → `projects/<name>/session.json`(name·idea·status·createdAt·updatedAt·screenCount, 완료 시 events). session.json 없는 옛 프로젝트는 **합성**(idea.txt·handoff/index.html 유무로 status·dir stat로 시각·handoff|screens html count). `project-controller`(유일 진입점 §9) → BFF `GET /api/projects`(기존 `[...path]` 산출물 라우트와 세그먼트 공존). job-registry가 start/done/error에 best-effort writeSession. 클라: `entities/project`(SessionMeta·useSessions) → `widgets/session-list`(홈 목록: idea·status pill·상대시각·화면수·`?project=` 링크·빈 상태) → `screens/forge`(idle→목록, reopen→갤러리+"← 목록"). **검증**: 브라우저 e2e(목록 9개·합성 정확·재열기 4화면 traceability·콘솔 0), 라이프사이클 running→error 파일(createdAt 보존·events 영속).
  - **버그 fix(.gitignore)**: 미앵커 `projects/`가 `app/api/projects/`까지 무시 → 기존 `[...path]/route.ts`가 여태 **untracked**였음. `/projects/`·`/runs/` 루트 앵커로 수정, 라우트 복구.
  - **엔진 `/engine` 재배치(별도 커밋)**: 루트가 15개 dir로 평평 → 엔진 JS를 `engine/`로 묶어 **엔진/웹/데이터 경계를 루트에서 가시화**. `src`→`engine/model`(generate·config·provider·schema + `providers/` 어댑터. `src`는 모호했고 안에 `providers/`가 있어 `model`이 맞음), `pipeline`→`engine/pipeline`, `harness`→`engine/harness`. **`bin`·`scripts`는 루트 유지**(npm bin 관례·공용 게이트, 엔진을 상대경로 참조). **이는 [[kiln-web-shell]]의 "엔진 churn 0" 원칙을 의식적으로 되돌린 것** — 웹 착수 땐 churn 0이 옳았고, 웹이 안정된 지금은 명료성이 이김. churn 실측: 웹 `@/pipeline`→`@/engine/pipeline` 3파일·bin 상대경로·엔진 내부 `../src`→`../model`뿐(경로는 전부 cwd 상대라 scripts/runs/projects/.env 무영향). 검증: `tsc`(신규 에러 0, 기존 forge JSDoc 1건만)·`npm run ab:dry` PASS·웹 list/reopen 200·브라우저 렌더.
  - **다음: ② 채팅형 revise 엔진**(전역 컨텍스트 인지 재생성 + 버전). traceability·session events는 이미 준비됨.
- **2026-07-07 (밤4) — ② 채팅형 revise 엔진 완성 (엔진 + 웹 chat UI + 버전/롤백), 실 Gemini로 브라우저 e2e 검증.** 화면 단위 수리공이 아니라 **프로젝트 전체 맥락을 쥔 개정**: 자연어 피드백 → **plan(범위 판단)** → 영향 산출물만 재생성하되 나머지와 일관 → **새 버전 스냅샷**으로 쌓아 비교·롤백.
  - **엔진(Wave 1)** — 스테이지 1개(`engine/pipeline/stages/revise.js`)를 CLI(`bin/revise.js`)·웹 레지스트리가 공유(다른 스테이지와 동일 원칙):
    - **plan(gemini-pro, schema)**: 전체 컨텍스트(PRD·flow·tokens·전 화면+traceability) + 대화 이력을 받아 `{scope:{prd,tokens,flow}, screens[], guidance}` 판단. **코히런스 규칙은 apply가 강제**(plan 표현 무관): `tokens=true ⇒ 전 화면 재빌드`(화면이 토큰 인라인), `flow ⇒ 화면셋 재조정`, 그 외 ⇒ 지목 화면만 + **형제 화면 HTML을 레퍼런스로** 줘 시각 언어 일치.
    - **incremental 개정**: PRD·tokens·flow는 처음부터 새로 쓰지 않고 **기존을 보존하며 필요한 부분만**(tokens는 semantic 이름 유지 → 화면 참조 안 깨짐). PRD 개정 시 lint-prd 재실행.
    - **coherent subset rebuild**(`build-screens.js` `buildRevised`): 대상 화면의 **현재 HTML을 base**로, 형제를 레퍼런스로 재생성. traceability 갱신 + **handoffStage 재호출**(멱등 pack/lint)로 갤러리·handoff 동기화.
    - **버전(`engine/pipeline/versions.js`)**: `versions/v<N>/`에 **풀 스냅샷**(diff 아님 — 로컬/MVP는 명료성>공간), `revisions.json`={head, entries[]}가 **채팅 스레드 겸 버전 로그**. `ensureBaseline`(첫 개정 전 v1 보존)·`commitRevision`(개정 후 v(N+1))·`rollback`(과거 버전 복원 후 **새 head로 스택 — 비파괴 선형 이력**).
  - **버그 2건(실 Gemini 첫 런에서 발견·수정)**: ① **gemini-2.5-flash/pro 둘 다 thinking 모델** — `maxOutputTokens`가 빠듯하면 thinking이 예산을 먹고 **visible 출력이 truncate**(tokens.css가 13줄에서 잘림, plan JSON "Unterminated string"). → plan 8000·tokens/flow 8000으로 headroom 상향. ② **한 generate가 큰 hi-fi 화면 N개를 다 못 뱉음**(4개 요청 → 3개만, 1개 옛 테마 잔존 = 코히런스 깨짐). → **완결성 루프**(누락 화면 채울 때까지 재요청, **새로 만든 화면을 레퍼런스로 추가** → 늦은 화면도 새 룩에 일치). ③ 견고한 `stripFence`(열림/닫힘 펜스 독립 제거 — 잘린 펜스가 tokens.css 오염 방지).
  - **웹(Wave 2)** — forge 스트림 인프라 **그대로 재사용**: `startRevise`/`startRollback`이 같은 emit seam으로 job 생성 → **기존 `/api/forge/[id]/stream`으로 스트리밍**. 신설 `revision` 이벤트(`{version,note,changed,feedback}`) 3곳(events.js·server/types·entities/job) 선언. BFF `POST /api/forge/revise`·`/rollback`(202→job id). 스레드는 엔진 소유 `revisions.json`을 **기존 `/api/projects/[...path]`로 서빙**(컨트롤러 불필요). 클라: `entities/job`에 revise/rollback mutation+`useRevisions` → `features/revise-chat`(채팅 입력) → `widgets/revise-thread`(버전별 chat 버블+칩+**되돌리기 버튼**) → `screens/forge` **2모드**(생성 / 갤러리+개정). 개정 done 시 traceability·revisions 쿼리 무효화 + iframe `?v=refreshKey` 캐시버스트로 **갤러리 in-place 갱신**.
  - **검증(브라우저 e2e, 실 Gemini)**: `revise-test`(lunchvote 사본)에 ⑴ **전역 토큰 개정**("다크+오렌지") → plan `tokens=true` → 4화면 전부 다크 재빌드(semantic 매핑 `bg→gray-900`·`text→gray-50`·`primary→orange`, 2패스 완결성 루프가 누락 보완), ⑵ **화면-스코프 개정**("index 버튼 문구") → plan `screens=[index.html]`만 → index만 재빌드·**형제 3화면 v2와 바이트 동일**·다크 보존, ⑶ **롤백 v1** → 라이트 원본 복원(traceability 부재까지 충실 → 갤러리 packaged 폴백으로 우아하게 강등). tsc 0·ab:dry PASS·콘솔 0·게이트 PASS. v1(라이트)→v2(다크)→v3(버튼)→v4(rollback) 선형 스택.
  - **다음 후보**: revise에 design-verifier 재판정(현재 생략—속도 우선)·버전 시각 diff(compare UI)·`--max-turns` 대신 로컬 claude-code로 개정 완주·풀 게이트 노드 승격. 관련 [[kiln-web-shell]]·[[kiln-mvp-pipeline]].
- **2026-07-07 (밤5) — 제품 정체성 확정: "로컬 우선 / BYO-에이전트 하네스"로 피벗. Gemini 걷어내고 사용자 로컬 에이전트(claude-code·codex)를 1급으로.** 계기: "SaaS인데 왜 사용자 로컬 터미널을 못 여나?" → **브라우저 보안 모델상 불가**(서버는 다른 머신, 브라우저 JS는 샌드박스). vscode.dev도 마법이 아니라 Codespaces(클라우드 VM) 또는 Remote Tunnel(로컬 데몬 선실행)일 뿐. **삼각 트레이드오프**: `설치 없음`·`로컬 실행(비용 0)`·`호스티드 URL` 셋 중 둘만. 결론 = seam으로 **둘 다**: klin.com=호스티드(체험, 운영자 비용) + `npx kiln`/앱=로컬(비용 0). "실행 위치(로컬)"와 "배포 형태(clone/npx/앱/데몬)"는 **별개 축** — 로컬 실행을 고정해도 배포 UX는 개선 가능.
  - **엔진 코어(이번 슬라이스 — 모든 배포 형태가 공유)**:
    - **Gemini 완전 제거**: `providers/gemini.js` 삭제, config MODELS에서 `gemini-*` 제거, 파이프라인·bin·job-registry 기본 모델 `gemini-flash|pro` → **`claude-code`**. **멀티모델 하이브리드(싼 빌드/강한 판정) 폐기** — 로컬 단일 구독엔 싼 티어가 없다. 선택한 에이전트 하나가 build·judge·plan 전 역할. (opus/sonnet 호스티드 alias·echo는 유지 — A/B·오프라인용)
    - **로컬 에이전트 감지**: `engine/model/agents.js` `detectAgents()` — 크로스플랫폼(win `where`·`codex.cmd`/`claude.exe`, unix `command -v`) PATH 탐지 + `--version` 확인. 감지된 것만 UI 노출. `engine/model/agent-cli.js`(공유 spawn: win32 shell:true로 .cmd 시밍, 실패 시 stdout을 에러에 실어 provider가 파싱).
    - **codex provider**(`providers/codex.js`): `codex exec --json --sandbox read-only -`(stdin), JSONL 이벤트 스트림 파싱(item.* agent message·turn.completed usage·error/turn.failed detail). system은 프롬프트에 prepend(codex엔 --append-system-prompt 없음). claude-code는 공유 헬퍼로 리팩터.
  - **웹**: BFF `GET /api/agents`(감지 목록) → `entities/agent`(useAgents) → `features/agent-picker`(감지된 것만, 첫 available 자동선택, 미설치 grey) → `screens/forge` 2모드 헤더에 셀렉터, 선택 alias를 forge/revise에 `model`로 전달(judge/planner도 같은 에이전트).
  - **검증(이 머신, 실측)**: claude(2.1.202)·codex(0.112.0) **둘 다 감지**. `generate(claude-code)` 단발 정상("김치, 된장, 고추장"). **웹 forge(claude-code) end-to-end**: UI 셀렉터→`POST /api/forge {model:claude-code}`→엔진이 로컬 claude 구동→스트림 "prd via claude-code (5203 out tok)"→205줄 PRD "책갈피" 작성→lint-prd 게이트→개정 패스. tsc 0·ab:dry PASS·`/api/agents` 200. **codex는 code-complete지만 이 계정이 ChatGPT 플랜에서 어떤 codex 모델도 미지원**("not supported when using Codex with a ChatGPT account") → provider가 그 메시지를 깔끔히 표면화(크래시 아님). 사용자 플랜 해결 시 동작.
  - **다음(배포 포장 — 코어 위에 순차)**: `npx kiln`(글로벌 CLI, 최저 마찰·높은 도달) → 데스크톱 앱(Electron) → 로컬 데몬 + klin.com 웹UI(VS Code Remote Tunnel 패턴). git clone은 이미 됨(개발자 최저 단계). 관련 [[kiln-model-strategy]]·[[kiln-web-shell]].
- **2026-07-10 — 아키텍처 방향 확정: C2("엔진 척추 + 실행만 agentic"). 컨셉 = 터미널 atelier를 웹에서 재탄생.** 배포(0.0.3) 후 엔진 고도화 탐색에서, 현재 `claude-code` provider가 `--max-turns 1` **단발 생성기**라 atelier의 핵심 품질 레버(**렌더-인-루프 자가수정**)를 잃은 상태임을 확인 → 방향 재설계.
  - **탐색에서 드러난 사실**:
    - **shoot(Playwright 렌더 게이트)가 미이식.** DECISIONS엔 "포터블 재사용"으로 적었으나 실제 `scripts/`엔 `lint-prd`·`pack-handoff`·`lint-handoff` 3개뿐. **design-verifier는 모델이 HTML *텍스트*를 읽는 판정 — 픽셀을 안 본다.** atelier hi-fi 우위(비주얼 충실도)의 핵심을 잃음.
    - **harness/ 잔재.** `ab.js`·`build.js`·`score.js`·`fixture.js`는 로드맵①(Gemini GO/NO-GO)용이었으나 로컬 피벗으로 **목적 소멸**. `bin/ab.js`(ab:dry echo 스모크)로만 도달. `build.js`는 폐기된 HTML-in-JSON 포맷 중복, `fixture.js`는 `../atelier` 커플링. (judge.js·schemas·prompts는 파이프라인이 공유 — 살아있음)
    - **LangGraph(로드맵②) 사실상 무효.** 팔던 것(provider추상화·관찰가능성·영속성) 대부분 직접 구현 완료. 멀티모델·다수결(주 용도)은 로컬 피벗이 폐기. 유일 갭=재개(~50줄) — 프레임워크 도입 사유 아님.
  - **결정 — (C2) 확정**: Claude 전용을 1급으로 갈아끼우되, **Node 엔진이 순서·게이트(척추)를 계속 소유**하고 각 스테이지 실행만 `--max-turns 1` → **툴(Playwright) 멀티턴 CC 에이전트**로 위임(자가수정). = atelier의 *능력*을 kiln의 *척추* 위에서.
    - **C1 기각**(엔진 삭제, 오케스트레이션을 CC skill/workflow로 = atelier 문자 그대로 이식): codex/gemini엔 그 프리미티브가 없어 **"모델 하나씩 추가"를 죽이고** provider seam(크라운주얼)을 버림. C2는 SSE seam 유지·게이트 단단·확장 점진.
    - **모델 확장은 claude 완성 → codex → gemini** 순서로, 같은 스테이지 계약 뒤 **단발 폴백 provider**로 하나씩.
  - **청사진(C2)**:
    1. seam에 `supportsAgentic` 플래그(+`claude-code.js`의 `supportsStructured` 옆).
    2. `generate()`의 형제 `runAgentic(task,{tools,maxTurns})`. claude-code=`claude -p --output-format stream-json`(멀티턴+Playwright). codex/echo 미구현 → **단발 `generate` + 외부 게이트로 폴백**.
    3. **shoot 부활 = 최대 레버.** 두 소비자: agentic 빌드가 루프 중 부르는 **툴** + 폴백 경로의 **외부 게이트**. 스크립트 1, 용처 2.
    4. 스테이지 = "agentic 우선, 단발 폴백". 큰 승부 = **hi-fi 빌드 + design-verify를 렌더-인-루프**로.
    5. **웹 SSE seam 불변** — 엔진이 phase/step/gate/artifact emit, agentic 콜은 turn/tool-call 서브이벤트를 얹어 스트리밍.
  - **착수 순서**: ① shoot를 외부 게이트로 부활(아키 변경 0, 픽셀검증 즉시 복귀 — 가장 작은 순수 이득) → ② `runAgentic`+claude-code stream-json + hi-fi 빌드 agentic화(shoot=툴) → ③ design-verify(적대적 서브에이전트)·revise로 확산 → ④ codex/gemini 단발 폴백 provider.
  - **리스크(선반영)**: Playwright/chromium 패키징(`npx kiln` 사용자 `playwright install` 부트스트랩 — 채택 마찰) · 멀티턴 툴루프 비용·속도(turn/budget 캡 필수) · stream-json→SSE 매핑 · **게이트는 엔진 강제 유지**(에이전트 자율에 안 맡김).
  - **후속 정리**: best-of-N(#3)·auto-rework(#1)은 **agentic 자가수정이 흡수** → harness 잔재는 "승격"이 아니라 **retire/정리** 대상. 상세 [[kiln-c2-agentic]].
- **2026-07-10 (착수 ① 완료) — shoot 렌더 게이트 부활. 아키 변경 0, 픽셀검증 즉시 복귀.** C2 착수순서 ①을 그대로 이행: atelier `shoot.js`를 kiln 게이트 계약에 맞춰 포터블 이식하고 design 스테이지에 외부 게이트로 연결. **끝까지 실제로 돌려 검증**.
  - **이식(`scripts/shoot.cjs`)**: 원본은 `<project> <relDir> [WxH]`·PNG 경로 stdout 나열이었으나, **kiln 게이트 계약(runGate는 단일 인자 `<project>`만 전달, gateSummary가 ✅/⚠️/❌ 파싱)**에 맞춰 재작성. 단일 인자 + `KILN_PROJECTS_ROOT` 존중(lint-prd 스타일) + 대상 `screens/*.html` **자동 고정**(빌더가 화면을 항상 `screens/`에 씀, build-screens.js `<<<FILE screens/…>>>`) → `_shots/screens/*.png`.
  - **"픽셀검증"의 실체 — 결정론적 렌더 체크(모델 비용 0)**: 기존 `isBlankScreen`(design.js, HTML **소스** 판정)을 **렌더된 결과** 판정으로 승격. `page.evaluate`로 렌더된 DOM 지표(bodyH·가시요소수·innerText 길이) + PNG 헤더 폭×높이·픽셀당 바이트. 두 층: **❌ blank(하드, exit 1)** = `bodyH<200 || 가시요소<8 || 글자<30`(소스판정의 픽셀 버전) · **⚠️ near-uniform(권고)** = 픽셀당 바이트<12KB/MP(균일 압축 = 흰 화면·와이어풍 의심 휴리스틱, 강제 아님). 찍힌 PNG는 `_shots/`에 남아 **착수 ③ vision 판정의 입력** — 오늘 산출물이 다음 단계 자산.
  - **연결(`design.js`)**: 빈 화면 가드 직후·design-verifier 앞에 `runGate('shoot.cjs')` → `emit('gate', {name:'render-shoot'})` + 존재하는 PNG만 `kind:'shot'` 아티팩트로. **advisory(비차단)** — handoff/verifier와 동일(FAIL이면 warn+칩, 데모 계속·throw 없음).
  - **패키징 마찰 해소(리스크 선반영 항목)**: 발견 — **kiln엔 playwright npm 의존성이 애초에 없었다**(`.mcp.json`의 `@playwright/mcp`는 착수 ②의 agentic 툴용, 별개). 이식은 "아키 0"이나 "의존성 0"은 아님. → dev엔 `playwright` devDep + `npx playwright install chromium`. **npx 사용자엔 graceful skip**: `shoot.cjs`가 `require('playwright'||'@playwright/test')` 실패·chromium 런치 실패를 **모두 스킵으로 강등**(설치 힌트 + exit 0) → 미설치 사용자 데모 안 깨짐. 렌더 게이트 = "있으면 켜지고 없으면 조용히 빠지는" 옵트인 레이어. **자동 부트스트랩(런처 첫 실행 `playwright install`)은 착수 ②(stream-json 통합)로 이월** — 오늘은 "가장 작은 순수 이득" 범위 유지.
  - **검증(실측)**: playwright+chromium 설치 후 두 프로젝트 8화면 전부 `✅ 통과`(실 픽셀 지표, 예 `main.html — 2560×3540 · 요소 195 · 글자 543`). **blank 발화 증명**(no-op 아님): 빈 `<body>` 렌더 → `❌ 렌더 blank (h=0px, 요소=0, 글자=0)` + exit 1, 옆 정상 화면 `✅`. **graceful skip**: 설치 전 → `⚠️ 크로미움 미설치` + exit 0. `node --check` design.js·shoot.cjs 통과, `gateSummary`가 다른 게이트와 동일 한 줄로 압축. `.gitignore`에 `projects/*/_shots/`(ignore 확인).
  - **다음: 착수 ②** — `runAgentic` + claude-code `stream-json` 멀티턴 + hi-fi 빌드 agentic화(shoot=**툴**로 재사용, 오늘 만든 스크립트의 두 번째 용처) + npx 부트스트랩. 상세 [[kiln-c2-agentic]].

---

## 참조

- 원본 하네스: [`../atelier`](../atelier) — `CLAUDE.md`(형식·품질 규칙), `.claude/skills/{forge,plan,design}/SKILL.md`(공정 절차), `.claude/workflows/`(forge-plan·forge-design 오케스트레이션 참고), `scripts/`(포터블 게이트).
