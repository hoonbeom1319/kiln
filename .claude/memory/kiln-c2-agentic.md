---
name: kiln-c2-agentic
description: 아키텍처 방향 C2 확정(2026-07-10) — 엔진 척추 유지 + 실행만 agentic CC 툴루프. atelier를 웹에서 재탄생, Claude 1급·모델 점진 확장
metadata:
  type: project
---

**방향 확정(2026-07-10): C2 — "엔진 척추 + 실행만 agentic". 컨셉 = 터미널 atelier를 웹에서 재탄생.** Claude 전용을 1급으로 갈아끼우되, **Node 엔진이 순서·게이트(척추)를 계속 소유**하고 각 스테이지 실행만 지금의 `--max-turns 1` 단발 → **툴(Playwright) 멀티턴 CC 에이전트**로 위임(자가수정). atelier의 *능력*을 kiln의 *척추* 위에서 되살린다. 이건 다음 개발 슬라이스의 **기준 문서**다.

**왜 이 결정에 이르렀나(탐색에서 드러난 사실):**
- 현재 `claude-code` provider는 `--max-turns 1` **단발 생성기**(`engine/model/providers/claude-code.js:17`) — 툴 루프 없음. 그래서 atelier의 핵심 품질 레버인 **렌더-인-루프 자가수정**(에이전트가 자기 화면을 실제 렌더해 픽셀 보고 고침)을 잃었다.
- **shoot(Playwright 렌더 게이트)가 미이식됐다.** DECISIONS엔 "포터블 재사용"으로 적혔으나 실제 `scripts/`엔 `lint-prd`·`pack-handoff`·`lint-handoff` 3개뿐. **design-verifier는 모델이 HTML 텍스트를 읽는 판정 — 픽셀을 안 본다.** atelier hi-fi 비주얼 우위의 핵심을 잃은 지점.
- **harness/ 잔재.** `ab.js`·`build.js`·`score.js`·`fixture.js`는 로드맵①(Gemini GO/NO-GO)용이었으나 로컬 피벗으로 목적 소멸. `bin/ab.js`(ab:dry echo 스모크)로만 도달. `build.js`는 폐기된 HTML-in-JSON 포맷 중복, `fixture.js`는 `../atelier` 커플링. (`judge.js`·`schemas`·`prompts`는 파이프라인이 공유 → 살아있음.)
- **LangGraph(로드맵②)는 사실상 무효.** 팔던 것(provider추상화·관찰가능성·영속성)은 대부분 직접 구현 완료, 멀티모델·다수결(주 용도)은 피벗이 폐기. 유일 갭=재개(~50줄)라 프레임워크 도입 사유 아님.

**왜 C2이고 C1이 아닌가:** C1(엔진 삭제, 오케스트레이션을 `.claude/skills`+`workflows`로 = atelier 문자 그대로 이식, 웹은 얇은 관찰자)은 codex/gemini엔 그 프리미티브가 없어 **"모델 하나씩 추가"를 죽이고** provider seam(kiln의 크라운주얼)을 버린다. 사용자가 같은 문장에서 원한 "atelier 재탄생 + 모델 점진 확장"을 **동시에** 살리는 건 C2뿐. C2도 완전한 (C)다(풀 툴루프 = atelier 능력) — 다른 건 "척추가 어디 사느냐"뿐이고 그게 확장 난이도를 가른다.

**청사진(C2):**
1. seam에 `supportsAgentic` 플래그 추가(`claude-code.js`의 `supportsStructured` 옆).
2. `generate()`의 형제 `runAgentic(task,{tools,maxTurns})`. claude-code=`claude -p --output-format stream-json`(멀티턴+Playwright 허용). codex/echo 미구현 → 단발 `generate`+외부 게이트로 폴백.
3. **shoot(Playwright 렌더) 부활 = 최대 레버.** 두 소비자: agentic 빌드가 루프 중 부르는 **툴** + 폴백 경로의 **외부 게이트**. 스크립트 1, 용처 2.
4. 스테이지 = "agentic 우선, 단발 폴백". PRD·tokens·flow는 단발로 충분할 수 있음. **큰 승부 = hi-fi 빌드 + design-verify를 렌더-인-루프**로.
5. **웹 SSE seam 불변** — 엔진이 phase/step/gate/artifact emit, agentic 콜은 turn/tool-call 서브이벤트를 얹어 스트리밍.

