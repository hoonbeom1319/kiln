---
name: kiln-model-strategy
description: Kiln의 모델·오케스트레이션 전략 — Gemini 우선이지만 교체 가능해야 함
metadata:
  type: project
---

Kiln은 **Gemini API**로 먼저 개발한다(사용자가 Gemini 크레딧 보유). 단 **모델 교체 가능성이 최우선 설계 제약** — POC 돌리며 단계별로 다른 모델(Claude 등)로 갈아탈지 결정할 예정.

**Why:** 지금 atelier 만족도의 상당 부분이 Opus 특성(하이파이 HTML 비주얼 충실도 + 적대적 검증의 냉정함)에서 나오는데, Gemini가 같을지는 미검증. 실측 전까지 특정 모델에 묶으면 안 됨.

**How to apply:**
- Gemini SDK를 코드 전반에 직접 박지 말 것. **provider 추상화 계층 필수** — `generate(prompt, schema) → 검증된 JSON` 하나의 인터페이스 뒤에 Gemini/Claude/etc를 꽂는다.
- 멀티모델 하이브리드 여지 열어둘 것: 기계적 단계는 싼 모델, hi-fi 빌드·최종 판정만 강한 모델.
- 오케스트레이션은 **LangGraph** 유력(provider 추상화·영속성·재개·관찰가능성 + atelier의 pipeline/parallel/다수결이 그래프 노드로 1:1 이식). 직접 어댑터+별도 잡 큐도 대안.

관련: [[kiln-roadmap]] ①이 이 전략을 실측하는 첫 단계.
