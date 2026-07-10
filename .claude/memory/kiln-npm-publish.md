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
- **`build-dist.mjs`**(루트, 미배포): `next build` 후 standalone은 `.next/static`을 안 옮기므로 `.next/standalone/.next/static`으로 복사 + tracing이 딸려온 `.next/standalone/projects`(dev 데이터) 제거. `package.json` `dist: next build && node build-dist.mjs`, `prepack: npm run dist` → publish/pack 때 자동.
- **`files` allowlist**: `bin/kiln.js`, `.next/standalone`, `scripts`, `README.md`, `LICENSE`. (engine 소스는 standalone에 번들되어 별도 미포함. bin의 forge/design/ab 등은 engine 소스 의존이라 미노출 — `kiln` 웹런처만.)

**검증됨(실측):** `npm pack` → tarball 압축해제 → 그 산출물의 `server.js` 및 `bin/kiln.js` 런처 기동 성공("Ready ~450ms"). 홈·`/api/projects`·`/api/agents`(BYO claude-code 감지 OK)·아티팩트(handoff html·screens·traceability.json) 전부 200. 낯선 cwd에서 런처 실행 시 `결과물: <cwd>/projects`로 정확히 감. 반응형·단일스크롤 수정도 프로덕션 빌드에 반영됨.

**새 세션 publish 체크리스트:**
1. `npm whoami` — `@hb-kit` 스코프/org에 publish 권한 로그인 확인.
2. (선택) version bump: 현재 `0.1.0`.
3. `npm publish` — `prepack`이 자동으로 `next build` + `build-dist.mjs` 실행(devDeps 설치돼 있어야 함: `npm i`). `publishConfig.access: public` 박혀 있어 scoped public로 나감.
4. 검증: 임시 폴더에서 `npx @hb-kit/kiln@latest --no-open` → 뜨는지. 이상적으로 live forge 1건(아이디어→handoff) 스모크(로컬 agent 구독 소모하니 사용자 판단).

**알려진 소소한 것:** favicon.ico 404(무해, `app/icon` 추가하면 사라짐). Windows에서 tar로 `C:` 경로 풀 땐 `--force-local`. `next build`가 dev서버(5000)와 `.next` 공유하지만 충돌 없이 빌드됨(실측).

관련: 웹셸 배경 [[kiln-web-shell]], 반응형 [[kiln-web-responsive]], 모델 축 [[kiln-model-strategy]]. 모체 아틀리에 = `@hb-kit/atelier`(../atelier, CLI 템플릿).
