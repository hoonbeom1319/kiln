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

**착수 순서(하나씩):** ✅ **① shoot 렌더 게이트 부활 — 완료(2026-07-10)** → ✅ **② runAgentic+stream-json 렌더-인-루프 — 완료(2026-07-10)** → ✅ **③ design-verify 적대적 픽셀 vision + revise 확산 — 완료(2026-07-10)** → 🟡 **④ codex 배선검증 완료·계정한계로 green 이월(2026-07-10) / gemini 이월**.

**착수 ④ 상세(2026-07-10, codex — 코드 변경 0):** 핵심 발견 = **하류가 이미 provider-무관이라 codex는 코드 추가 없이 스테이지 계약을 통과**한다. design.js는 build 지점만 분기(`isAgentic?agentic:oneshot`), 하류(디스크 기록→외부 shoot→verifyScreens)는 provider-무관. codex=`supportsAgentic` 없음 → `isAgentic=false` → 단발 `buildScreens`(`<<<FILE…>>>` 파싱)+외부 shoot+소스 판정(`bin/forge.js`가 judge=model=codex). **실측**: `node bin/forge.js "…" --model codex` → 파이프라인이 codex 도달·모델전달·**실제 사유 표면화**(`codex: The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.`) = 배선·에러핸들링 정상. 시도한 전 모델(gpt-5.3/5.1/5-codex·gpt-5·o4-mini) 거부 → **green 완주는 이 ChatGPT 계정 플랜의 Codex 접근 제한 때문에 막힘(kiln 버그 아님)**. **사용자 결정: codex=배선검증 인정·진행, gemini=이월.** gemini는 CLI 미설치 → BYO gemini-cli(codex.js 미러: provider+AGENTS row+config alias)로 나중에 추가·실측. gemini SDK(`@google/genai`)는 devDep에만 있고 provider 없음(피벗 때 제거).

**착수 ③ 완료 상세(2026-07-10):** design-verifier를 HTML 소스 판정 → **렌더 PNG 픽셀 판정**으로 승격. `judge.js` **`judgeHiFiAgentic`**(runAgentic으로 독립 claude-code 서브에이전트, `tools:['Read','Write']` — Read로 `_shots/screens/*.png` 픽셀 확인 + 소스는 deadControl·stateInert 보조근거, Write는 판정파일만 → Edit/Bash 없음=검증대상 불가침). **판정 전달=파일**: 모델이 마지막 메시지를 산문으로 내는 실측 문제 → 에이전트가 `design-verify.json`에 verdict Write → `readVerdict`가 디스크에서 읽고 `extractJSON`+`validate`(VERDICT_SCHEMA), 실패 시 메시지 텍스트 폴백, 그래도 실패면 throw. 프롬프트 `judgeAgenticSystem`/`judgeAgenticTask`(harness/prompts.js). **공유 헬퍼 추출 `engine/pipeline/verify.js` `verifyScreens`**(shoot는 caller가 먼저 실행, 헬퍼는 판정만): pixel-first(`isAgentic(judge)&&hasShots`)·소스 폴백(non-agentic/무-shot/파싱실패)·`reconcile`(빌드에 없는 환각화면 제거)·design-verify.md 작성(근거 라벨=픽셀/소스)·design-verifier 게이트 emit — **advisory·불차단**. design.js는 인라인 검증(+reconcile/verifyDoc/verdictSummary) → `verifyScreens` 한 줄 호출로 대체. **revise 확산**: revise.js가 개정 화면 재생성 후 `rebuilt[]` 수집 → `runGate('shoot.cjs')` + `verifyScreens({files:rebuilt, judge:planner, scope:'(개정)'})` — 개정도 초기 빌드와 같은 렌더+픽셀 안전망(이전엔 shoot·verify 둘 다 없었음). **실측**: 예제 프로젝트로 judgeHiFiAgentic·verifyScreens 각각 end-to-end — 에이전트가 4 PNG 픽셀 확인, 한 실행에서 **소스로는 안 보이는 vote 왕관 렌더 결함(.crown 기본 display 미설정 → 1위 아닌 후보에 왕관)**을 픽셀에서 잡아 FAIL(다른 실행은 PASS=판정 모델 변동성, advisory라 무해). tsc 클린. env: `KILN_VERIFY_MAX_TURNS`(기본 8). **미실측 표면**: 전체 revise 런(plan→rebuild→shoot→verify) 통합은 단위조각만 검증(shoot는 design.js와 동일 경로, verify는 verifyScreens 실측).

