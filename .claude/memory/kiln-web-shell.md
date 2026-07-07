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

**다음(빌드 순서) — ① 세션 영속 재개(진행할 구체 설계, 리셋 대비 고정):**
- **server**: `server/forge/session-store.ts` — `writeSession(name,patch)`/`readSession(name)`/`listSessions()`, `projects/<name>/session.json`(name·idea·status·createdAt·updatedAt·screenCount, 완료 시 events 포함). session.json 없는 옛 프로젝트(lunchvote·runcrew·proj-*)는 **합성**(idea.txt + handoff/index.html 유무로 status, dir mtime로 시각). `server/controllers/project-controller.ts`(fetchSessions/fetchSession). BFF `app/api/projects/route.ts`(GET 목록 — 기존 `[...path]` 산출물 라우트와 세그먼트 분리돼 공존). `server/forge/job-registry.ts`가 start(running)·done·error에 `writeSession`(+완료 시 events·screenCount).
- **client(FSD)**: `entities/project`(SessionMeta 타입·`fetchSessions` api·`sessionsQueryOptions`·`use-sessions`·index) → `widgets/session-list`(홈 목록: idea·status pill·상대시각·화면수, `?project=<name>` 링크, 빈 상태) → `screens/forge` 통합(idle→목록, reopen→갤러리+"← 목록"). reopen(`?project=`)은 이미 있음.
- 그다음 **② 채팅형 revise 엔진**(전역 컨텍스트 인지 재생성+버전). traceability는 revise의 요구사항↔화면 동기화 근거로 이미 준비됨.
- 관련 [[kiln-mvp-pipeline]]·[[kiln-roadmap]]·[[kiln-model-strategy]].
