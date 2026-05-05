# 03. Agent Workflow 설계서

# 사주 기반 국내 여행지 추천 Agent Workflow

## 1. 문서 목적

이 문서는 사주 기반 국내 여행지 추천 Agent MVP의 Agent Workflow를 정의하기 위한 문서입니다.

이번 프로젝트는 단순히 LLM에게 “여행지를 추천해줘”라고 요청하는 서비스가 아니라, 사용자의 입력값을 바탕으로 여러 단계를 거쳐 추천 결과를 생성하는 Agentic AI 기반 서비스입니다.

따라서 이 문서에서는 다음 내용을 명확히 정의합니다.

1. 전체 Agent Workflow가 어떤 순서로 동작하는지
2. 각 Agent가 어떤 역할을 담당하는지
3. 각 단계의 입력값과 출력값이 무엇인지
4. LangChain 또는 LangGraph를 적용한다면 어떤 방식으로 적용할 수 있는지
5. MVP에서는 어떤 수준까지 구현하고, 어떤 부분은 고도화 범위로 둘 것인지
6. 개발자가 실제 코드로 구현할 때 어떤 단위로 나누면 되는지

이 문서는 개발 담당자가 Agent 흐름을 구현할 때 참고하는 기준 문서입니다.

기능별 입력값, 출력값, 예외 처리는 02_function_spec.md에서 관리합니다.  
여행지 데이터 구조는 04_data_schema.md에서 관리합니다.  
일정과 담당자 관리는 05_wbs.md에서 관리합니다.

---

## 2. Agent Workflow 설계 방향

이번 프로젝트의 Agent Workflow는 다음 원칙을 따릅니다.

## 2.1 단순 LLM 호출로 끝내지 않는다

지양하는 방식은 다음과 같습니다.

    사용자 입력
    → LLM에게 전체 추천 요청
    → LLM이 여행지와 추천 이유를 한 번에 생성
    → 결과 출력

이 방식은 구현은 빠르지만 다음 문제가 있습니다.

| 문제 | 설명 |
|---|---|
| 추천 기준 불명확 | LLM이 어떤 기준으로 여행지를 골랐는지 설명하기 어렵다 |
| 결과 제어 어려움 | 여행지 추천 결과가 매번 달라질 수 있다 |
| 존재하지 않는 여행지 생성 가능 | LLM이 데이터에 없는 여행지를 만들어낼 수 있다 |
| Agentic AI 설명 어려움 | 단순 프롬프트 호출에 가까워진다 |
| 개발 개선 어려움 | 분석, 매핑, 추천, 생성 중 어떤 단계가 문제인지 파악하기 어렵다 |

따라서 이번 프로젝트는 LLM 호출을 전체 추천의 한 번 호출로 처리하지 않고, 여러 단계로 나누어 사용합니다.

---

## 2.2 Agent 역할을 분리한다

이번 MVP에서는 다음과 같이 역할을 분리합니다.

    사용자 입력
    → A1. Input Validation Agent
    → A2. Saju Analysis Agent
    → A3. Travel Style Mapping Agent
    → A4. Destination Retrieval Agent
    → A5. Ranking Agent
    → A6. Response Generation Agent
    → 결과 카드 출력

각 Agent는 하나의 역할에 집중합니다.

| Agent | 역할 |
|---|---|
| A1. Input Validation Agent | 사용자 입력값 검증 및 정규화 |
| A2. Saju Analysis Agent | 사주 기반 현재 상태 또는 필요한 기운 분석 |
| A3. Travel Style Mapping Agent | 사주 분석 결과를 여행 스타일로 변환 |
| A4. Destination Retrieval Agent | 여행지 데이터에서 후보 여행지 검색 |
| A5. Ranking Agent | 점수 기준에 따라 Top3 여행지 선정 |
| A6. Response Generation Agent | 최종 추천 이유 생성 |

---

## 2.3 LLM과 코드 로직의 역할을 구분한다

이번 MVP에서 LLM이 담당하는 부분과 코드 로직이 담당하는 부분을 명확히 나눕니다.

| 구분 | 담당 방식 | 내용 |
|---|---|---|
| 입력값 검증 | 코드 로직 | 필수값 누락, 출생 시간 모름 처리 |
| 사주 기반 분석 | LLM 또는 간단 규칙 + LLM | 생년월일시와 12지시 기반 해석 |
| 여행 스타일 매핑 | LLM 또는 규칙 기반 매핑 | 분석 결과를 6개 스타일 중 하나로 변환 |
| 여행지 데이터 검색 | 코드 로직 | JSON/CSV 데이터 필터링 |
| 추천 점수 계산 | 코드 로직 | 스타일, 거리, 기간, 선호 태그 기준 점수 계산 |
| Top3 선정 | 코드 로직 | 점수 기준 정렬 |
| 추천 이유 생성 | LLM | 선정된 여행지에 대한 자연어 설명 생성 |
| 결과 화면 출력 | Streamlit | 카드 형태 렌더링 |

핵심 원칙은 다음과 같습니다.

LLM은 해석과 자연어 생성에 사용하고, 추천 후보 선정과 점수 계산은 코드 로직으로 제어합니다.

이렇게 하면 추천 결과를 더 안정적으로 관리할 수 있고, 발표에서도 “LLM이 모든 것을 임의로 생성하는 구조가 아니라 데이터와 로직을 기반으로 추천했다”고 설명할 수 있습니다.

---

## 3. 전체 Workflow 개요

## 3.1 사용자 관점 흐름

사용자 관점에서 서비스 흐름은 다음과 같습니다.

    1. 사용자가 생년월일, 출생 시간, 여행 조건을 입력한다.
    2. 추천 받기 버튼을 클릭한다.
    3. 시스템이 입력값을 검증한다.
    4. 사주 기반으로 현재 상태 또는 필요한 기운을 분석한다.
    5. 분석 결과를 여행 스타일로 변환한다.
    6. 여행지 데이터에서 조건에 맞는 후보를 찾는다.
    7. 추천 점수를 계산해 Top3 여행지를 선정한다.
    8. 각 여행지에 대한 추천 이유를 생성한다.
    9. 결과 화면에서 여행 스타일과 추천 여행지 3곳을 확인한다.

