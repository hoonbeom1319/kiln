---
name: kiln-roadmap
description: Kiln 로드맵 3단계와 지금 착수할 다음 스텝
metadata:
  type: project
---

Kiln 로드맵 — **가장 위험한 가정을 먼저 죽인다** 순서:

1. **① Gemini 품질 A/B — 골격 구현됨(2026-07-07), 실측 대기.** GO/NO-GO 게이트. atelier `_fixture` 픽스처로 같은 PRD를 Gemini판 vs Opus판 hi-fi로 뽑아 design-verifier 점수로 비교. **A/B 하네스를 provider 추상화 계층으로 짜서 그대로 프로덕션 모델 스위처로 승격** — 버리는 코드 0. 구현: `src/`(generate/config/providers, 의존성 0 검증·retry)+`harness/`(build/judge/score/ab)+`bin/ab.js`. 오프라인 dry-run(echo) 통과. **남은 건 실키 넣고 `--variants gemini-pro,opus` 실측.** 상세 `docs/HARNESS.md`.
2. **② 오케스트레이터 LangGraph 포팅** — atelier forge-plan/forge-design을 그래프 노드로. 게이트 스크립트(lint-*·shoot·Playwright)는 그대로 node 호출로 노드 안에 박음.
3. **③ 웹 얇게** — 잡 큐 + 진행 스트리밍(SSE/WebSocket) + 테넌트 스토리지 격리.

**대상은 SaaS**라 실물 과제 추가: 샌드박싱(생성 HTML + 헤드리스 렌더 테넌트 격리), 실행당 비용 미터링, 로컬 FS→오브젝트 스토리지, long-running job 큐.

다음 세션 첫 지시 예시: "docs/DECISIONS.md 읽고 로드맵 ① Gemini 품질 A/B 하네스부터, provider 추상화 계층으로 짜자." 관련: [[kiln-overview]]·[[kiln-model-strategy]].
