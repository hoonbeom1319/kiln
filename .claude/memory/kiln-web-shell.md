---
name: kiln-web-shell
description: Kiln SSE 스트리밍 웹 껍데기(Next.js+FSD) 구조·결정 — 로드맵 ③ 첫 슬라이스
metadata:
  type: project
---

로드맵 ③(웹 얇게)의 첫 수직 슬라이스. **Next.js 15 + FSD**(App Router). `pipeline/events.js`의 emit seam을 웹이 그대로 구독해 진행을 실시간 스트리밍한다 — 엔진 무변경([[kiln-mvp-pipeline]]).

**FSD 루트 = repo 루트 직속.** 착수 직전 `conventions.md`에서 `src/` 래퍼를 제거 → `application/`·`app/`·`screens/`·`widgets/`·`features/`·`entities/`·`shared/`·`server/`를 repo 루트에 두고 엔진(`src/`)·`pipeline/`·`harness/`·`scripts/`와 공존. `@/*` alias = repo 루트(`tsconfig` paths `"@/*":["./*"]`). **엔진 개명/churn 0.**

**서버(emit seam 구독)**:
- `server/forge/job-registry.ts` — `createReporter(listener)`로 `forge()` 실행. listener가 이벤트 stamp+**버퍼링**+**SSE 구독자 fan-out**. 인메모리·무인증·무영속(서버 재시작 시 job 소멸 — 로컬/화면공유 데모 범위. 테넌트·영속은 큐+스토어로 교체).
- `server/controllers/forge-controller.ts` — **유일 진입점(§9)**. route는 컨트롤러만 호출. `openJobStream`이 버퍼 replay+구독을 동기 원자적으로(누락·중복 없음).
- 계약 타입은 `server/types/job.ts`와 `entities/job/types.ts`에 **양쪽 선언**(클라 번들에 서버코드 안 딸려오게).

**BFF(`app/api/`)**: `POST /api/forge`(job 시작→id), `GET /api/forge/[id]/stream`(SSE — 버퍼 replay + 라이브, done/error에 close, seq dedupe·순서보장, `X-Accel-Buffering:no`), `GET /api/projects/[...path]`(산출물 서빙, PROJECTS_ROOT 밖 차단). 전부 `runtime='nodejs'`+`force-dynamic`(fs·child_process 게이트·동적 SDK import).

**클라(FSD)**: `entities/job`(`use-job-stream` = EventSource hook, terminated ref로 정상 close/에러 구분) → `features/forge-run`(입력폼+start mutation) → `widgets/progress-stream`(라이브 피드, `event-row`가 CLI 어휘 1:1)·`widgets/result-gallery`(done 시 handoff `index.html` iframe) → `screens/forge`(조립, 화면이 jobId 소유+구독). `application/providers.tsx`=QueryClientProvider.

**검증됨(2026-07-07, 브라우저 end-to-end)**: 입력→POST→SSE 실시간 렌더·상태 pill·한글 UTF-8·콘솔 에러 0·산출물 서빙·traversal 404. **echo 목은 hi-fi build의 `<<<FILE>>>` 포맷을 못 만들어 build에서 종료** → 초기단계 스트리밍 검증 전용, **완주 갤러리는 실 Gemini 필요**.

**echo 접근 = API 전용.** UI엔 model 토글 없음(사용자에겐 gemini 기본, 정직한 UX). 테스트·dev는 `POST /api/forge {model:'echo'}`로 목 실행. echo 프로바이더 자체는 코어(A/B·CLI 오프라인 dry-run)라 유지 — 삭제되는 건 없다.

**실 Gemini 완주 검증됨(2026-07-07, 웹 경유)**: `사내 점심 투표 앱` → PRD PASS·hi-fi 4화면·handoff PASS, 브라우저 갤러리 확인(~3분).

**제품 방향 결정 — 반복 고도화 = 프로젝트 스코프 채팅형(화면별 수정 아님).** 이유(사용자): 화면 단위 수정은 전체 디자인 변경·교차 화면 일관성에서 어긋난다 — coherence는 전역 속성. 채팅이 전체 컨텍스트를 쥐어야 revise가 일관성 유지. → 엔진 `revise(ctx, feedback, history)`=**전역 컨텍스트 인지 재생성**(영향 산출물만 write, 나머지와 일관, 새 버전으로). 부수: **PRD↔화면 traceability** 이중 활용 — 갤러리 화면별 주석 + revise의 요구사항↔화면 동기화 근거.

**PRD↔화면 traceability + 주석 갤러리 구현·검증됨(2026-07-07 밤)**: designStage 끝 pass가 화면당 `reflects` 1~2줄 → `traceability.json`(스트리밍). 웹 `result-gallery`=화면별 iframe+"PRD 반영" 주석 그리드(없으면 handoff/index.html 폴백). `entities/job`에 `useTraceability`. **`?project=<name>` 재열기**(세션 재열기 down payment)도 추가.