---

## 3.2 시스템 관점 흐름

시스템 관점의 전체 흐름은 다음과 같습니다.

    User Input
    ↓
    Input Validation Agent
    ↓
    Saju Analysis Agent
    ↓
    Travel Style Mapping Agent
    ↓
    Destination Retrieval Agent
    ↓
    Ranking Agent
    ↓
    Response Generation Agent
    ↓
    Result Rendering

각 단계는 이전 단계의 결과를 받아 다음 단계로 전달합니다.

---

## 3.3 MVP 기준 최종 Workflow

MVP에서는 너무 복잡한 구조를 피하고 다음 흐름을 우선 구현합니다.

    validate_input()
    → analyze_saju()
    → map_travel_style()
    → load_destinations()
    → filter_destinations()
    → rank_destinations()
    → generate_reasons()
    → render_result()

이 흐름은 함수 기반으로 먼저 구현할 수 있습니다.

이후 시간이 가능하면 LangChain Runnable 또는 LangGraph StateGraph 형태로 감쌉니다.

---

## 4. Workflow State 정의

Agent 간 데이터를 전달하기 위해 하나의 상태 객체를 사용합니다.

MVP에서는 Python dict 또는 dataclass 형태로 관리할 수 있습니다.

## 4.1 State 전체 구조

아래는 전체 Workflow에서 공유되는 상태 값 예시입니다.

    {
      "user_input": {
        "birth_date": "1999-03-14",
        "birth_time_branch": "신시",
        "birth_time_unknown": false,
        "calendar_type": "양력",
        "departure_region": "서울",
        "travel_range": "3시간 이내",
        "duration": "1박2일",
        "preference_tags": ["바다", "카페"]
      },
      "validation": {
        "is_valid": true,
        "errors": []
      },
      "saju_analysis": {
        "saju_summary": "최근에는 지친 감정을 정리하고 안정감을 회복하는 시간이 어울립니다.",
        "saju_keywords": ["회복", "안정", "정리"],
        "caution_message": ""
      },
      "travel_style": {
        "primary_style": "감정 회복형",
        "secondary_style": "자기 성찰형",
        "style_keywords": ["회복", "안정", "산책"],
        "style_reason": "현재 흐름에서는 조용히 감정을 정리하고 회복할 수 있는 여행이 어울립니다."
      },
      "candidate_destinations": [],
      "ranked_destinations": [],
      "recommendations": [],
      "messages": [],
      "metadata": {
        "relaxed_conditions": false,
        "llm_fallback_used": false
      }
    }

## 4.2 State 필드 설명

| 필드 | 설명 |
|---|---|
| user_input | 사용자가 입력한 원본 또는 정규화된 입력값 |
| validation | 입력값 검증 결과 |
| saju_analysis | 사주 기반 간단 분석 결과 |
| travel_style | 여행 스타일 매핑 결과 |
| candidate_destinations | 조건에 맞는 후보 여행지 목록 |
| ranked_destinations | 점수 계산 후 정렬된 여행지 목록 |
| recommendations | 최종 출력용 추천 결과 |
| messages | 사용자에게 보여줄 안내 메시지 |
| metadata | 조건 완화 여부, LLM fallback 여부 등 내부 상태 |

---

## 5. Agent별 상세 설계

## 5.1 A1. Input Validation Agent

## 5.1.1 역할

Input Validation Agent는 사용자가 입력한 값을 검증하고, 이후 Agent가 사용할 수 있는 형태로 정리합니다.

이 단계는 LLM을 사용하지 않고 코드 로직으로 처리합니다.

## 5.1.2 입력

| 필드 | 설명 |
|---|---|
| birth_date | 생년월일 |
| birth_time_branch | 출생 시간 12지시 |
| birth_time_unknown | 출생 시간 모름 여부 |
| calendar_type | 양력/음력 |
| departure_region | 출발 지역 |
| travel_range | 이동 가능 범위 |
| duration | 여행 기간 |
| preference_tags | 선호 태그 |

## 5.1.3 처리 내용

1. 생년월일이 입력되었는지 확인한다.
2. 출발 지역이 선택되었는지 확인한다.
3. 이동 가능 범위가 선택되었는지 확인한다.
4. 여행 기간이 선택되었는지 확인한다.
5. 출생 시간이 “모름”이면 birth_time_unknown을 true로 설정한다.
6. travel_range를 내부 숫자 기준으로 변환한다.
7. preference_tags가 없으면 빈 배열로 처리한다.

## 5.1.4 출력

| 필드 | 설명 |
|---|---|
| validation.is_valid | 검증 성공 여부 |
| validation.errors | 오류 메시지 목록 |
| user_input | 정규화된 사용자 입력값 |

## 5.1.5 예외 처리

| 상황 | 처리 |
|---|---|
| 생년월일 없음 | 생년월일을 입력해 주세요. |
| 출발 지역 없음 | 출발 지역을 선택해 주세요. |
| 이동 가능 범위 없음 | 이동 가능 범위를 선택해 주세요. |
| 여행 기간 없음 | 여행 기간을 선택해 주세요. |

## 5.1.6 완료 기준

- 필수 입력값 누락을 감지할 수 있다.
- 검증 실패 시 이후 Agent를 실행하지 않는다.
- 검증 성공 시 다음 단계로 정규화된 입력값을 전달한다.

---

## 5.2 A2. Saju Analysis Agent

## 5.2.1 역할

Saju Analysis Agent는 사용자의 생년월일과 출생 시간을 기반으로 사주 기반 간단 분석을 수행합니다.

MVP에서는 전문 만세력 계산을 직접 구현하지 않습니다.  
대신 입력된 생년월일, 양력 기준 여부, 12지시 출생 시간을 LLM 프롬프트에 전달하고, 현재 상태나 필요한 기운을 여행 추천에 활용 가능한 키워드로 요약합니다.

이 Agent의 목적은 전문 사주 상담이 아니라 여행 스타일 매핑을 위한 중간 해석을 생성하는 것입니다.

