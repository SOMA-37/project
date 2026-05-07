# AI 사주 여행 (Saju Travel MVP)

> 지금 나에게 어울리는 국내 여행지를 사주로 찾아드리는 모바일 웹 데모.

생년월일·출발지·여행 조건·선호 스타일을 입력하면 6단계 Agent 시뮬레이션이 진행되고,
사주 톤의 한 줄 해석과 함께 어울리는 국내 여행지 Top 3 가 추천됩니다.

> ⚠️ **이 프로젝트는 더미 데이터 기반 시연용 MVP 입니다.**
> 실제 사주 / 운세 / 통계 모델이 동작하지 않으며, 추천 결과는 미리 정의된 템플릿과 점수 함수로 만들어집니다. 재미와 참고용으로만 사용해 주세요.

---

## ✨ 주요 화면

| 라우트         | 페이지        | 역할                                         |
| -------------- | ------------- | -------------------------------------------- |
| `/`            | LandingPage   | 서비스 소개 / 진입                           |
| `/input`       | InputPage     | 사주 정보 · 출발지 · 여행 조건 · 선호 스타일 |
| `/analyzing`   | AnalyzingPage | 6단계 Agent 진행 시각화                      |
| `/result`      | ResultPage    | 추천 스타일 + 여행지 Top 3 + 추천 이유       |

흐름: `/` → `/input` → `/analyzing` → `/result` → (`/input` 으로 다시 / `/` 처음으로)

`/analyzing` 또는 `/result` 에 store 가 비어 있는 채로 직접 진입하면 자동으로 `/input` 으로 되돌립니다.

---

## 🚀 실행 방법

요구사항: Node.js 18+ / npm

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 (Vite)
npm run dev
# → http://localhost:5173

# 3) 프로덕션 빌드
npm run build

# 4) 빌드 미리보기
npm run preview

# 5) Lint
npm run lint
```

---

## 🛠 기술 스택

- **React 19** + **TypeScript**
- **Vite 6**
- **React Router 7**
- **Zustand** (전역 상태)
- **Tailwind CSS 3** (보라 `#7C3AED` + 크림 `#FAF5FF` + 골드 `#F59E0B` 톤)

---

## 📁 폴더 구조

```
project/
├─ index.html
├─ tailwind.config.js
├─ vite.config.ts
└─ src/
   ├─ main.tsx
   ├─ App.tsx                     # 라우터 정의
   ├─ index.css                   # 디자인 토큰 (색/그림자/유틸)
   ├─ types/
   │  └─ index.ts                 # 공용 도메인 타입 (UserInput, Destination, ...)
   ├─ store/
   │  └─ useTravelStore.ts        # 전역 store (userInput / result)
   ├─ pages/
   │  ├─ LandingPage.tsx
   │  ├─ InputPage.tsx
   │  ├─ AnalyzingPage.tsx        # 6단계 시뮬레이션 + setResult + navigate('/result')
   │  └─ ResultPage.tsx           # 추천 결과 화면
   ├─ components/
   │  ├─ common/                  # Button / Card / Header / PageLayout / Tag
   │  ├─ input/                   # DateTimeInput / OriginSelect / RangeSelect / DurationSelect / TagPicker
   │  ├─ analyzing/               # StepIndicator / AgentStepCard
   │  └─ result/                  # StyleBadge / DestinationCard / ReasonBlock / DisclaimerBox
   ├─ mocks/
   │  ├─ travelStyles.ts          # 6가지 여행 스타일 정의
   │  ├─ destinations.ts          # 15개 국내 여행지
   │  └─ analysisFlow.ts          # 6단계 Agent 진행 메시지
   └─ utils/
      └─ recommend.ts             # getRecommendation() — 점수/필터/템플릿 기반 추천
```

---

## 👥 분업 영역

| 영역             | 파일 / 디렉터리                                                                                                        | 담당                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 공통 디자인 시스템 | `src/components/common/*`, `src/index.css`, `tailwind.config.js`                                                      | A — 공용 컴포넌트     |
| 랜딩 / 입력 화면   | `src/pages/LandingPage.tsx`, `src/pages/InputPage.tsx`, `src/components/input/*`                                       | A — 입력 흐름        |
| 공용 타입 / 스토어 | `src/types/index.ts`, `src/store/useTravelStore.ts`                                                                    | A · B 공용 (수정 합의) |
| 분석 화면         | `src/pages/AnalyzingPage.tsx`, `src/components/analyzing/*`                                                            | B — Agent 시각화      |
| 결과 화면         | `src/pages/ResultPage.tsx`, `src/components/result/*`                                                                  | B — 결과 / 추천 로직  |
| 더미 데이터 / 추천 | `src/mocks/destinations.ts`, `src/mocks/travelStyles.ts`, `src/mocks/analysisFlow.ts`, `src/utils/recommend.ts`        | B — 데이터 / 로직     |

---

## 🔮 추천 로직 (요약)

`src/utils/recommend.ts` 의 `getRecommendation(userInput)` 한 함수에 모여 있으며 LLM 호출 없이 동작합니다.

1. **이동 시간 필터** — `userInput.travelRange` 의 상한 시간과 출발지 기준 `destination.travelTime[departure]` 비교
2. **태그 매칭 점수** — `preferredStyles ∩ destination.tags` 의 크기 × 2
3. **근접 보너스** — 제한 시간 대비 이동시간이 짧을수록 가산
4. **당일치기 보너스** — `travelDuration === '당일'` + 이동시간 ≤ 2 시간이면 +0.5
5. 점수 정렬 후 상위 3 곳을 추천
6. 추천된 3 곳의 `styles` 빈도수를 합산해 가장 많이 나온 1~2 개를 결과 스타일(StyleKey)로 선정
7. 스타일 / 여행지별 추천 이유는 미리 정의된 사주 톤 템플릿에 키워드를 끼워 생성

---

## 🧪 직접 진입 / 새로고침 처리

| 케이스                                         | 동작                          |
| ---------------------------------------------- | ----------------------------- |
| `/analyzing` 진입 시 `userInput` 이 `null`     | `/input` 으로 `replace`       |
| `/result` 진입 시 `result` 가 `null`           | `/input` 으로 `replace`       |
| `/result` 에서 "조건 바꿔서 다시 받기"         | `/input` 으로 이동            |
| `/result` 에서 "처음으로"                      | `/` 로 이동                   |

---

## 📜 면책

본 결과는 재미와 참고용입니다. 실제 운세 상담이 아니며, 사주 데이터는 더미로 생성됩니다.