**로컬 에이전트 provider(claude-code)로 forge 완주·품질 우위 실측(2026-07-07)** → [[kiln-model-strategy]] BYO 노선. 웹 POST에 `{model:'claude-code'}`면 로컬 Opus로 굽고 운영자 비용 0.

**① 세션 영속 완료·검증됨(2026-07-07 밤3).** "세션"=제품 프로젝트(idea·status·버전·이벤트)이지 Claude Code 터미널 세션(개발자 대화)이 아니다 — `claude-code` provider가 로컬(그것도 `--max-turns 1` 무상태)이라 실행이 사용자 머신에서 돌아도 제품이 프로젝트를 기억하는 건 자동이 아니라 별도 기능. 구현: `server/forge/session-store.ts`(`writeSession` merge+createdAt 보존·`readSession`·`listSessions`, session.json 없는 옛 프로젝트는 idea.txt·handoff/index.html·dir stat로 **합성**) → `project-controller`(§9) → BFF `GET /api/projects`(기존 `[...path]`와 공존). job-registry가 start/done/error에 best-effort writeSession(완료 시 events·screenCount). 클라: `entities/project`(SessionMeta·useSessions) → `widgets/session-list`(idea·status pill·상대시각·화면수·`?project=` 링크) → `screens/forge`(idle→목록, reopen→갤러리+"← 목록"). **버그 fix**: 미앵커 `.gitignore` `projects/`가 `app/api/projects/`까지 삼켜 기존 `[...path]/route.ts`가 untracked였음 → `/projects/`·`/runs/` 앵커로 수정.

**엔진 `/engine` 재배치(2026-07-07 밤3, 별도 커밋) — 위 "엔진 churn 0" 원칙을 의식적으로 되돌림.** 웹 착수 땐 churn 0이 옳았지만 웹이 안정된 지금은 루트 명료성이 이김. `src`→**`engine/model`**(generate·config·provider·schema + `providers/` 어댑터. src는 모호했고 안에 providers/가 있어 model이 맞음), `pipeline`→`engine/pipeline`, `harness`→`engine/harness`. **`bin`·`scripts`는 루트 유지**(npm bin 관례·공용 게이트). 경로는 전부 cwd 상대라 scripts/runs/projects/.env 무영향. 웹 소비자는 `@/engine/pipeline`(3파일)뿐. 검증: tsc(신규 0)·`ab:dry` PASS·웹 200·브라우저.

**② 채팅형 revise 엔진 완성·검증됨(2026-07-07 밤4, 실 Gemini 브라우저 e2e).** 스테이지 1개 `engine/pipeline/stages/revise.js`(CLI `bin/revise.js`·웹 레지스트리 공유): **plan(pro,schema)이 전체 컨텍스트+대화이력으로 `{scope:{prd,tokens,flow},screens[],guidance}` 판단** → **코히런스 규칙은 apply가 강제**(`tokens=true⇒전화면 재빌드`, 화면-스코프⇒지목 화면만+형제 HTML 레퍼런스). incremental 개정(기존 보존, tokens semantic 이름 유지)·`buildRevised`(현재 HTML base+형제 레퍼런스)·traceability 갱신·`handoffStage` 재호출로 갤러리 동기화. **버전 `engine/pipeline/versions.js`**: `versions/v<N>/` 풀 스냅샷 + `revisions.json`(head+entries=채팅 스레드 겸 버전 로그), `ensureBaseline`/`commitRevision`/`rollback`(새 head로 스택=비파괴 선형).
- **함정(실 Gemini 첫 런)**: gemini-2.5 flash/pro **둘 다 thinking** → `maxOutputTokens` 빠듯하면 visible 출력 truncate(tokens.css 잘림·plan JSON 깨짐) → plan/tokens/flow maxTokens 상향. 한 generate가 큰 hi-fi 화면 N개 다 못 뱉음 → **완결성 루프**(누락 채울 때까지 재요청, 새로 만든 화면을 레퍼런스로 추가). 견고 `stripFence`(펜스 독립 제거).
- **웹**: forge 스트림 인프라 재사용 — `startRevise`/`startRollback`이 같은 seam으로 job→기존 `/api/forge/[id]/stream` 스트리밍. 신설 `revision` 이벤트 3곳 선언. BFF `POST /api/forge/revise`·`/rollback`. 스레드는 `revisions.json`을 기존 `/api/projects/[...path]`로 서빙. 클라 `features/revise-chat`+`widgets/revise-thread`(버전칩+되돌리기)+`screens/forge` 2모드(생성/갤러리+개정), done 시 쿼리 무효화+iframe `?v=` 캐시버스트로 in-place 갱신.
- **검증**: 전역 토큰개정(4화면 다크 코히런트)·화면스코프 개정(index만·형제 바이트동일·다크보존)·롤백 v1(라이트 복원, traceability 부재→packaged 폴백). tsc 0·ab:dry·콘솔0. 데모 프로젝트 `projects/revise-test`(v1라이트→v2다크→v3버튼→v4롤백, projects/는 gitignore).
- 관련 [[kiln-mvp-pipeline]]·[[kiln-roadmap]]·[[kiln-model-strategy]].

