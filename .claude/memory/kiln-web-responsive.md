---
name: kiln-web-responsive
description: Kiln 웹 셸 풀 반응형 패스 — 2026-07-10 완료. 데스크탑-first → mobile-first 전 구간
metadata:
  type: project
---

**Kiln 웹 셸 풀 반응형 패스 — 2026-07-10 완료.** 데스크탑-first(`lg:` 몰빵) 셸을 mobile-first 전 구간(375/768/1024/1440 × 다크·라이트)으로 끌어올림. **비주얼 언어(토큰·팔레트·가마 무드)는 이미 완성도 높아 그대로 두고, 레이아웃 취약점만** 수정하는 방향으로 감(사용자가 "비주얼 새로"가 아니라 "반응형 레이아웃 재작업"을 택함).

**어떻게 했나 (재현 가능한 방법):** Playwright MCP로 실측(포트 5000 기존 dev 서버 재사용, `emulateMedia({colorScheme})`로 다크/라이트, full-page 스크린샷 + `scrollWidth>clientWidth` 오버플로 계측). 그 스크린샷+소스를 **영역별 크리틱 서브에이전트 3개**(탑바·타이포 / result-gallery / revise·런치패드)에 병렬로 던져 정확한 Tailwind 수정안을 받고 합성. Playwright는 브라우저 1개라 실측은 내가 직렬로, 크리틱만 병렬. **주의:** full-page 스크린샷 좌하단에 뜨는 원형 "N"은 **Next.js dev 빌드 인디케이터**지 앱 요소가 아님 — 착각 금지.

**실제 수정(전부 반영·검증됨):**
- `app/globals.css` `html,body`: **`word-break: keep-all` + `overflow-wrap: break-word`** 전역. 한글이 음절 중간(넣으│면)에서 깨지던 걸 어절 경계로. overflow-wrap이 긴 라틴 토큰(proj id·모델 slug) 오버플로 방지 짝. → 개별 `break-keep`보다 전역이 정답.
- `screens/forge/ui/forge-screen.tsx`: 탑바 컨테이너 `flex-wrap gap-x-3 gap-y-2`(모바일서 picker가 두 줄로 충돌하던 것 해소). gallery revise **aside를 스택될 때 `mx-auto w-full max-w-2xl`로 캡, `lg:mx-0 lg:max-w-none`로 해제**(768~1023서 aside가 full-width로 늘어져 line-length 과다하던 것 → idle 런치패드 `max-w-2xl`와 일치).
- `features/agent-picker/agent-picker.tsx`: "실행 모델" 라벨 `hidden sm:inline`(모바일 헤더 공간 확보; select에 aria-label 있어 a11y 손실 없음).
- `widgets/result-gallery/result-gallery.tsx`: master-detail 분기 **`lg:`→`md:`**(768~1023 태블릿이 "늘어난 폰"이던 것 → 세로 레일+디테일). ScaledFrame 3곳(썸네일 2·디테일 1) **`virtualWidth={480}`**, 디테일 컨테이너 `mx-auto max-w-[480px]`. 아티팩트가 전부 `max-width:480px` 모바일 디자인이라 1280 가상폭 안에서 거터가 크게 남던 것 → 폰 스크린샷처럼 꽉 참(컨테이너<480이라 다운스케일=선명, 업스케일 블러 없음).

**2차 지시(같은 세션) — full-width + 단일 스크롤:** 사용자가 "1440서 max-w로 가두지 말고 base w-full + breakpoint로 나눠라", "가운데 스크롤 안에 스크롤 이상하다"고 지적. 반영:
- **페이지 프레임 max-w 캡 전부 제거**(`max-w-7xl/6xl/5xl mx-auto` → `w-full`), 와이드 패딩 `lg:px-8 xl:px-12`. TopBar도 동일(워드마크가 콘텐츠 좌측과 정렬). 그래서 이전에 남겼던 "idle 1440 여백"·"헤더 정렬 어긋남" 둘 다 이걸로 해소.
- **idle 런치패드: `lg:grid-cols-2` 좌우 분할**(문구 왼쪽 `lg:text-left text-4xl` | 입력 오른쪽). max-w로 가두는 대신 breakpoint로 폭 활용(=사용자 철학). 모바일은 스택.
- **session-list `xl:grid-cols-4`** 추가(full-width 와이드 리듬).
- **중첩 스크롤(스크롤 안 스크롤) 제거:** gallery 디테일 래퍼 `max-h-[72vh] overflow-y-auto` 삭제, 레일 `md:overflow-y-auto`→`md:overflow-x-visible`(base `overflow-x-auto`가 desktop서 y축까지 auto로 승격시키던 것 차단). 이제 **단일 body 스크롤**(전 폭·양테마 nested scroller 0 계측 확인).
- **ScaledFrame 근본 수정:** 생성 아티팩트가 `min-height:100vh` 앱 프레임(+내부 `overflow-y:auto`)이라 scrollHeight 자동측정이 **순환**(iframe 높이 H→100vh=H→scrollHeight=H)이라 provisional 317에 갇혀 프리뷰가 짧게 잘리고 디자인 자체 스크롤이 돌았음. → `virtualHeight` prop 추가(고정 폰 뷰포트, 측정 skip). 디테일 프리뷰 `virtualWidth={480} virtualHeight={1040}`으로 폰 화면 전체 표시. 추가로 비인터랙티브 프리뷰에서 **아티팩트 스크롤바를 injected style로 숨김**(pointer-events:none이라 죽은 바). 전체는 "크게 열기 ↗".

**남긴 것(의도적, 건드리지 말 것):** forging 2단 분기는 `lg:`만 유지(stream이 폭을 원해서 768서 2fr/3fr 쪼개면 둘 다 좁아짐). aside 스택 시 `max-w-2xl` 캡은 유지 — 이건 페이지 프레임 캡이 아니라 stacked revise prose의 줄길이(가독성)용이고 와이드 낭비를 안 만듦. 디테일 프리뷰 480 좌측정렬이라 와이드서 프리뷰 우측에 여백 있음 — 원하면 그 자리에 PRD 노트를 `xl:` 좌우배치로 넣을 수 있음(미적용, 옵션).

배경은 [[kiln-web-shell]], 모델 축 [[kiln-model-strategy]]. 직전 세션 이력(다크모드 color-scheme·2단 picker·Windows spawn 등)은 git `d8617a8`~`d70ad93` 참조.