**착수 순서(하나씩):** ✅ **① shoot 렌더 게이트 부활 — 완료(2026-07-10)** → ② `runAgentic`+claude-code stream-json + hi-fi 빌드 agentic화(shoot=툴) → ③ design-verify(적대적 서브에이전트)·revise 확산 → ④ **codex → gemini** 단발 폴백 provider를 같은 스테이지 계약 뒤에 하나씩.

**착수 ① 완료 상세(2026-07-10):** `scripts/shoot.cjs`(atelier `shoot.js`를 게이트 계약에 맞춰 이식 — 단일 인자 `<project>`·`KILN_PROJECTS_ROOT` 존중·`screens/*.html` 자동·`_shots/screens/*.png`), `design.js`에 빈화면가드 직후 `runGate('shoot.cjs')`+`emit('gate',{name:'render-shoot'})`(advisory·PNG를 `kind:'shot'` 아티팩트로). **결정론적 픽셀 체크**로 `isBlankScreen`(소스판정)을 렌더판정으로 승격: ❌blank(bodyH<200∥가시요소<8∥글자<30, exit1) + ⚠️near-uniform(픽셀당<12KB/MP). **패키징 마찰 해소**: kiln엔 playwright 의존성이 원래 없었음 → dev는 `playwright` devDep+`npx playwright install chromium`, npx 사용자는 **graceful skip**(require·런치 실패 → 힌트+exit0). 8화면 PASS·blank 발화·skip 전부 실측 검증.

**부트스트랩 방식 확정(②에서 구현):** 번들링 아님(~150MB×플랫폼별 → tarball ~1GB, standalone이 spawn된 shoot.cjs 트레이스 불가), 시스템 Edge 재사용도 아님(버전 제각각 → 픽셀 불일치). **"첫 렌더 자동 다운로드"** 채택 — 픽셀 게이트라 **모두 동일 크로미움=렌더 일관성**이 이김. 규격: 런처(bin/kiln.js)가 **첫 렌더 필요 시점에**(런처 시작 아님) `playwright install chromium` 자동 + 진행 표시 + 실패 시 graceful skip 강등 + 1회 후 캐시 재사용. 사용자는 명령어 직접 안 침(`npx @hb-kit/kiln`만으로). standalone 트레이스에 playwright 라이브러리 포함도 ② 과제.

**다음 세션은 ②부터** — runAgentic + claude-code stream-json + hi-fi 빌드 agentic화(shoot=툴 재사용) + 위 부트스트랩. 상세 로그 `docs/DECISIONS.md` 2026-07-10(착수 ① 완료 · 부트스트랩 확정).

**리스크(선반영):** Playwright/chromium 패키징 — **해소 방향 확정: "첫 렌더 자동 다운로드"**(번들·시스템Edge 아님, 위 착수①상세 참조. ②에서 런처 구현) · 멀티턴 툴루프 비용·속도(메모리상 CC가 콜마다 무거운 컨텍스트 로드 → 몇 배, turn/budget 캡 필수) · stream-json→SSE 매핑은 실 통합 작업 · **게이트는 엔진 강제 유지**(에이전트 자율에 안 맡김).

**후속 정리:** 앞서 논의한 best-of-N(harness 승격)·auto-rework 외부 루프는 **agentic 자가수정이 흡수** → harness 잔재는 승격이 아니라 **retire/정리** 대상. 상세 로그 `docs/DECISIONS.md` 2026-07-10. 관련 [[kiln-model-strategy]]·[[kiln-mvp-pipeline]]·[[kiln-web-shell]].