## 5.2.2 입력

| 필드 | 설명 |
|---|---|
| birth_date | 생년월일 |
| birth_time_branch | 자시, 축시, 인시 등 12지시 |
| birth_time_unknown | 출생 시간 모름 여부 |
| calendar_type | 양력/음력 |

## 5.2.3 출생 시간 기준

MVP에서는 한국 만세력 기준 12지시 시간표를 입력값으로 사용합니다.

| 12지시 | 시간대 |
|---|---|
| 자시 子時 | 23:30 ~ 01:30 |
| 축시 丑時 | 01:30 ~ 03:30 |
| 인시 寅時 | 03:30 ~ 05:30 |
| 묘시 卯時 | 05:30 ~ 07:30 |
| 진시 辰時 | 07:30 ~ 09:30 |
| 사시 巳時 | 09:30 ~ 11:30 |
| 오시 午時 | 11:30 ~ 13:30 |
| 미시 未時 | 13:30 ~ 15:30 |
| 신시 申時 | 15:30 ~ 17:30 |
| 유시 酉時 | 17:30 ~ 19:30 |
| 술시 戌時 | 19:30 ~ 21:30 |
| 해시 亥時 | 21:30 ~ 23:30 |

자시는 전날 23:30부터 당일 01:30까지 걸쳐 있는 시간대입니다.  
MVP에서는 사용자가 직접 자시를 선택하도록 하고, 날짜 보정 로직은 구현하지 않습니다.

## 5.2.4 처리 내용

1. 생년월일과 출생 시간 정보를 확인한다.
2. 출생 시간이 있으면 해당 12지시를 분석 문맥에 포함한다.
3. 출생 시간이 없으면 생년월일 중심으로 단순 분석한다.
4. 결과를 여행 스타일 매핑에 사용할 수 있는 키워드로 요약한다.
5. 과도하게 운세처럼 단정하지 않도록 한다.
6. 의료, 재물, 연애, 합격, 건강 관련 단정 표현은 생성하지 않는다.

## 5.2.5 출력

| 필드 | 설명 | 예시 |
|---|---|---|
| saju_summary | 사주 기반 간단 분석 요약 | 최근에는 감정을 정리하고 안정감을 회복하는 흐름이 어울립니다. |
| saju_keywords | 여행 스타일 매핑용 키워드 | 회복, 안정, 정리 |
| caution_message | 참고용 안내 | 이 분석은 재미와 참고용입니다. |

## 5.2.6 프롬프트 방향

Saju Analysis Agent의 프롬프트는 다음 원칙을 따릅니다.

- 전문 사주 상담처럼 단정하지 않는다.
- 여행 추천을 위한 상태 해석에 집중한다.
- 결과는 감정, 에너지, 관계, 성찰, 활동, 문화 탐방과 연결 가능한 키워드로 정리한다.
- 출력은 다음 단계에서 사용하기 쉽게 구조화한다.

프롬프트에 포함할 정보:

    역할:
    당신은 사주를 전문적으로 단정하는 상담사가 아니라, 여행 추천을 위한 가벼운 자기해석 도우미입니다.

    입력:
    - 생년월일
    - 양력/음력
    - 출생 시간 12지시
    - 출생 시간 모름 여부

    요구사항:
    - 사용자의 현재 상태나 필요한 에너지를 가볍게 해석합니다.
    - 결과는 여행 스타일 매핑에 사용할 수 있는 키워드로 정리합니다.
    - 연애, 재물, 건강, 합격 등 민감한 운세는 단정하지 않습니다.
    - 재미와 참고용이라는 톤을 유지합니다.

    출력:
    - saju_summary
    - saju_keywords
    - caution_message

## 5.2.7 예외 처리

| 상황 | 처리 |
|---|---|
| 출생 시간 모름 | 생년월일 중심으로 단순 분석 |
| LLM 호출 실패 | 기본 분석 템플릿 사용 |
| 응답 형식 오류 | 키워드 기반 fallback 사용 |
| 음력 변환 미지원 | 양력 기준 분석 안내 |

## 5.2.8 완료 기준

- 입력값을 바탕으로 사주 분석 요약을 생성한다.
- 분석 결과에 여행 스타일 매핑용 키워드가 포함된다.
- 출생 시간 모름 케이스를 처리한다.
- 결과가 과도하게 운세처럼 단정되지 않는다.

---

## 5.3 A3. Travel Style Mapping Agent

## 5.3.1 역할

Travel Style Mapping Agent는 Saju Analysis Agent의 분석 결과를 여행 스타일로 변환합니다.

이 Agent는 코치 피드백에서 강조된 “사용자 니즈와 연결되는 수준의 키워드 구체화”를 반영하는 핵심 단계입니다.

기존의 회복형, 활력형, 교류형 같은 추상적인 표현을 다음 6개 스타일로 구체화합니다.

| 스타일 ID | 여행 스타일 | 사용자 니즈 |
|---|---|---|
| STYLE_01 | 감정 회복형 | 지친 감정을 정리하고 안정감을 얻고 싶음 |
| STYLE_02 | 에너지 충전형 | 답답함을 풀고 활력을 얻고 싶음 |
| STYLE_03 | 인간관계 환기형 | 사람들과 분위기를 전환하고 싶음 |
| STYLE_04 | 자기 성찰형 | 혼자 생각을 정리하고 싶음 |
| STYLE_05 | 액티비티 중심형 | 몸을 움직이며 스트레스를 풀고 싶음 |
| STYLE_06 | 문화 탐방형 | 새로운 취향과 자극을 얻고 싶음 |

## 5.3.2 입력

| 필드 | 설명 |
|---|---|
| saju_summary | 사주 분석 요약 |
| saju_keywords | 사주 분석 키워드 |

## 5.3.3 처리 내용

1. saju_keywords를 확인한다.
2. 키워드를 6개 여행 스타일 중 하나로 매핑한다.
3. 가장 강한 스타일을 primary_style로 선택한다.
4. 보조 스타일이 있으면 secondary_style로 선택한다.
5. 스타일 도출 이유를 한두 문장으로 생성한다.

