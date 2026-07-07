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

**다음 — ② 채팅형 revise 엔진**(전역 컨텍스트 인지 재생성+버전). traceability·session events 이미 준비됨.
- 관련 [[kiln-mvp-pipeline]]·[[kiln-roadmap]]·[[kiln-model-strategy]].