**착수 ② 완료 상세(2026-07-10, A~E 한 세션):** `generate()`의 형제 **`runAgentic`**(`engine/model/agentic.js`, `supportsAgentic` seam) + `agent-cli.js` **`runAgentStream`**(JSONL 개행파싱·cwd/env·비정상종료도 `e.events` 첨부) + `claude-code.js` `runAgentic`(=`claude -p --output-format stream-json --verbose --strict-mcp-config --max-turns N --permission-mode bypassPermissions --tools Write Read Edit Bash --add-dir <proj>`). **JSONL→SSE 매핑**: assistant.text→`turn`, tool_use↔tool_result(id 매칭)→완료된 `tool-call`(ok·detail), result에서 usage/num_turns. **turn/tool-call 이벤트 5곳 배선**(events.js·server/types·entities/job·event-row.tsx), SSE seam 불변(EventRow 미지type=null이라 안전). **`buildScreensAgentic`**(에이전트가 screens/*.html 직접 작성→`node scripts/shoot.cjs`→_shots PNG를 Read로 픽셀확인→Edit 반복; 종료 후 디스크에서 읽어 기존 `{files}` 계약 유지), `design.js`는 `isAgentic?agentic:oneshot` **분기 하나**·나머지 불변·**엔진 최종 shoot 게이트 경로무관 유지**(신뢰판정). **max_turns=소프트경계**(non-zero exit지만 파일 유효→복구·warn·진행). **보안 정정**: 헤드리스 `-p`에서 `allowedTools`는 제한 아님(실측: default에서도 임의 Bash 실행)·스트릭트 settings면 hang 위험 → **`bypassPermissions`**(BYO라 신뢰경계 불변)+`--tools`/`--strict-mcp-config`/`--add-dir`로 스코프. **부트스트랩**: `scripts/ensure-chromium.cjs`(첫 렌더 시 chromium 자동 다운로드·shoot 상단 호출로 서버게이트·에이전트툴 양쪽 커버) + **playwright를 devDep→runtime dependency 승격**(spawn돼 standalone 트레이스 불가 → npx 사용자 resolve 위해)·런처 변경 불필요. **실측**: sonnet이 실제로 `"선택선택"` CSS `::after` 중복(소스엔 없고 렌더에만 보이는 버그)을 PNG 보고 자가수정 — atelier 렌더-인-루프가 kiln 척추 위에서 되살아남. tsc 클린. 상세 `docs/DECISIONS.md` 2026-07-10(착수 ② 완료).

**착수 ① 완료 상세(2026-07-10):** `scripts/shoot.cjs`(atelier `shoot.js`를 게이트 계약에 맞춰 이식 — 단일 인자 `<project>`·`KILN_PROJECTS_ROOT` 존중·`screens/*.html` 자동·`_shots/screens/*.png`), `design.js`에 빈화면가드 직후 `runGate('shoot.cjs')`+`emit('gate',{name:'render-shoot'})`(advisory·PNG를 `kind:'shot'` 아티팩트로). **결정론적 픽셀 체크**로 `isBlankScreen`(소스판정)을 렌더판정으로 승격: ❌blank(bodyH<200∥가시요소<8∥글자<30, exit1) + ⚠️near-uniform(픽셀당<12KB/MP). **패키징 마찰 해소**: kiln엔 playwright 의존성이 원래 없었음 → dev는 `playwright` devDep+`npx playwright install chromium`, npx 사용자는 **graceful skip**(require·런치 실패 → 힌트+exit0). 8화면 PASS·blank 발화·skip 전부 실측 검증.

**부트스트랩 방식 확정(②에서 구현):** 번들링 아님(~150MB×플랫폼별 → tarball ~1GB, standalone이 spawn된 shoot.cjs 트레이스 불가), 시스템 Edge 재사용도 아님(버전 제각각 → 픽셀 불일치). **"첫 렌더 자동 다운로드"** 채택 — 픽셀 게이트라 **모두 동일 크로미움=렌더 일관성**이 이김. 규격: 런처(bin/kiln.js)가 **첫 렌더 필요 시점에**(런처 시작 아님) `playwright install chromium` 자동 + 진행 표시 + 실패 시 graceful skip 강등 + 1회 후 캐시 재사용. 사용자는 명령어 직접 안 침(`npx @hb-kit/kiln`만으로). standalone 트레이스에 playwright 라이브러리 포함도 ② 과제.

**다음 세션(④ 잔여):** (a) Codex 접근 가능한 계정/머신에서 codex green 실측(현재는 배선만 검증) · (b) gemini-cli BYO provider 추가(`engine/model/providers/gemini.js` codex.js 미러 + AGENTS row + config `gemini` alias, `supportsAgentic=false` → 자동 단발 폴백)·실측. agentic 시임(`runAgentic`/`buildScreensAgentic`/`judgeHiFiAgentic`/`verifyScreens`) 완비. 여력되면 전체 revise 런 통합 실측(③ 미실측 표면).

**리스크(선반영):** Playwright/chromium 패키징 — **해소 방향 확정: "첫 렌더 자동 다운로드"**(번들·시스템Edge 아님, 위 착수①상세 참조. ②에서 런처 구현) · 멀티턴 툴루프 비용·속도(메모리상 CC가 콜마다 무거운 컨텍스트 로드 → 몇 배, turn/budget 캡 필수) · stream-json→SSE 매핑은 실 통합 작업 · **게이트는 엔진 강제 유지**(에이전트 자율에 안 맡김).

**후속 정리:** 앞서 논의한 best-of-N(harness 승격)·auto-rework 외부 루프는 **agentic 자가수정이 흡수** → harness 잔재는 승격이 아니라 **retire/정리** 대상. 상세 로그 `docs/DECISIONS.md` 2026-07-10. 관련 [[kiln-model-strategy]]·[[kiln-mvp-pipeline]]·[[kiln-web-shell]].