## 5.3.4 매핑 기준

| 분석 키워드 | 매핑 스타일 |
|---|---|
| 회복, 안정, 정리, 휴식 | 감정 회복형 |
| 활력, 전환, 자극, 에너지 | 에너지 충전형 |
| 관계, 소통, 분위기 전환 | 인간관계 환기형 |
| 내면, 혼자, 집중, 사색 | 자기 성찰형 |
| 활동, 도전, 움직임, 스트레스 해소 | 액티비티 중심형 |
| 취향, 예술, 역사, 배움 | 문화 탐방형 |

## 5.3.5 출력

| 필드 | 설명 | 예시 |
|---|---|---|
| primary_style | 필수 여행 스타일 | 감정 회복형 |
| secondary_style | 선택 보조 스타일 | 자기 성찰형 |
| style_keywords | 스타일 도출 키워드 | 회복, 안정, 산책 |
| style_reason | 스타일 도출 이유 | 최근에는 조용히 감정을 정리하고 회복할 수 있는 여행이 어울립니다. |

## 5.3.6 LLM 사용 여부

MVP에서는 두 가지 방식 중 하나를 선택할 수 있습니다.

| 방식 | 설명 | 권장 상황 |
|---|---|---|
| 규칙 기반 매핑 | saju_keywords에 따라 코드로 스타일 매핑 | 데모 안정성 우선 |
| LLM 기반 매핑 | 분석 결과를 LLM에 전달해 스타일 선택 | 자연어 품질 우선 |

권장 MVP 방식은 다음과 같습니다.

1. 먼저 규칙 기반 매핑으로 안정적인 결과를 만든다.
2. 시간이 가능하면 LLM을 사용해 style_reason 문장을 자연스럽게 만든다.

## 5.3.7 예외 처리

| 상황 | 처리 |
|---|---|
| 키워드가 비어 있음 | 기본 스타일로 감정 회복형 또는 에너지 충전형 사용 |
| 매핑이 애매함 | primary_style 하나만 선택 |
| LLM 응답 실패 | 규칙 기반 결과 사용 |

## 5.3.8 완료 기준

- 6개 스타일 중 하나가 primary_style로 반드시 선택된다.
- style_reason이 생성된다.
- 추천 로직에서 사용할 수 있는 값으로 반환된다.

---

## 5.4 A4. Destination Retrieval Agent

## 5.4.1 역할

Destination Retrieval Agent는 여행지 데이터에서 사용자 조건에 맞는 후보 여행지를 찾습니다.

이 단계는 LLM이 아니라 코드 로직으로 처리합니다.

LLM이 여행지를 임의로 생성하지 않도록, 추천 후보는 반드시 사전에 정의한 여행지 데이터 안에서만 선택합니다.

## 5.4.2 입력

| 필드 | 설명 |
|---|---|
| departure_region | 출발 지역 |
| travel_range | 이동 가능 범위 |
| duration | 여행 기간 |
| preference_tags | 사용자 선호 태그 |
| primary_style | 사용자 주요 여행 스타일 |
| secondary_style | 사용자 보조 여행 스타일 |
| destinations | 여행지 데이터 목록 |

## 5.4.3 처리 내용

1. 여행지 데이터를 로딩한다.
2. 이동 가능 범위에 맞는 여행지를 우선 필터링한다.
3. 여행 기간에 맞는 여행지를 필터링한다.
4. primary_style 또는 secondary_style과 관련 있는 여행지를 우선 후보로 남긴다.
5. preference_tags는 필터링보다 점수 계산에 주로 활용한다.
6. 후보가 부족하면 조건 완화 플래그를 설정한다.

## 5.4.4 필터링 기준

| 기준 | 설명 | MVP 적용 |
|---|---|---|
| 이동 가능 범위 | distance_hours가 travel_range 이하인지 확인 | 필수 |
| 여행 기간 | available_duration에 duration이 포함되는지 확인 | 필수 |
| 여행 스타일 | style_tags에 primary_style 또는 secondary_style 포함 | 권장 |
| 선호 태그 | preference_tags와 place_tags 비교 | 선택 |
| 출발 지역 | departure_region 기준 이동 시간 사용 | 선택 |

MVP에서는 출발 지역별 정확한 이동 시간을 모두 계산하기 어렵기 때문에, 우선 서울 출발 기준 데이터로 동작하게 만들고 필요 시 대전 기준 데이터를 추가합니다.

## 5.4.5 출력

| 필드 | 설명 |
|---|---|
| candidate_destinations | 조건에 맞는 후보 여행지 목록 |
| metadata.relaxed_conditions | 조건 완화 여부 |
| messages | 조건 완화 안내 메시지 |

## 5.4.6 후보 부족 시 조건 완화

후보가 3개 미만인 경우 다음 순서로 조건을 완화합니다.

| 순서 | 완화 방식 | 설명 |
|---:|---|---|
| 1 | secondary_style 포함 | primary_style만 보던 것을 secondary_style까지 확장 |
| 2 | 선호 태그 조건 제거 | 선호 태그는 필터링에서 제외하고 점수에서만 반영 |
| 3 | 이동 범위 1단계 완화 | 2시간 이내면 3시간 이내로 완화 |
| 4 | 여행 기간 조건 완화 | 당일/1박2일 모두 가능한 후보 포함 |
| 5 | 기본 후보 사용 | 그래도 부족하면 기본 샘플 후보 사용 |

조건 완화 안내 문구:

    입력하신 조건에 정확히 맞는 여행지가 부족하여 일부 조건을 완화해 추천했습니다.

## 5.4.7 예외 처리

| 상황 | 처리 |
|---|---|
| 데이터 파일 없음 | 여행지 데이터를 불러올 수 없습니다. |
| 데이터 형식 오류 | 데이터 형식을 확인해 주세요. |
| 후보 0개 | 기본 후보 사용 |
| 필수 필드 누락 | 해당 여행지를 제외하거나 기본값 처리 |

## 5.4.8 완료 기준

