---
name: kiln-npm-publish
description: Kiln을 @hb-kit/kiln (웹 워크숍 런처) npm 배포 준비 완료 — 새 세션에서 npm publish
metadata:
  type: project
---

**2026-07-10 준비 완료. `@hb-kit/kiln` = 웹 워크숍 런처를 npm에 배포.** 사용자가 `npx @hb-kit/kiln`로 로컬에서 Kiln Next.js 웹앱을 띄우는 형태(헤드리스 CLI/둘다 아님). 네이밍은 기존 스코프(`@hb-kit/cli`·`ds` 모노레포, `@hb-kit/atelier` 독립repo) 컨벤션에 맞춤. kiln은 atelier처럼 **자기 repo(`hoonbeom1319/kiln`)에서 독립 배포**. **배포 자체는 새 세션에서 하기로 함(사용자가 clear 예정).**

**패키징 구조(전부 구현·검증됨):**
- **self-contained standalone.** `next.config.mjs`에 `output: 'standalone'`. `npm pack` 결과 = 압축 17.4MB / 해제 61.8MB / 2104파일. npm이 `.next/standalone/node_modules`(traced, 2003개)를 **그대로 실어줌** → 자립형. 그래서 런타임 deps(next·react 등 9개)를 **devDependencies로 옮김**(설치 시 중복 다운로드 0). `dependencies` 비어 있음.
- **데이터/코드 경로 분리 (핵심).** 웹서버는 패키지 dir에서 돌아야 `.next`를 찾고, 게이트 `scripts/*.cjs`도 `pkgDir/scripts`로 스폰됨. 하지만 사용자 데이터(`projects/`)는 사용자 cwd로 가야 함. → **`KILN_PROJECTS_ROOT` env**로 분리: `engine/pipeline/project.js`의 `PROJECTS_ROOT`(서버 전체·아티팩트 라우트·session-store가 공유하는 단일 상수) + 게이트 3개(`lint-prd`·`pack-handoff`·`lint-handoff.cjs`)가 이 env 우선. 미설정 시 기존 cwd/projects (dev·bin CLI 하위호환).
- **런처 `bin/kiln.js`** (`bin: { kiln }`): 사용자 cwd 캡처 → `KILN_PROJECTS_ROOT=<cwd>/projects` + `PORT`(기본 5000, `--port`/`KILN_PORT`) 세팅 → `spawn(node, [.next/standalone/server.js], {cwd: pkgDir})` → URL 출력 + 브라우저 열기(`--no-open`으로 끔). SIGINT/SIGTERM 자식 전달.
- **`build-dist.mjs`**(루트, 미배포): `next build` 후 standalone은 `.next/static`을 안 옮기므로 `.next/standalone/.next/static`으로 복사 + `.next/standalone/projects`를 **정확히 커밋된 `example-*/` 쇼케이스만 남기게 리셋**(tracing이 딸려온 dev 데이터 전부 제거 후 repo `projects/example-*/`만 copy-back). 이게 런처 시딩의 seed source. `package.json` `dist: next build && node build-dist.mjs`, `prepack: npm run dist` → publish/pack 때 자동.
- **`files` allowlist**: `bin/kiln.js`, `.next/standalone`, `scripts`, `README.md`, `LICENSE`. (engine 소스는 standalone에 번들되어 별도 미포함. bin의 forge/design/ab 등은 engine 소스 의존이라 미노출 — `kiln` 웹런처만.)

**검증됨(실측):** `npm pack` → tarball 압축해제 → 그 산출물의 `server.js` 및 `bin/kiln.js` 런처 기동 성공("Ready ~450ms"). 홈·`/api/projects`·`/api/agents`(BYO claude-code 감지 OK)·아티팩트(handoff html·screens·traceability.json) 전부 200. 낯선 cwd에서 런처 실행 시 `결과물: <cwd>/projects`로 정확히 감. 반응형·단일스크롤 수정도 프로덕션 빌드에 반영됨.

