---
name: kiln-overview
description: Kiln이 무엇이고 atelier와 어떤 관계인지 — 프로젝트 정체성
metadata:
  type: project
---

Kiln은 로컬 하네스 **atelier**(터미널/Claude Code에서 도는, 아이디어→PRD→디자인→인계 패키지 작업장)를 **웹·SaaS 프로덕트**로 옮긴 프로젝트다. "atelier에서 빚고, kiln에서 굽는다"는 은유. 이 repo는 atelier의 형제 폴더(`../atelier`)에 있고 2026-07-07 생성됐다.

핵심 원칙: atelier의 **자동 게이트(scripts/: lint-prd·Playwright 1·2층·a11y·lint-handoff)와 산출물 규격(독립 HTML·2단 토큰·self-contained handoff)은 포터블이라 그대로 재사용**하고, **Claude Code 전용인 오케스트레이션(agent()/Workflow/schema/서브에이전트)만 다시 짠다**. 근육은 살고 두뇌만 이식.

현재 초기 뼈대 단계. 상세·결정·로드맵은 [[kiln-roadmap]]·[[kiln-model-strategy]] 및 `docs/DECISIONS.md` 참조.
