# 🔥 Kiln

[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![status](https://img.shields.io/badge/status-early%20dev-e2703a)](docs/DECISIONS.md)
[![stack](https://img.shields.io/badge/Next.js%2015-FSD-111)](CLAUDE.md)

> 아이디어 한 줄을 브라우저에 넣으면, **기획(PRD) → 디자인 산출물 → 개발 인계 패키지**까지 구워낸다.
> 실행은 당신의 **로컬 코딩 에이전트**가 하고, 운영자 비용은 **0**이다.
>
> *Fire an idea into a dev-ready design hand-off — in your browser, run by the agent you already have.*

**Kiln**(가마)은 아이디어를 받아 **PRD → 와이어프레임 → 디자인 시스템 → 하이파이 화면 → 인계 패키지**까지 짓는 웹 작업장이다. 설치·터미널 없이 브라우저에서, 진행이 실시간으로 흐르고, 다 구워지면 갤러리에서 화면을 넘겨보며 채팅으로 고친다.

여기서 나오는 건 "최종 앱 코드"가 아니라 **개발에 넘길 기획·디자인 산출물**이다.

> 🚧 **초기 개발 중.** 제품이라기보다 뼈대를 세우는 단계다. 결정·아키텍처·로드맵의 단일 출처는 **[docs/DECISIONS.md](docs/DECISIONS.md)**.

---

## ✨ 핵심 한 장

<table>
<tr>
<td width="33%" valign="top">

### 🎨 아이디어 → 인계 패키지
아이디어 한 줄 + 시작 1회 질문. 그 뒤론 사람 게이트 없이 PRD부터 handoff까지 자동으로.

</td>
<td width="33%" valign="top">

### 🖥️ 실행은 당신 로컬에서
Kiln은 하네스만 준다. 실제 생성은 당신이 이미 켜둔 `claude-code`·`codex`가 당신 구독·모델로 돌린다.

</td>
<td width="33%" valign="top">

### 💸 운영자 비용 0
실행이 사용자 머신에서 돌아 서버는 API 비용을 물지 않는다. 이게 "로컬 우선"인 이유.

</td>
</tr>
</table>

---

## ⚡ 하는 일

아이디어 한 줄에서 시작해 **1회 질문**에 답하면, 그 뒤로 사람 게이트 없이 인계 패키지까지 구워낸다.

```
아이디어 ─시작 1회 질문─▶ PRD ─▶ 와이어 ─▶ 검증 ─▶ 디자인 시스템 ─▶ 하이파이 ─▶ 트렌드 감정 ─▶ handoff
                         └────────── 사람은 시작에서 한 번만. 나머지는 자동 게이트가 품질 바닥을 깐다 ──────────┘
```

각 경계마다 **검증이 코드로 박혀** 돈다 — PRD 완결성 린트, 내비게이션·기능(죽은 컨트롤 0) 검증, a11y(대비·역할·포커스), 인계 패키지 완결성. "예뻐 보인다"가 아니라 **클릭되고·상태가 변하고·접근성 통과하고·인계가 완결된 걸** 자동으로 강제한다.

완성본은 **인계 패키지**(`hand-off.md` + 비주얼 문서·토큰 매핑표·컴포넌트 인벤토리)로 묶여, 받는 쪽 개발자(또는 그쪽 AI)가 **자기 컨벤션으로** 구현한다 — 특정 프레임워크·아키텍처에 안 묶인다.

---

## 🖼️ 브라우저에서 걷는 흐름

Kiln의 웹 셸은 **가마에서 굽는** 은유를 그대로 화면에 옮겼다. accent는 파랑이 아니라 **가마불(ember)**, 로그는 mono로 흐르고 상태는 은은히 숨 쉰다.

| 단계 | 화면 | 무슨 일이 |
|---|---|---|
| **① 아이디어 던지기** | 중앙 런치패드 | 아이디어 한 줄 + 실행 모델 선택(감지된 로컬 에이전트) |
| **② 굽는 중** | 좌우 분할 · 실시간 스트림 | `prd via claude-code`… 진행이 SSE로 실시간, 상태 pill로 |
| **③ 꺼내 보기** | 마스터-디테일 갤러리 | 화면 썸네일 → 큰 뷰 → 화면별 **"PRD 반영"** 주석 |
| **④ 고치기** | 채팅 + 버전 스레드 | 프로젝트 전체 맥락으로 재생성 · 버전 칩 · 되돌리기 |

> 수정은 **화면 단위가 아니라 프로젝트 스코프 채팅**이다 — 디자인 일관성(coherence)은 전역 속성이라, 채팅이 전체 컨텍스트를 쥐어야 한 화면을 고쳐도 나머지와 어긋나지 않는다. 각 개정은 새 버전으로 쌓이고 언제든 롤백된다.

---

## 🖥️ 실행 모델 — 왜 로컬인가

Kiln은 모델 API 키를 서버에 두지 않는다. 대신 사용자가 **이미 설치해 로그인해둔 로컬 코딩 에이전트**를 실행 경로로 삼는다.

| | 설명 |
|---|---|
| **감지** | `GET /api/agents`가 PATH에서 `claude`·`codex`를 찾아 버전까지 확인 |
| **선택** | 감지된 것만 셀렉터에 뜨고(미설치는 grey) 자동 선택 |
| **실행** | 고른 에이전트를 spawn — **당신 머신·당신 구독·당신 모델**로 굽는다 |

> **왜 로컬이어야 하나?** "웹 서비스인데 왜 내 로컬 터미널을 못 여나?" → 브라우저 보안 모델상 서버 JS는 방문자 머신의 프로세스를 실행할 수 없다. **삼각 트레이드오프**(`설치 없음`·`로컬 실행=비용 0`·`호스티드 URL`) 중 둘만 가능 — Kiln은 provider seam 덕에 **로컬(비용 0)** 노선을 1급으로 두고, 호스티드는 별개 축으로 열어둔다.

---

## 🧭 왜 Kiln인가

- **설치 장벽 0** — 브라우저 접속만. (실행은 당신이 이미 가진 에이전트가.)
- **운영자 비용 0** — 실행이 사용자 로컬에서 돌아 서버 API 과금이 없다.
- **검증이 코드로 박혀 있다** — 동작·접근성·인계 완결성을 매 단계 자동으로 강제한다.
- **일관성을 지키며 고친다** — 개정은 전역 컨텍스트를 쥔 채 이뤄지고, 버전으로 쌓여 되돌릴 수 있다.

---

## 📦 결과물

받는 쪽에 **그 폴더 하나만 떼서 넘겨도 열리는** self-contained 인계 패키지:

- `hand-off.md` — 붙여넣는 인계 브리프(참고 파일·지킬 계약·만들 순서)
- 비주얼 문서 · 토큰 매핑표 · 컴포넌트 인벤토리
- PRD(DB 설계 근거) · 흐름맵 · 하이파이 화면 · 디자인 토큰 · 화면별 PRD 반영(traceability)

---

## 🚀 로컬에서 돌려보기

> 아직 배포 패키지(npx/앱) 전이다. 지금은 이 repo를 clone해 Next.js dev로 띄운다.

```bash
git clone <this-repo> kiln && cd kiln
npm install

# 실행 에이전트를 준비 — 아래 중 하나 이상을 설치·로그인해 둔다
#   • Claude Code (claude)   • Codex (codex)
# Kiln이 PATH에서 자동으로 감지한다.

npm run dev            # http://localhost:3000 — 브라우저에서 아이디어 한 줄부터
```

**CLI로도 같은 엔진을 몰 수 있다** (웹 없이):

```bash
node bin/forge.js "사내 점심 투표 앱" --model claude-code   # 무인 전체 공정
node bin/plan.js   "<아이디어>"                              # 아이디어 → PRD
node bin/design.js <project>                                 # PRD → 디자인 → handoff
node bin/revise.js <project> "다크 테마로"                   # 채팅형 개정
node bin/ab.js --variants echo,echo                          # provider A/B 하네스(오프라인)
```

---

## 🗂️ 구조

Next.js(App Router) + **FSD**를 결합한다. FSD 슬라이스는 repo 루트 직속, 그 옆에 헤드리스 엔진이 공존한다.

```
kiln/
├── app/                  # Next.js App Router — 라우팅 호스트 + BFF(/api/*)
│   └── api/              #   POST /api/forge · GET /api/forge/[id]/stream (SSE) · /api/agents …
├── application/          # 전역 Provider (QueryClient 등)
├── screens/              # 페이지 조립 — screens/forge (생성·갤러리 2모드)
├── widgets/              # progress-stream · result-gallery · revise-thread · session-list
├── features/             # forge-run · revise-chat · agent-picker
├── entities/             # job · project · agent (TanStack Query)
├── shared/               # 디자인시스템 프리미티브(Panel·ScaledFrame …) · api · lib
├── server/               # 서버 전용 3계층 — dao → controller (§9) · SSE job-registry
│
├── engine/               # 🔥 헤드리스 엔진 (FSD와 별개, 웹·CLI 공용)
│   ├── model/           #   provider 추상화 — generate(prompt,{schema}) → 검증 JSON
│   │   └── providers/   #     claude-code · codex · claude · echo(오프라인 목)
│   ├── pipeline/        #   stages: prd → design → handoff · revise · versions · emit seam
│   └── harness/         #   A/B 게이트(build→judge→score)
│
├── bin/                  # CLI 진입점 — forge · plan · design · revise · ab
├── scripts/              # 포터블 검증 게이트(lint-prd · pack/lint-handoff) *.cjs
├── docs/                 # DECISIONS.md(SSOT) · HARNESS.md
└── projects/             # 프로젝트마다 폴더 하나 (gitignore — 앱이 생성)
```

> **컨벤션의 단일 출처는 [`.claude/rules/conventions.md`](.claude/rules/conventions.md)** — 레이어 의존성(한 방향)·Public API import·kebab-case·서버 접근은 controller만. 구조가 애매하면 그 문서를 먼저 본다.

---

## 📚 더 보기

- **[docs/DECISIONS.md](docs/DECISIONS.md)** — 결정 기록·아키텍처·로드맵·진행상황 (프로젝트 source of truth)
- **[docs/HARNESS.md](docs/HARNESS.md)** — provider 추상화 계층 & A/B 하네스 설계
- **[.claude/rules/conventions.md](.claude/rules/conventions.md)** — 코드 컨벤션(Next.js + FSD) SSOT

---

<sub>🔥 Kiln — 아이디어를 넣으면, 개발에 넘길 디자인 패키지가 나온다. · MIT License · by [polaris](https://github.com/hoonbeom1319)</sub>