- 여행지 데이터를 로딩할 수 있다.
- 이동 가능 범위와 여행 기간 기준으로 후보를 필터링할 수 있다.
- 후보가 부족한 경우 조건 완화 로직을 실행할 수 있다.
- LLM이 생성한 여행지가 아니라 데이터 기반 후보만 사용한다.

---

## 5.5 A5. Ranking Agent

## 5.5.1 역할

Ranking Agent는 후보 여행지에 점수를 부여하고 Top3 여행지를 선정합니다.

이 단계도 LLM이 아니라 코드 로직으로 처리합니다.

## 5.5.2 입력

| 필드 | 설명 |
|---|---|
| candidate_destinations | 후보 여행지 목록 |
| primary_style | 주요 여행 스타일 |
| secondary_style | 보조 여행 스타일 |
| travel_range | 이동 가능 범위 |
| duration | 여행 기간 |
| preference_tags | 사용자 선호 태그 |

## 5.5.3 점수 기준

추천 점수는 100점 기준으로 계산합니다.

| 기준 | 점수 |
|---|---:|
| 여행 스타일 태그 일치 | 50점 |
| 이동 가능 범위 충족 | 20점 |
| 여행 기간 일치 | 15점 |
| 사용자 선호 태그 일치 | 10점 |
| 추천 활동 데이터 존재 | 5점 |
| 총점 | 100점 |

## 5.5.4 세부 점수 기준

### 여행 스타일 태그 일치

| 조건 | 점수 |
|---|---:|
| primary_style이 style_tags에 포함 | 50 |
| secondary_style이 style_tags에 포함 | 35 |
| place_tags가 스타일과 관련 있음 | 20 |
| 관련 없음 | 0 |

### 이동 가능 범위 충족

| 조건 | 점수 |
|---|---:|
| distance_hours가 travel_range 이내 | 20 |
| 조건 완화로 포함됨 | 10 |
| 이동 범위 초과 | 0 |

### 여행 기간 일치

| 조건 | 점수 |
|---|---:|
| available_duration에 사용자 duration 포함 | 15 |
| 기간 정보가 없지만 추천 가능 | 5 |
| 기간이 맞지 않음 | 0 |

### 사용자 선호 태그 일치

| 조건 | 점수 |
|---|---:|
| 선호 태그 2개 이상 일치 | 10 |
| 선호 태그 1개 일치 | 5 |
| 선호 태그 미선택 | 5 |
| 일치 없음 | 0 |

### 추천 활동 데이터 존재

| 조건 | 점수 |
|---|---:|
| activities 3개 이상 | 5 |
| activities 2개 | 3 |
| activities 1개 | 1 |
| activities 없음 | 0 |

## 5.5.5 정렬 기준

후보 여행지는 다음 기준으로 정렬합니다.

1. 총점 높은 순
2. 총점이 같으면 primary_style 일치 여부 우선
3. 그래도 같으면 이동 시간이 짧은 순
4. 그래도 같으면 activities 개수가 많은 순
5. 그래도 같으면 데이터 순서 기준

## 5.5.6 출력

| 필드 | 설명 |
|---|---|
| ranked_destinations | 점수 계산 후 정렬된 여행지 목록 |
| recommendations | 상위 3개 여행지 |

## 5.5.7 완료 기준

- 후보 여행지에 score를 부여할 수 있다.
- 점수 기준으로 정렬할 수 있다.
- 상위 3개 여행지를 선택할 수 있다.
- 후보가 3개 미만이어도 앱이 중단되지 않는다.

---

## 5.6 A6. Response Generation Agent

## 5.6.1 역할

Response Generation Agent는 최종 선정된 Top3 여행지에 대해 사용자에게 보여줄 추천 이유를 생성합니다.

이 단계에서는 LLM을 사용할 수 있습니다.

다만 LLM은 여행지를 새로 고르는 역할이 아니라, 이미 선정된 여행지에 대해 자연어 설명을 만드는 역할만 담당합니다.

## 5.6.2 입력

| 필드 | 설명 |
|---|---|
| primary_style | 사용자 주요 여행 스타일 |
| secondary_style | 사용자 보조 여행 스타일 |
| style_reason | 스타일 도출 이유 |
| recommendations | Top3 여행지 |
| place_tags | 여행지 태그 |
| activities | 추천 활동 |
| disclaimer | 재미와 참고용 안내 |

## 5.6.3 처리 내용

1. Top3 여행지 정보를 LLM에 전달한다.
2. 각 여행지별 추천 이유를 생성한다.
3. 추천 이유는 사용자 여행 스타일과 연결한다.
4. 존재하지 않는 활동이나 장소를 새로 만들지 않는다.
5. 과도하게 운세처럼 단정하지 않는다.
6. 최종 결과에 면책 문구를 포함한다.

## 5.6.4 프롬프트 방향

Response Generation Agent의 프롬프트는 다음 원칙을 따릅니다.

    역할:
    당신은 사용자의 여행 스타일에 맞춰 추천 이유를 작성하는 여행 추천 도우미입니다.

    입력:
    - 사용자 여행 스타일
    - 스타일 도출 이유
    - 추천 여행지 Top3
    - 각 여행지의 태그
    - 각 여행지의 추천 활동

    요구사항:
    - 제공된 여행지와 활동 정보 안에서만 설명합니다.
    - 여행지를 새로 생성하지 않습니다.
    - 추천 이유는 2~3문장 이내로 작성합니다.
    - 사주 결과를 절대적인 운세처럼 단정하지 않습니다.
    - 재미와 참고용 톤을 유지합니다.

    출력:
    - 여행지명
    - 추천 이유
    - 추천 활동 요약

## 5.6.5 출력

| 필드 | 설명 |
|---|---|
| recommendations | 추천 이유가 포함된 Top3 여행지 목록 |
| disclaimer | 재미와 참고용 안내 문구 |

출력 예시:

    {
      "rank": 1,
      "name": "강릉",
      "reason": "강릉은 바다 산책과 카페 투어를 통해 감정을 정리하고 회복하기 좋은 여행지입니다. 조용한 풍경 속에서 부담 없이 1박 2일을 보내고 싶은 사용자에게 잘 어울립니다.",
      "activities": ["안목해변 산책", "카페거리 방문", "경포대 둘러보기"]
    }

