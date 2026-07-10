# example-lunch-vote — 독립 검증 (design-verifier)

검증자: design-verifier (빌더와 다른 컨텍스트) · 심판 모델 기반

## 화면별 render-check
| 화면 | thin | bad | variantsIdentical | off-brief | deadControl | stateInert | wireframey | 판정 |
|---|---|---|---|---|---|---|---|---|
| index.html | ok | ok | ok | ok | ok | ok | ok | PASS |
| home.html | ok | ok | ok | ok | ng | ok | ok | FAIL |
| create.html | ok | ok | ok | ok | ok | ok | ok | PASS |
| vote.html | ok | ok | ok | ok | ok | ok | ok | PASS |

## 재작업 지시
- home.html: 확정결과 요약 카드·진행중 투표 2건(라이브 vs 곧마감, 후보칩·미니 스택바 상이)·빈상태까지 내용 풍부하고 카드는 vote.html로 링크, 빈상태는 ?empty=1로 토글되어 상태 변화 있음. 그러나 우상단 프로필 아바타 <button>(cursor:pointer·hover·focus-ring로 명백히 인터랙티브)에 클릭 핸들러가 없고 '[범위 밖]' 라벨도 없음 — 전형적 dead control. 아바타를 비대화형으로 만들거나 범위 밖 라벨링 필요. 이 한 항목으로 화면 FAIL. (참고: 요약 태그는 '오늘 확정'인데 본문은 '어제' 결과라 문구 정합성은 약함 — offBrief까진 아님)

## 종합
RESULT: FAIL

4개 화면 모두 내용이 두껍고 레이아웃 붕괴·와이어프레임 수준·변형 동일성 문제는 없으며, 상태 전이(로그인 검증, 카운트다운·실시간 가표, 마감/동점 전환, 후보 동적 편집)가 실제로 배선되어 stateInert도 통과한다. 계약의 흐름(index→home→create→vote, vote 내부 마감 전환)과 디자인 토큰·다크모드·모바일 우선도 준수한다. 다만 home.html의 프로필 아바타가 명백히 인터랙티브한 <button>임에도 클릭 핸들러가 없고 '[범위 밖]' 라벨도 없는 dead control이라 home 화면이 FAIL, 이에 따라 전체 결과 FAIL. create의 드래그 핸들 grab 커서(미배선)는 경미 사항으로 통과 처리했다. 아바타를 비대화형화하거나 범위 밖으로 라벨링하면 전 화면 PASS 가능.
