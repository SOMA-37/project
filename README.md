# AI 사주 여행 (Saju Travel)

> 지금 나에게 어울리는 국내 여행지를 사주로 찾아드리는 모바일 웹.

생년월일·출발지·여행 조건·선호 스타일을 입력하면 6단계 Agent 파이프라인이 실행되고,
사주 분석과 함께 어울리는 국내 여행지 Top 3 가 추천됩니다.

---

## ✨ 주요 화면

| 라우트         | 페이지        | 역할                                                         |
| -------------- | ------------- | ------------------------------------------------------------ |
| `/`            | LandingPage   | 서비스 소개 / 진입                                           |
| `/input`       | InputPage     | Solar API 키 · 사주 정보 · 출발지 · 여행 조건 · 선호 스타일  |
| `/analyzing`   | AnalyzingPage | 6단계 Agent 진행 시각화 (서버 SSE 스트림 기반)               |
| `/result`      | ResultPage    | 사주 요약 + 추천 스타일 + 여행지 Top 3 + 점수/추천 이유      |

흐름: `/` → `/input` → `/analyzing` → `/result` → (`/input` 으로 다시 / `/` 처음으로)

`/analyzing` 또는 `/result` 에 store 가 비어 있는 채로 직접 진입하면 자동으로 `/input` 으로 되돌립니다.

---

## 🚀 실행 방법