## 5.6.6 예외 처리

| 상황 | 처리 |
|---|---|
| LLM 호출 실패 | 기본 템플릿으로 추천 이유 생성 |
| 응답이 너무 김 | 필요한 문장만 잘라서 사용 |
| 응답 형식 오류 | 여행지별 기본 reason 생성 |
| 존재하지 않는 정보 생성 | 기존 데이터 기반 reason으로 대체 |

기본 추천 이유 템플릿:

    {여행지명}은 {primary_style}에 어울리는 태그와 활동을 가진 여행지입니다.
    {추천활동}을 통해 현재 여행 목적에 맞는 시간을 보낼 수 있습니다.

## 5.6.7 완료 기준

- 각 추천 여행지마다 추천 이유가 생성된다.
- 추천 이유는 여행 스타일과 연결된다.
- 제공된 여행지 데이터 안에서만 설명한다.
- LLM 실패 시에도 결과 화면이 출력된다.

---

## 6. LangChain 적용 방향

## 6.1 적용 목적

LangChain은 각 단계의 프롬프트 호출과 데이터 전달 흐름을 정리하기 위해 사용할 수 있습니다.

이번 MVP에서 LangChain을 사용하는 목적은 다음과 같습니다.

1. 사주 분석 프롬프트를 별도 Chain으로 관리한다.
2. 여행 스타일 매핑 프롬프트를 별도 Chain으로 관리한다.
3. 추천 이유 생성 프롬프트를 별도 Chain으로 관리한다.
4. 각 단계의 입력과 출력을 구조화한다.
5. 발표에서 단순 LLM 호출이 아니라 Chain 기반 흐름을 설명할 수 있다.

## 6.2 LangChain 적용 가능 단계

| 단계 | LangChain 적용 여부 |
|---|---|
| Input Validation | 적용하지 않음 |
| Saju Analysis | 적용 가능 |
| Travel Style Mapping | 적용 가능 |
| Destination Retrieval | 적용하지 않음 |
| Ranking | 적용하지 않음 |
| Response Generation | 적용 가능 |

## 6.3 MVP 적용 우선순위

LangChain 적용 우선순위는 다음과 같습니다.

| 우선순위 | 내용 |
|---|---|
| 1순위 | Response Generation Chain |
| 2순위 | Saju Analysis Chain |
| 3순위 | Travel Style Mapping Chain |

개발 시간이 부족하면 LangChain을 무리하게 적용하지 않고, 함수 기반 구조로 구현해도 됩니다.

다만 함수 이름과 입출력을 Agent 단위로 분리하여 발표에서 Agent Workflow로 설명할 수 있게 합니다.

---

## 7. LangGraph 적용 방향

## 7.1 적용 목적

LangGraph는 각 Agent를 노드로 보고, 상태를 전달하며 분기 처리를 표현하는 데 사용할 수 있습니다.

코치 피드백에서 LangGraph와 멀티 에이전트 구조가 언급되었으므로, 가능하면 이번 프로젝트에서 LangGraph 구조를 시도합니다.

다만 프로젝트 일정상 LangGraph 적용 자체가 목표가 되어서는 안 됩니다.

우선 목표는 전체 추천 흐름이 동작하는 MVP입니다.

## 7.2 LangGraph 노드 설계

LangGraph를 적용한다면 다음과 같이 노드를 구성할 수 있습니다.

| Node | 역할 |
|---|---|
| input_validation_node | 입력값 검증 |
| saju_analysis_node | 사주 기반 간단 분석 |
| style_mapping_node | 여행 스타일 매핑 |
| destination_retrieval_node | 여행지 후보 검색 |
| ranking_node | 추천 점수 계산 및 Top3 선정 |
| response_generation_node | 추천 이유 생성 |
| result_node | 최종 결과 반환 |

## 7.3 LangGraph 흐름

기본 흐름은 다음과 같습니다.

    START
    → input_validation_node
    → saju_analysis_node
    → style_mapping_node
    → destination_retrieval_node
    → ranking_node
    → response_generation_node
    → result_node
    → END

## 7.4 분기 처리 후보

LangGraph를 사용할 경우 다음 분기를 표현할 수 있습니다.

| 분기 상황 | 처리 |
|---|---|
| 입력값 검증 실패 | 오류 메시지 반환 후 종료 |
| 출생 시간 모름 | 생년월일 중심 분석 노드로 이동 |
| 출생 시간 있음 | 생년월일시 기반 분석 노드로 이동 |
| 후보 여행지 3개 이상 | Ranking Agent로 이동 |
| 후보 여행지 3개 미만 | 조건 완화 후 재검색 |
| LLM 응답 실패 | 기본 템플릿 생성 노드로 이동 |

## 7.5 MVP 기준 적용 범위

MVP에서는 다음 중 하나를 선택합니다.

| 방식 | 설명 | 권장 상황 |
|---|---|---|
| 함수 기반 Workflow | 각 Agent를 함수로 구현 | 가장 안정적 |
| LangChain Chain | LLM 호출 단계를 Chain으로 연결 | 시간이 조금 있을 때 |
| LangGraph StateGraph | 전체 Agent를 노드로 구성 | 시간이 충분할 때 |

권장 방식은 다음과 같습니다.

1. 함수 기반으로 먼저 전체 흐름 구현
2. 동작 확인 후 LangChain 적용
3. 시간이 남으면 LangGraph 적용
4. 발표에서는 Agent Workflow 구조를 중심으로 설명

---

## 8. Tool Calling / MCP 적용 방향

코치 피드백에서 tool calling과 MCP도 언급되었지만, 이번 MVP에서는 필수 구현 범위로 두지 않습니다.

## 8.1 MVP에서 제외하는 이유