**새 세션 publish 체크리스트:**
1. `npm whoami` — `@hb-kit` 스코프/org에 publish 권한 로그인 확인.
2. (선택) version bump: 현재 `0.1.0`.
3. `npm publish` — `prepack`이 자동으로 `next build` + `build-dist.mjs` 실행(devDeps 설치돼 있어야 함: `npm i`). `publishConfig.access: public` 박혀 있어 scoped public로 나감.
4. 검증: 임시 폴더에서 `npx @hb-kit/kiln@latest --no-open` → 뜨는지. 이상적으로 live forge 1건(아이디어→handoff) 스모크(로컬 agent 구독 소모하니 사용자 판단).

**알려진 소소한 것:** favicon.ico 404(무해, `app/icon` 추가하면 사라짐). Windows에서 tar로 `C:` 경로 풀 땐 `--force-local`. `next build`가 dev서버(5000)와 `.next` 공유하지만 충돌 없이 빌드됨(실측).

**2026-07-10 추가 — publish 전 공개 문구 재작성(README.md + package.json description, 커밋 대기 중 `M` 상태):** 사용자 요청으로 **"운영자 비용 0" 프레이밍을 공개 문구에서 전부 제거**(운영자가 따로 없고 사용자가 받아서 쓰는 구조라). 전면 사용자 관점으로 재작성. 핵심 변경: ① 첫 줄 tagline·핵심카드·"실행 모델—왜 로컬인가" 섹션에서 운영자 비용 언급 삭제 → "당신 머신에서, 당신 것으로"(별도 API키 불필요·로컬 이탈 없음)로 재프레이밍. ② "kiln(가마)은" → "kiln은"(신세대에 가마 낯섦, 은유는 웹셸 accent 설명 1곳만 잔존). ③ "개발에 넘길 기획·디자인 산출물" → **"코딩 에이전트가 곧바로 개발 시작할 handoff 한 벌"**. 실제 사용법(아이디어→Kiln handoff→폴더째 Claude Code→갤러리 채팅 수정) 명시. ④ handoff 패키지의 **`hand-off.md`를 "에이전트가 가장 먼저 읽는 문서"로 전면 배치** + "코딩 에이전트에 넘기는 법"(`cd .../handoff && claude`) 추가. ⑤ 마지막 섹션 "아직 배포 전" 오해 문구 제거→개발자용(repo 직접 실행)으로 정리, dev포트 5000 수정. ※ 내부 전략 메모([[kiln-model-strategy]])의 "운영자 비용 0"은 전략 사실이라 그대로 둠 — 공개 카피만 바꾼 것. **남은 실:** `hand-off.md` 템플릿(`engine/pipeline/stages/handoff.js` `handOff()`)이 지금 `## 목표`로 시작 → README 서사와 맞추려면 "이 파일 먼저 읽고 시작하라" 한 줄 추가 제안했으나 미적용(사용자 판단 대기).

**2026-07-10 추가 — 예시(showcase) 1개로 통일 + npx 사용자에게 시딩:** `projects/`의 기존 데모(`example-gemini-flash/pro`)·dev런(`proj-2026*`) **전부 삭제**, `proj-20260710-112036`(사내 점심 투표앱, 4화면 완주본)을 **`example-lunch-vote`로 rename**해 유일한 커밋 예시로 남김(rename 시 `session.json` name·events[].path·STATUS/handoff/doc의 slug 문자열 전부 치환). `.gitignore`는 그대로(`/projects/*` ignore + `!/projects/example-*/` 예외 = 예시만 커밋, dev런은 무시) — 사용자가 "projects gitignore에서 빼자" 했으나 그러면 모든 dev런이 추적돼서 targeted 규칙 유지하기로 설명. **시딩 파이프라인 신설**: build-dist가 `example-*`를 번들에 남기고(위), `bin/kiln.js` `seedExamples()`가 첫 실행 시(사용자 `./projects`가 없거나 비었을 때만) 번들 `.next/standalone/projects/example-*` → 사용자 cwd/projects로 copy. 기존 내용 있으면 skip(실제 런 안 건드림), best-effort try/catch(실패해도 서버 기동 안 막음). → npx 설치자가 첫 화면에 완성 예시를 바로 봄. isolated 로직 테스트로 fresh→seed·busy→preserve·idempotent·산출물 무결성 검증(전체 `next build`는 dev서버 .next 덮어서 안 돌림 — 실제 검증은 publish 때 `npm run dist`).

