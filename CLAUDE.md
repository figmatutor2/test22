# 하네스: 요금제 추천·구독 화면 구현

이 저장소는 `docs/`의 문서 4개로 모바일 웹 화면을 구현하는 하네스다.
메인 대화는 **오케스트레이터**다. 코드를 직접 쓰지 않고, 에이전트를 부르고 게이트를 돌린다.

## 문서 우선순위 (충돌 시)

- 기능·흐름: `docs/PRD.md` > `docs/screens.md`
- 비주얼 규칙: `docs/Design.md`
- 값(SSOT): `docs/tokens.json` — 레이아웃 치수 예외는 `harness/rules.json`의 `layout`만
- `docs/`, `reference/`는 읽기 전용(훅이 막음). 모호하거나 충돌하면 멈추고 사람에게 묻는다. 지어내지 않는다.

## 시작·이어 하기 (사용자: 디자이너 본인)

- "화면 구현 시작" → `npm run harness:start` (브랜치 `harness/run-YYYYMMDD`, state.status = running)
- "이어서 해줘" → `npm run harness:status`와 마지막 `harness(...)` 커밋을 읽고 state.stage부터
- "하네스 중지" → `npm run harness:stop`
- 전역 지침의 "코드 작성 전 계획 보고·승인"은 하네스 실행 중에는 "화면 구현 시작" 한 번으로 갈음한다. 사람 승인 지점은 G5 뒤 1곳뿐이다.

## 파이프라인

| 단계            | 사전 스크립트                                        | 에이전트                    | 게이트                                                                                                                 |
| --------------- | ---------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ① PRD 읽기      | —                                                    | spec-reader                 | `npm run gate:1`                                                                                                       |
| ② 페이지 나누기 | —                                                    | layout-planner              | `npm run gate:2`                                                                                                       |
| ③ 토큰 적용     | `npm run harness:scaffold`, `npm run harness:tokens` | ui-builder                  | `npm run gate:3`                                                                                                       |
| ④ 화면 구현 ×4  | (gate:4가 라우터 자동 생성)                          | screen-builder (화면 1개씩) | `npm run gate:4 -- <route>`                                                                                            |
| ⑤ 검증          | —                                                    | gate-judge                  | `npm run gate:5`                                                                                                       |
| 👤 승인         | —                                                    | —                           | 스크린샷 4장 → "승인" = `npm run harness:approve` / "반려 <route> <사유>" = `npm run harness:reject -- <route> <사유>` |

- ④ 순서: `/plans` → `/plans/:id` → `/apply` → `/complete` (gate:4가 순서를 강제)
- 게이트는 통과하면 자동 커밋한다(`harness(①): 스펙 통과` 형식). 실패 상태로는 커밋되지 않는다. main에는 커밋하지 않는다.

## 오케스트레이터 규칙

1. 에이전트를 부르기 전 `npm run harness:enter -- <agent>`, 끝나면 `npm run harness:exit`.
   훅은 state.activeAgent의 편집 범위 밖 쓰기를 막는다. activeAgent가 없으면(메인 대화) 저장소 안 쓰기를 전부 막는다.
2. 게이트는 `gate-judge`를 불러 돌리고, 반환 형식 그대로 사람에게 보여 준다: 통과/실패 · 규칙 · 파일:줄 · 되돌아갈 단계.
3. 실패 → 되돌아갈 단계의 에이전트에게 실패 리포트를 그대로 넘겨 재시도. 단계당 최대 3회, 초과하면 멈추고 사람에게 보고.
4. 에이전트가 "문서 모호·충돌"로 멈추면, 질문을 사람에게 그대로 전달하고 답을 받은 뒤 같은 에이전트에게 넘긴다.
5. 하네스 실행 중에는 아래 5개 에이전트만 호출한다(훅으로 강제). 다른 에이전트·스킬로 구현하지 않는다.

## 에이전트

| 에이전트       | 편집 범위                    | 부르는 말             |
| -------------- | ---------------------------- | --------------------- |
| spec-reader    | `harness/out/01-spec.json`   | 스펙 뽑아줘           |
| layout-planner | `harness/out/02-layout.json` | 화면 나눠줘           |
| ui-builder     | `src/components/ui/`         | 컴포넌트 만들어줘     |
| screen-builder | `src/pages/`                 | <route> 화면 만들어줘 |
| gate-judge     | 없음 (읽기 전용)             | 판정해줘              |

## 생성 파일 (누구도 직접 편집 금지 — 훅이 막음)

`src/styles/tokens.css`, `src/router.tsx`, `src/main.tsx`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `package.json`

## ⛔ 어기면 안 되는 것 (`harness/rules.json` critical — G4·G5)

- (A) 카드·상세 한 곳에 서로 다른 금액 값 ≤ 2개(매달 내는 금액 + 할인 종료 후 금액), "25개월째부터"는 할인 요금제(p03)에만
- (B) 이름에 "무제한"이 들어간 요금제(p03·p04)의 카드·상세에 "소진 후 ○Mbps로 제한" | "속도 제한 없음" 정확히 1개

## 토큰 밖 값 (훅 + G3·G4·G5가 거부)

색 리터럴 · 단위 붙은 숫자(0, 100% 제외) · Tailwind 임의값 `[...]` · Tailwind 기본 스케일 클래스 · `style` 안 숫자 · 토큰에 없는 `var(--*)`.
허용: `var(--color-*|--spacing-*|--radius-*|--font-*|--text-*|--layout-*)`와 `@theme` 생성 클래스(`p-16`, `bg-bg-surface`, `text-body-medium`, `h-layout-header-h`…).

## 범위 밖

- 로딩·빈·에러 화면, '확인 필요' 3곳(Card/Plan Sale, 상세 통화·문자 행, OptionItem 혜택) — 화면에 나오면 실패
- 상위 `/Users/YiseoHa/CLAUDE.md`의 Storybook·test 파일 요구와 Figma 위임 규칙은 이 하네스에 적용하지 않는다.
  컴포넌트 = `.tsx` + `index.ts`. 판정은 Playwright 렌더링 검사로 대신한다.
