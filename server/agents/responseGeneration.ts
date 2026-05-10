/**
 * Agent 6 — Response Generation Agent.
 *
 * Builds the final user-facing payload: a saju-grounded headline, a styleReason
 * that connects 오행 to the mapped styles, and the per-destination reason map
 * pulled directly from the ranking agent's output.
 */

import type { StyleKey } from '../../src/mocks/travelStyles';
import { TRAVEL_STYLES } from '../../src/mocks/travelStyles';
import type {
  PipelineResult,
  RankedDestination,
  SajuAnalysis,
  TravelStyleMapping,
} from '../types';
import { ELEMENT_TRAVEL_AFFINITY } from '../saju/baziCalculator';
import { callSolarJson, type ChatMessage } from '../solar';

interface LlmHeadlinePayload {
  headline: string;
  styleReason: string;
}

const SYSTEM_PROMPT = `당신은 사주 명리학 기반 여행 추천 큐레이터입니다.
사용자에게 보여줄 결과 페이지 상단 카피를 작성합니다.
규칙:
- headline: 한 줄 요약. 어떤 오행이 강하고 어떤 오행이 부족한지를 자연스럽게 언급. 30자 이내 권장.
- styleReason: 2~3문장. 추천된 여행 스타일이 부족한 오행을 어떻게 보완하는지 설명. 사주 해석을 반드시 포함.
- 단정적인 점괘가 아니라 "결이 보여요", "흐름이에요" 같은 부드러운 어조.
- 출력은 반드시 단일 JSON 객체. {"headline":"...","styleReason":"..."}`;

export async function runResponseGeneration(
  saju: SajuAnalysis,
  mapping: TravelStyleMapping,
  ranked: RankedDestination[],
  apiKey: string,
  model?: string,
): Promise<PipelineResult> {
  const selectedStyles: StyleKey[] = mapping.secondary
    ? [mapping.primary, mapping.secondary]
    : [mapping.primary];

  const reasonsByDestination: Record<string, string> = {};
  ranked.forEach((r) => {
    reasonsByDestination[r.destination.id] = r.reason;
  });

  const llm = await fetchHeadline(saju, mapping, ranked, apiKey, model);

  return {
    saju,
    styleMapping: mapping,
    ranked,
    selectedStyles,
    styleReason: llm.styleReason,
    reasonsByDestination,
    headline: llm.headline,
  };
}

async function fetchHeadline(
  saju: SajuAnalysis,
  mapping: TravelStyleMapping,
  ranked: RankedDestination[],
  apiKey: string,
  model?: string,
): Promise<LlmHeadlinePayload> {
  const userPrompt = [
    `일간: ${saju.chart.dayMaster.stem}(${saju.chart.dayMaster.element})`,
    `강한 오행: ${saju.elements.strong.join(', ') || '뚜렷하지 않음'}`,
    `부족한 오행: ${saju.elements.weak.join(', ') || '뚜렷하지 않음'}`,
    `보완이 필요한 오행: ${saju.needsBoost}`,
    `매핑 스타일: ${TRAVEL_STYLES[mapping.primary].label}${mapping.secondary ? ` + ${TRAVEL_STYLES[mapping.secondary].label}` : ''}`,
    `상위 3 여행지: ${ranked.map((r) => r.destination.name).join(', ')}`,
    '',
    '위 정보를 바탕으로 결과 화면 헤드라인과 스타일 이유를 작성해 주세요.',
  ].join('\n');

  try {
    const res = await callSolarJson<LlmHeadlinePayload>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ] satisfies ChatMessage[],
      { apiKey, model, temperature: 0.5, maxTokens: 400 },
    );
    return {
      headline: res.headline ?? buildFallbackHeadline(saju),
      styleReason: res.styleReason ?? buildFallbackStyleReason(saju, mapping),
    };
  } catch (err) {
    console.warn('[responseGeneration] Solar fallback:', (err as Error).message);
    return {
      headline: buildFallbackHeadline(saju),
      styleReason: buildFallbackStyleReason(saju, mapping),
    };
  }
}

function buildFallbackHeadline(saju: SajuAnalysis): string {
  const strong = saju.elements.strong[0] ?? saju.elements.dominant;
  return `${strong}(${strong}) 기운이 강해 ${saju.needsBoost}(${saju.needsBoost}) 보완이 필요한 결의 시기예요.`;
}

function buildFallbackStyleReason(saju: SajuAnalysis, mapping: TravelStyleMapping): string {
  const env = ELEMENT_TRAVEL_AFFINITY[saju.needsBoost].environments.slice(0, 2).join('/');
  return `${saju.elements.dominant}(${saju.elements.dominant})이 강한 흐름이라, 부족한 ${saju.needsBoost}(${saju.needsBoost})을 ${env} 같은 환경으로 채워 주는 ${TRAVEL_STYLES[mapping.primary].label} 결이 잘 어울립니다.`;
}
