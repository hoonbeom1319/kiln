# A/B 하네스 & provider 추상화 계층 (로드맵 ①)

> DECISIONS.md 로드맵 ①의 구현. **버리는 코드 0** — A/B를 돌리는 `generate()` 계층이 곧 프로덕션 모델 스위처다.

## 왜 이렇게 짰나

로드맵 ①은 GO/NO-GO 게이트다: 같은 `_fixture` PRD를 **Gemini판 vs Opus판** hi-fi로 뽑아 독립 검증자(design-verifier) 점수로 비교한다. 그런데 그 비교를 하려면 이미 "모델을 갈아끼우는" 계층이 필요하다. 그래서 A/B 하네스를 **provider 추상화 계층 위에** 올렸다 — 실측이 끝나면 그 계층을 그대로 프로덕션에 승격한다.

핵심 계약 한 줄: **`generate(prompt, { schema }) → 검증된 JSON`.** 코드 어디에도 Gemini/Claude SDK를 직접 박지 않는다.

## 레이어

```
src/                          ← provider 추상화 계층 (프로덕션으로 승격될 부분)
  config.js     MODELS 표 — 로직 별칭 → {provider, model}. 모델 id는 여기 한 곳에만.
  generate.js   generate(prompt,{schema,model,system}) — 유일한 공개 인터페이스.
                native structured output → 스키마 검증 → repair-retry 루프.
  provider.js   Provider 베이스 + 레지스트리.
  providers/    echo(오프라인 목) · gemini(@google/genai) · claude(@anthropic-ai/sdk)
  schema.js     의존성 0 JSON-Schema 검증 + JSON 추출기.
  env.js        의존성 0 .env 로더.

harness/                      ← 로드맵 ① 전용 배선 (유일하게 버려질 수 있는 층)
  fixture.js    ../atelier/projects/_fixture 에서 PRD·flow·tokens 로드.
  prompts.js    hi-fi BUILD + adversarial JUDGE 프롬프트 (design SKILL·design-verifier 이식).
  schemas.js    BUILD_SCHEMA · VERDICT_SCHEMA(render-check 7항목).
  build.js      한 variant의 hi-fi 생성.
  judge.js      공유 심판으로 채점.
  score.js      verdict → ok-rate 점수.
  ab.js         runAB() — build→judge→compare→GO/NO-GO, runs/<stamp>/ 기록.

bin/ab.js                     ← CLI
```

## 쓰는 법

```bash
# 오프라인 dry-run — 키 불필요. 전체 배선을 그대로 태운다(echo 목 프로바이더).
node bin/ab.js

# 진짜 A/B — .env 에 GEMINI_API_KEY, ANTHROPIC_API_KEY 넣고:
node bin/ab.js --variants gemini-pro,opus --judge opus --baseline opus --epsilon 0.05
```

- SDK는 실제로 그 프로바이더를 쓸 때만 동적 import된다 → **dry-run은 `npm install` 없이도 돈다.**
- 실모델 A/B 전엔 `npm install`(SDK 2개)과 `.env` 필요.

### 출력

`runs/<timestamp>/`:
- `<model>/screens/*.html` — 각 variant의 hi-fi 산출물
- `<model>/verdict.json` — 화면별 render-check 판정
- `report.md` · `report.json` — 랭킹 + 챌린저별 **GO/NO-GO**

GO 기준: 챌린저가 자체 PASS이고 baseline 대비 ok-rate가 `epsilon` 이내.

## `generate()` 계약

```js
import { generate } from './src/index.js';

// 자유 텍스트
const { text } = await generate('한 줄 요약해줘', { model: 'gemini-flash' });

// 스키마 강제 JSON (검증 + 재시도 내장)
const { data } = await generate('...', {
  model: 'opus',
  schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
});
```

모델 별칭(`gemini-pro`·`opus`·`echo`…)은 `src/config.js`의 `MODELS`에서 실제 모델 id로 풀린다. 모델 교체 = 그 표 한 줄 수정.

## 다음 (로드맵 ②)

오케스트레이터를 LangGraph(.js)로 포팅할 때 이 `generate()`가 각 그래프 노드의 모델 호출 프리미티브가 된다. 게이트 스크립트(atelier `scripts/`)는 node 호출로 노드 안에 그대로 박는다.