| 항목 | 제외 이유 |
|---|---|
| Tool Calling | 현재는 외부 API 호출보다 내부 데이터 기반 추천이 우선 |
| MCP | 프로젝트 기간 대비 설정과 연동 비용이 큼 |
| 실시간 지도 API | 추천 흐름 구현 이후 단계 |
| 실시간 숙박/교통 API | MVP 범위를 초과 |

## 8.2 향후 확장 가능성

향후에는 다음과 같이 확장할 수 있습니다.

| 확장 방향 | 설명 |
|---|---|
| 지도 API Tool | 추천 여행지의 지도 링크 제공 |
| 날씨 API Tool | 여행일 기준 날씨 반영 |
| 교통 API Tool | 실제 이동 시간 반영 |
| RAG Tool | 여행지 설명 문서 검색 |
| MCP 연동 | 외부 도구와 Agent 연결 |

이번 MVP에서는 Tool Calling이나 MCP보다 Agent Workflow의 단계 분리와 데이터 기반 추천 구조를 우선합니다.

---

## 9. RAG 적용 방향

## 9.1 RAG 적용 가능성

RAG는 여행지 데이터를 벡터화하고, 사용자의 여행 스타일과 조건에 맞는 여행지를 검색하는 데 사용할 수 있습니다.

예를 들어 다음과 같은 흐름이 가능합니다.

    사용자 여행 스타일
    → 여행지 설명 임베딩 검색
    → 관련 여행지 후보 추출
    → 점수 계산
    → Top3 추천

## 9.2 MVP에서의 위치

다만 이번 MVP에서는 RAG를 필수 구현 범위로 두지 않습니다.

이유는 다음과 같습니다.

1. 여행지 데이터 개수가 많지 않다.
2. JSON/CSV 기반 필터링으로도 데모가 가능하다.
3. 벡터 DB 설정에 시간이 소요된다.
4. 5월 10일 데모 제출 전에는 전체 동작 흐름이 더 중요하다.

따라서 RAG는 P1 또는 향후 고도화 기능으로 둡니다.

## 9.3 발표에서의 표현

발표에서는 다음과 같이 설명할 수 있습니다.

    현재 MVP에서는 여행지 데이터를 JSON 기반으로 관리하고,
    스타일 태그와 점수 계산을 통해 Top3를 추천했습니다.
    향후 여행지 데이터가 많아질 경우 RAG 구조를 적용하여
    사용자 상태와 여행지 설명 간의 의미 기반 검색으로 확장할 수 있습니다.

---

## 10. Agent 간 데이터 전달 규칙

## 10.1 공통 규칙

Agent 간 데이터 전달은 다음 원칙을 따릅니다.

1. 각 Agent는 이전 단계의 출력값만 사용한다.
2. 각 Agent는 다음 단계에서 사용할 수 있는 구조화된 값을 반환한다.
3. LLM 응답은 가능한 한 구조화된 필드로 변환한다.
4. 오류가 발생해도 전체 앱이 중단되지 않도록 fallback 값을 제공한다.
5. 추천 여행지는 반드시 데이터 파일에 존재하는 여행지만 사용한다.

## 10.2 상태 업데이트 방식

각 Agent는 Workflow State의 일부 필드를 업데이트합니다.

| Agent | 업데이트 필드 |
|---|---|
| Input Validation Agent | validation, user_input |
| Saju Analysis Agent | saju_analysis |
| Travel Style Mapping Agent | travel_style |
| Destination Retrieval Agent | candidate_destinations, messages, metadata |
| Ranking Agent | ranked_destinations, recommendations |
| Response Generation Agent | recommendations, metadata |

---

## 11. 예외 처리 흐름

## 11.1 입력값 검증 실패

흐름:

    사용자 입력
    → Input Validation Agent
    → validation.is_valid == false
    → 오류 메시지 출력
    → Workflow 종료

예시 메시지:

    생년월일을 입력해 주세요.

## 11.2 출생 시간 모름

흐름:

    사용자 입력
    → birth_time_branch == UNKNOWN
    → birth_time_unknown = true
    → Saju Analysis Agent에서 생년월일 중심 분석
    → 결과 화면에 안내 문구 표시

안내 문구:

    출생 시간을 모르는 경우 일부 해석이 단순화될 수 있습니다.

## 11.3 후보 여행지 부족

흐름:

    Destination Retrieval Agent
    → candidate_destinations 개수 확인
    → 3개 미만
    → 조건 완화
    → 재검색
    → 그래도 부족하면 기본 후보 사용

안내 문구:

    입력하신 조건에 정확히 맞는 여행지가 부족하여 일부 조건을 완화해 추천했습니다.

## 11.4 LLM 실패

흐름:

    LLM 호출
    → 실패 또는 응답 형식 오류
    → fallback 템플릿 사용
    → metadata.llm_fallback_used = true
    → 결과 출력

fallback 문구:

    {여행지명}은 {여행스타일}에 어울리는 태그와 활동을 가진 여행지입니다.
    {추천활동}을 통해 현재 여행 목적에 맞는 시간을 보낼 수 있습니다.

---

## 12. 개발 구현 구조 제안

MVP에서는 다음 파일 구조를 권장합니다.

    app.py
    constants.py
    input_form.py
    validators.py
    saju_agent.py
    style_mapper.py
    destination_loader.py
    recommender.py
    reason_generator.py
    data/
      destinations.json
    docs/
      ai-saju-travel/
        03_agent_workflow.md

## 12.1 파일별 역할

| 파일 | 역할 |
|---|---|
| app.py | Streamlit 앱 실행 및 전체 Workflow 연결 |
| constants.py | 선택지, 여행 스타일, 점수 기준 관리 |
| input_form.py | 사용자 입력 폼 구성 |
| validators.py | 입력값 검증 |
| saju_agent.py | Saju Analysis Agent 구현 |
| style_mapper.py | Travel Style Mapping Agent 구현 |
| destination_loader.py | 여행지 데이터 로딩 |
| recommender.py | 후보 필터링, 점수 계산, Top3 선정 |
| reason_generator.py | 추천 이유 생성 |
| destinations.json | 여행지 데이터 |

## 12.2 권장 함수 구조

