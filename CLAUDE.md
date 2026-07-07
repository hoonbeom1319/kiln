# 프로젝트 가이드

이 프로젝트는 **Next.js (App Router) + FSD** 컨벤션을 따른다.

## 컨벤션

모든 코드 작성·파일 배치·네이밍은 아래 문서를 **단일 진실 공급원(SSOT)**으로 따른다.
구조가 애매하면 항상 이 문서를 먼저 참조한다.

→ [`.claude/rules/conventions.md`](.claude/rules/conventions.md)
(이 파일은 `.claude/rules/`에 있어 세션 시작 시 자동 로드된다 — 위 링크는 사람용 안내다.)

특히 다음을 항상 지킨다:

- **레이어 의존성**: `app → screens → widgets → features → entities → shared` (한 방향)
- **import**: 슬라이스 루트 `index.ts`(Public API)로만. 내부 파일 직접 import 금지.
- **파일명**: 항상 `kebab-case`. export 식별자만 PascalCase/camelCase.
- **`app/`은 라우팅 껍데기** — 화면 로직은 `screens/`에 둔다.
- **서버 상태는 TanStack Query, 클라이언트 UI 상태는 Zustand.**
- **서버 접근은 controller만** — 컴포넌트에서 dao 직접 import 금지.

<!-- 프로젝트별 추가 규칙은 이 아래에 작성한다. -->