요구사항: Node.js 18+ / npm, [Upstage Solar API 키](https://console.upstage.ai/)

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 (Vite + 백엔드 미들웨어 단일 프로세스)
npm run dev
# → http://localhost:5173
#   /api/recommend, /api/recommend/stream 엔드포인트가 같은 포트에 마운트됩니다.

# 3) 프로덕션 빌드
npm run build

# 4) 빌드 미리보기 (백엔드 미들웨어 동일하게 동작)
npm run preview

# 5) Lint
npm run lint
```

### Solar API 키 입력

현재는 입력 페이지에서 사용자가 직접 Solar API 키를 입력하면 sessionStorage 에 저장되어 분석 요청 시 `Authorization: Bearer <KEY>` 헤더로 전달됩니다. 후속 작업에서 서버 환경변수(`SOLAR_API_KEY`)에 키를 두어 사용자가 키를 입력하지 않아도 동작하도록 개선될 예정입니다.

### 모델 / 베이스 URL 오버라이드

```bash
# 기본값: solar-pro2 / https://api.upstage.ai/v1
SOLAR_MODEL=solar-pro2 SOLAR_BASE_URL=https://api.upstage.ai/v1 npm run dev
```

---

## 🛠 기술 스택

### 프론트엔드
- **React 19** + **TypeScript**
- **Vite 6**
- **React Router 7**
- **Zustand** (입력/결과 store + API 키 store 분리)
- **Tailwind CSS 3** (보라 `#7C3AED` + 크림 `#FAF5FF` + 골드 `#F59E0B` 톤)

### 백엔드
- **Vite 미들웨어 플러그인** — 별도 서버 프로세스 없이 `/api/*` 를 같은 포트에 마운트
- **Solar API (Upstage)** — `solar-pro2` 모델, OpenAI 호환 chat completions
- **Server-Sent Events (SSE)** — 에이전트 진행 상황을 실시간 스트리밍

---

## 📁 폴더 구조

```
project/
├─ index.html
├─ tailwind.config.js
├─ vite.config.ts                  # sajuApiPlugin() 으로 /api/* 미들웨어 마운트
├─ server/                         # 백엔드 (Node, Vite 미들웨어로 실행)
│  ├─ index.ts                     # /api/recommend, /api/recommend/stream 핸들러
│  ├─ solar.ts                     # Solar API 클라이언트 (Bearer 주입 + JSON 모드)
│  ├─ types.ts                     # 파이프라인 공용 타입
│  ├─ saju/
│  │  └─ baziCalculator.ts         # 결정론적 4주(년·월·일·시) + 오행 분포 계산
│  ├─ data/
│  │  └─ destinations.ts           # 여행지 데이터 + elementAffinity (오행 친화도)
│  └─ agents/
│     ├─ pipeline.ts               # 6단계 오케스트레이터 + 이벤트 emit
│     ├─ inputValidation.ts        # 1) 입력 검증
│     ├─ sajuAnalysis.ts           # 2) 사주 분석 (결정론적 차트 + Solar 내러티브)
│     ├─ travelStyleMapping.ts     # 3) 사주 → 여행 스타일 매핑
│     ├─ destinationRetrieval.ts   # 4) 후보 여행지 검색 (LLM 미사용)
│     ├─ ranking.ts                # 5) 사주/선호/거리 점수 + Solar 추천 이유
│     └─ responseGeneration.ts     # 6) 최종 헤드라인 + 스타일 사유
└─ src/                            # 프론트엔드
   ├─ main.tsx
   ├─ App.tsx                     # 라우터 정의
   ├─ index.css                   # 디자인 토큰 (색/그림자/유틸)
   ├─ types/
   │  └─ index.ts                 # 공용 도메인 타입 (UserInput, PipelineResultDto, ...)
   ├─ store/
   │  ├─ useTravelStore.ts        # userInput / pipelineResult / resetResultOnly
   │  └─ useApiKeyStore.ts        # Solar API 키 (sessionStorage 보관)
   ├─ api/
   │  └─ recommend.ts             # SSE 스트림 파서 (streamRecommendation)
   ├─ pages/
   │  ├─ LandingPage.tsx
   │  ├─ InputPage.tsx
   │  ├─ AnalyzingPage.tsx        # /api/recommend/stream 호출 + 진행 이벤트 시각화
   │  └─ ResultPage.tsx           # 사주 요약 + 정렬 토글 + 점수 분해 카드
   ├─ components/
   │  ├─ common/                  # Button / Card / Header / PageLayout / Tag
   │  ├─ input/                   # ApiKeyInput / DateTimeInput / OriginSelect / RangeSelect / DurationSelect / TagPicker
   │  ├─ analyzing/               # StepIndicator / AgentStepCard
   │  └─ result/                  # SajuSummary / StyleBadge / DestinationCard / ReasonBlock / DisclaimerBox
   ├─ mocks/
   │  ├─ travelStyles.ts          # 6가지 여행 스타일 정의
   │  └─ destinations.ts          # 국내 여행지 메타데이터 (이미지/설명/태그)
   └─ utils/
      └─ destinationLookup.ts     # id → EnrichedDestination
```

---

## 🤖 6-Agent 파이프라인

`POST /api/recommend/stream` 호출 시 다음 6 개 Agent 가 순차 실행되며, 각 단계마다 `agent_start` / `agent_done` 이벤트가 SSE 로 푸시됩니다.

| 단계 | Agent                      | 역할                                                                                                  | LLM |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------- | :-: |
| 1    | **inputValidation**        | API 키 길이, 생년월일 포맷, 시주 enum, 출발지·여행조건 등 입력 검증                                   |  ❌ |
| 2    | **sajuAnalysis**           | 결정론적 4주 계산(60갑자/五虎遁/五鼠遁) + 오행 분포 + Solar 내러티브 + 보완 원소(`needsBoost`) 산출    |  ✅ |
| 3    | **travelStyleMapping**     | 부족한 오행을 보완하는 여행 스타일 가중 → 선호 태그·기피 태그·근거 생성                               |  ✅ |
| 4    | **destinationRetrieval**   | 거리 필터 + 오행 친화도(`elementAffinity`) + 태그/스타일 매칭으로 상위 후보 추출                      |  ❌ |
| 5    | **ranking**                | 사주 / 선호 / 거리 3 개 점수를 독립 계산 후 가중 합산, 사주 보완 요소를 반영한 추천 이유를 Solar 로 생성 |  ✅ |
| 6    | **responseGeneration**     | 최종 헤드라인 + 스타일 사유                                                                            |  ✅ |

### 점수 가중치

- **사주 적합도** 0.5 — `needsBoost` 일치 시 +60, 일간 호응 +12, 과한 오행 페널티 -20
- **선호 매칭** 0.3 — 사용자 태그 교집합 ×18, 매핑 태그 ×8, 스타일 일치 +20
- **거리** 0.2 — 제한 시간 대비 짧을수록 가산, 당일치기 보너스 +5

### 결정론 + LLM Fallback

- 4주(年柱·月柱·日柱·時柱) 계산과 오행 분포는 결정론적이라, **같은 생년월일·시주에는 항상 같은 사주 분석이 나옵니다.**
- Solar 호출이 실패해도 결정론적 fallback 내러티브/추천 이유로 파이프라인이 끝까지 완주합니다.

---

## 🧪 직접 진입 / 새로고침 처리

| 케이스                                         | 동작                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `/analyzing` 진입 시 `userInput` 이 `null`     | `/input` 으로 `replace`                                               |
| `/result` 진입 시 `pipelineResult` 가 `null`   | `/input` 으로 `replace`                                               |
| `/result` 에서 "조건 바꿔서 다시 받기"         | 결과만 초기화(`resetResultOnly`) → `/input` 진입 시 직전 입력 프리필 |
| `/result` 에서 "처음으로"                      | 입력·결과·API 키 전체 초기화 후 `/` 로 이동                           |

---

## 📜 면책

본 결과는 재미와 참고용입니다. 실제 운세 상담이 아니며 의학적·법률적·재정적 조언으로 사용할 수 없습니다.
