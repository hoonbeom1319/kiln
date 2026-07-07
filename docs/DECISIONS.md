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

---

## 참조

- 원본 하네스: [`../atelier`](../atelier) — `CLAUDE.md`(형식·품질 규칙), `.claude/skills/{forge,plan,design}/SKILL.md`(공정 절차), `.claude/workflows/`(forge-plan·forge-design 오케스트레이션 참고), `scripts/`(포터블 게이트).