| 함수 | 역할 |
|---|---|
| validate_input(user_input) | 입력값 검증 |
| analyze_saju(user_input) | 사주 기반 간단 분석 |
| map_travel_style(saju_analysis) | 여행 스타일 매핑 |
| load_destinations() | 여행지 데이터 로딩 |
| filter_destinations(destinations, user_input, travel_style) | 후보 필터링 |
| rank_destinations(candidates, user_input, travel_style) | 점수 계산 및 정렬 |
| generate_recommendation_reasons(recommendations, travel_style) | 추천 이유 생성 |
| run_workflow(user_input) | 전체 Agent Workflow 실행 |

---

## 13. MVP 구현 우선순위

Agent Workflow 구현 우선순위는 다음과 같습니다.

## 13.1 1순위: 전체 흐름 동작

먼저 다음 흐름이 끝까지 동작해야 합니다.

    입력
    → 분석
    → 스타일 매핑
    → 후보 검색
    → 점수 계산
    → Top3 선정
    → 이유 생성
    → 결과 출력

프레임워크 적용보다 전체 동작이 우선입니다.

## 13.2 2순위: Agent 단위 분리

전체 흐름이 동작하면 각 단계를 함수 또는 파일 단위로 분리합니다.

이렇게 하면 발표에서 Agent Workflow를 설명하기 쉽습니다.

## 13.3 3순위: LangChain 적용

시간이 가능하면 LLM 호출이 있는 단계에 LangChain을 적용합니다.

- Saju Analysis
- Travel Style Mapping
- Response Generation

## 13.4 4순위: LangGraph 적용

추가 여유가 있으면 전체 흐름을 LangGraph StateGraph로 표현합니다.

단, LangGraph 적용 때문에 P0 기능 구현이 늦어지면 안 됩니다.

---

## 14. 발표에서 설명할 핵심 포인트

최종 발표에서는 Agent Workflow를 다음 방식으로 설명할 수 있어야 합니다.

## 14.1 단순 LLM 호출과의 차이

    저희 서비스는 LLM에게 여행지를 한 번에 추천받는 구조가 아닙니다.
    사용자 입력을 사주 기반으로 해석하고,
    이를 여행 스타일로 변환한 뒤,
    미리 정의한 여행지 데이터에서 조건에 맞는 후보를 찾고,
    점수 기준으로 Top3를 선정합니다.
    LLM은 최종 추천 이유를 자연어로 생성하는 역할에 집중합니다.

## 14.2 Agent 역할 분리

    전체 Workflow를 입력 검증, 사주 분석, 여행 스타일 매핑,
    여행지 검색, 랭킹, 응답 생성 단계로 분리했습니다.
    이를 통해 각 단계의 역할과 책임을 명확히 했습니다.

## 14.3 코치 피드백 반영 지점

| 피드백 | 반영 내용 |
|---|---|
| 여행 스타일 키워드 구체화 | 감정 회복형, 에너지 충전형, 인간관계 환기형, 자기 성찰형, 액티비티 중심형, 문화 탐방형으로 구체화 |
| 단순 LLM 호출 지양 | 사주 분석, 스타일 매핑, 데이터 검색, 랭킹, 응답 생성으로 단계 분리 |
| LangChain/LangGraph 고려 | MVP는 함수 기반으로 구현하고, 가능하면 Chain 또는 Graph 구조 적용 |
| WBS 기반 관리 | 5/10 데모 제출, 5/14 프로젝트 제출, 5/15 발표 기준으로 작업 분리 |
| 개발자가 구현 가능한 수준의 명세 | 각 Agent의 입력, 출력, 예외 처리, 완료 기준 정의 |

---

## 15. 완료 기준

이 Agent Workflow가 완료되었다고 판단하는 기준은 다음과 같습니다.

## 15.1 기능 기준

- 사용자 입력값이 Workflow State에 저장된다.
- Input Validation Agent가 필수 입력값을 검증한다.
- Saju Analysis Agent가 분석 결과를 생성한다.
- Travel Style Mapping Agent가 primary_style을 반환한다.
- Destination Retrieval Agent가 후보 여행지를 반환한다.
- Ranking Agent가 점수 기준으로 Top3를 선정한다.
- Response Generation Agent가 추천 이유를 생성한다.
- 결과 화면에 추천 결과가 출력된다.

## 15.2 안정성 기준

- 출생 시간 모름 케이스를 처리할 수 있다.
- 후보 여행지가 부족해도 앱이 중단되지 않는다.
- LLM 호출 실패 시 fallback 문구로 대체된다.
- 데이터 파일 오류 시 사용자에게 안내 메시지를 표시한다.

## 15.3 발표 기준

- 전체 Agent Workflow를 그림 또는 표로 설명할 수 있다.
- 각 Agent의 역할을 설명할 수 있다.
- LLM과 코드 로직의 역할 차이를 설명할 수 있다.
- LangChain 또는 LangGraph 적용 가능 지점을 설명할 수 있다.
- MVP에서 제외한 고도화 기능을 설명할 수 있다.

---

## 16. 요약

이번 Agent Workflow는 다음 흐름을 기준으로 설계합니다.

    사용자 입력
    → 입력값 검증
    → 사주 기반 간단 분석
    → 여행 스타일 매핑
    → 여행지 데이터 검색
    → 추천 점수 계산
    → Top3 선정
    → 추천 이유 생성
    → 결과 카드 출력

핵심은 LLM에게 모든 판단을 맡기는 것이 아니라, Agent별 역할을 나누고 데이터 기반 추천 로직을 함께 사용하는 것입니다.

MVP에서는 함수 기반 Workflow로 먼저 전체 흐름을 완성합니다.  
이후 시간이 가능하면 LangChain으로 LLM 호출 단계를 정리하고, 추가 여유가 있으면 LangGraph로 분기 구조를 표현합니다.

이번 프로젝트에서 가장 중요한 것은 많은 기능을 넣는 것이 아니라, 5월 10일 데모 제출과 5월 15일 최종 발표에서 Agentic AI 기반 추천 흐름이 명확하게 동작하고 설명될 수 있도록 만드는 것입니다.