**2026-07-10 추가 — UI 잔존 "운영자 비용 0" 제거 + README "1회 질문" 오류 수정:** 공개 카피 재작성 때 README는 정리됐으나 **UI 코드에 2곳 잔존**을 사용자가 앱에서 발견 → `features/agent-picker/agent-picker.tsx`(모델 없음 경고)·`screens/forge/ui/forge-screen.tsx`(히어로) 문구를 "…당신 구독·모델로 돌아갑니다"로 교체. agent-picker.tsx:31 코드주석 "operator cost 0"은 내부 근거라 유지(공개 문자열만 변경). 또 README가 "아이디어 한 줄 + **시작 1회 질문**"이라 했는데 **실제 파이프라인엔 질문 스텝 없음**(`engine/pipeline/forge.js` = prd→design→handoff 직행, forge-form은 아이디어 textarea + 'Forge 시작'뿐) → README 4곳(핵심카드·하는일 문단·ASCII 다이어그램·캡션)에서 "1회 질문" 제거해 "아이디어 한 줄이면 된다"로 실제와 일치시킴. (원래 atelier는 질문했었음; 지금 kiln은 바로 시작이 의도.) ※ 사용자 방향: kiln은 웹/SaaS 아님 — 지금은 터미널(`npx`), 나중에 exe/데스크톱 빌드 고려.

**2026-07-10 — 첫 배포(`0.0.1`) 완료 + 회귀 2건 발견/수정 → `0.0.2` 재배포 예정:**
- **배포 방식**: 사용자가 **수동 `npm publish`**로 함(에이전트가 publish 안 함). npm 로그인=`hoonbeom`, `@hb-kit` 스코프 read-write. 첫 버전은 사용자 선호로 `0.0.1`(0.1.0 아님).
- **README "no README" 소동**: npmjs.com이 "This package does not have a README" 표시. 조사 결과 **패키지는 정상** — tarball에 README.md(192줄) 포함, 레지스트리 top-level `.readme` 6486자 채워짐. 버전-레벨 `.readme`는 0인데 **형제 atelier도 동일(버전 readme=0)한데 웹은 잘 뜸** → 원인은 **npmjs.com 렌더링 지연**(갓 배포분). 대응: 기다리거나 패치 재배포로 트리거. (즉 버전-레벨 빈 readme는 정상, 원인 아님.)
- **macOS 5000포트 403(중요)**: 사용자가 맥에서 `npx @hb-kit/kiln` → 403 blank. 원인 = **macOS Monterey+ AirPlay Receiver가 포트 5000 점유하고 non-AirPlay 요청에 403**(Flask 5000 이슈와 동일). kiln 기본 포트가 5000이라 전 맥 사용자가 첫 실행에 막힘. **수정: `bin/kiln.js` 기본 포트 5000→4173 + 사용 중이면 다음 빈 포트로 롤포워드**(`node:net`으로 `portFree` 프로브 → `pickPort(start,20)` 스캔, 옮기면 "⚠ 포트 X 사용 중 — Y로 넘어갑니다" 로그). README launcher 문구도 4173로. (repo `npm run dev`는 5000 유지 — 윈도우 개발이라 무관.) 실측: 배포 tarball 추출·부팅 OK(Ready ~305ms, 예시 시딩 로그 "예시 1종 준비: example-lunch-vote"), 2인스턴스로 4173→4174 롤포워드 확인.
- **다음 세션**: `0.0.2` 수동 `npm publish`(port fix + README 렌더 트리거). prepack이 next build로 dev서버 .next 덮으니 배포 후 dev 재시작.

관련: 웹셸 배경 [[kiln-web-shell]], 반응형 [[kiln-web-responsive]], 모델 축 [[kiln-model-strategy]]. 모체 아틀리에 = `@hb-kit/atelier`(../atelier, CLI 템플릿).