**로컬 BYO-에이전트 피벗이 웹에도 반영됨(2026-07-07 밤5) → [[kiln-model-strategy]].** 웹: `GET /api/agents`(감지)→`entities/agent`→`features/agent-picker`(감지된 것만·자동선택·미설치 grey)를 `screens/forge` 2모드 헤더(생성·갤러리)에 배치, 선택 에이전트를 forge/revise에 `model`로 전달. Gemini 토글 개념 자체가 사라짐(로컬 에이전트가 기본). 웹 forge가 claude-code(로컬 Opus)로 완주 검증됨.

**다음 = A: kiln 웹 껍데기 디자인 리스타일(착수 예정, 2026-07-07 밤5 결정).** 이유: **Kiln은 하이파이 디자인을 굽는 제품인데 정작 자기 UI가 와이어프레임 수준**이라 피치가 깎임 — 싸고 안전하고 첫눈에 보이는 부분이라 투자 대비 큼. 범위(사용자가 걷는 흐름 순): ① 랜딩/히어로("한 줄 아이디어→구운 패키지" + "실행은 당신 로컬 에이전트, 비용 0" 스토리 legible하게) ② 입력→진행 스트림(가마에서 굽는 은유, 타이포·여백·리듬) ③ 결과 갤러리+수정 채팅+버전 스레드를 제품답게 ④ 빈/로딩 상태·에이전트 셀렉터 안내. 스택: Tailwind + `app/globals.css` 토큰(canvas·surface·border·text·muted·accent·ok·warn·danger, light/dark 이미 있음) + `shared/ui`. **결정: A(디자인) 먼저, 그다음 B(npx 배포 포장)** — 포장하면 사람들이 보는 게 이 UI라 순서가 이게 맞음. C(엔진 다듬기: revise 재판정·버전 diff)는 뒤로.

**세션 상태(밤5 종료)**: 커밋 `ac452d8`까지 origin/main 푸시 완료. `projects/`는 전부 비움(테스트 정리, gitignore라 앱이 재생성). dev 서버는 이 repo cwd에서 돌며 `projects/<name>/`에 산출물·session.json·revisions.json·versions/ 쌓음.

**A: 디자인 리스타일 완료·승인됨(2026-07-07 밤6).** 데스크탑-first **앱 셸**로 전환(단일 `max-w-3xl` 컬럼 폐기). 디자인 전문가 자문 반영: "모바일 컬럼 양옆 늘리기"는 거부, 영역 분할이 정답. 생성모드=중앙 런치패드→진행 시 좌우분할(입력/스트림), 세션은 카드 그리드. 갤러리모드=3영역 **마스터-디테일**(좌 썸네일 | 중앙 큰 뷰 | 우 수정·버전). **사용자가 지목한 "화면마다 iframe 내부 스크롤" 문제 해결**: 신규 `shared/ui/ScaledFrame`이 iframe을 가상 뷰포트(1280px)로 렌더 후 `transform:scale`로 축소+same-origin `scrollHeight` 읽어 전체를 스크롤 없이 표시(`pointer-events:none`), 큰 뷰 1곳으로 스크롤 수렴. [디테일⇄개요] 토글. accent **파랑→가마불 ember(테라코타)**, 웜 뉴트럴 관통(라이트/다크), 세리프 아이디어 입력·mono 로그·`kiln-glow`/`ember-breathe` 상태 서사. 신규 `shared/ui` 프리미티브 `Panel`·`ScaledFrame`. 검증: tsc 0·라우트 200·컴파일 에러 0(브라우저 e2e는 Chrome 확장 느려 사용자 셀프 리뷰로 대체, 합성 픽스처 `projects/design-check` 등으로 확인). **네이밍 결정: UI 라벨 "실행 에이전트"→"실행 모델"**(내부 코드/개념은 여전히 agent-picker·BYO agent, 사용자 표면만 "모델"). 모델 자동 라우팅은 없음(감지→기본 자동선택→사용자 수동 선택→그 모델로 실행). **다음 후보: B(npx 배포 포장) 또는 감지 결과 카드 나열 UI**(드롭다운 대안, 보류 중).
