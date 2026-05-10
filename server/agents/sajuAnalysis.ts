/**
 * Agent 2 — Saju Analysis Agent.
 *
 * Combines deterministic Bazi calculation (so different birthdays yield
 * different element profiles) with a Solar LLM call that turns the chart
 * into a personality / yearly-energy narrative grounded in the chart facts.
 */

import type { BirthHour, UserInput } from '../../src/types';
import type { Element, ElementBalance, SajuAnalysis } from '../types';
import {
  computeBazi,
  computeElementBalance,
  ELEMENT_TRAVEL_AFFINITY,
} from '../saju/baziCalculator';
import { callSolarJson, type ChatMessage } from '../solar';

interface LlmNarrativePayload {
  personalityKeywords: string[];
  yearlyEnergy: string;
  narrative: string;
}

const SYSTEM_PROMPT = `당신은 한국 전통 사주 명리학에 능통한 분석가입니다.
주어진 사주 차트(년/월/일/시 천간·지지)와 오행 분포를 바탕으로
사용자의 성향과 현재 운세 흐름을 짧은 한국어로 요약해 주세요.

규칙:
- 모든 해석은 반드시 입력된 차트와 오행 수치에 근거해야 합니다.
- 사용자에게 운명이나 단정적인 예언을 하지 마세요. "~한 결", "~한 시기"처럼 결을 묘사합니다.
- "재미·참고용"이라는 면책에 어긋나지 않도록 부드러운 어조를 유지합니다.
- 출력은 반드시 단일 JSON 객체로만 응답하세요. 코드 펜스, 주석 금지.`;

function buildUserPrompt(
  input: UserInput,
  balance: ElementBalance,
  dayMaster: { stem: string; element: Element },
  needsBoost: Element,
): string {
  const elementLine = (Object.keys(balance.scores) as Element[])
    .map((k) => `${k}: ${balance.scores[k].toFixed(1)}`)
    .join(', ');

  return [
    `생년월일: ${input.birthDate}`,
    `태어난 시: ${input.birthHour}`,
    `일간(자기 자신): ${dayMaster.stem}(${dayMaster.element})`,
    `오행 분포: ${elementLine}`,
    `강한 오행: ${balance.strong.join(', ') || '없음'}`,
    `부족한 오행: ${balance.weak.join(', ') || '없음'}`,
    `보완이 필요한 오행: ${needsBoost}`,
    '',
    '아래 JSON 스키마로만 응답해주세요:',
    `{
  "personalityKeywords": string[3~5],   // 성향 키워드 (예: "직관적", "신중함")
  "yearlyEnergy": string,               // 2~3문장. 올해 어떤 결의 시기인지
  "narrative": string                   // 3~4문장. 일간/강한 오행/부족한 오행을 모두 언급해 풀이
}`,
    '',
    '예시 어조: "화(火) 기운이 강해 활동적이고 개방적인 공간이 잘 맞아요. 다만 수(水)가 부족해 마음이 가라앉을 시간이 필요한 시기예요."',
  ].join('\n');
}

/**
 * Pick the element to boost. If there are weak elements, take the weakest one;
 * otherwise pick the element that controls the dominant element (오행 상극)
 * to soften an over-strong tendency.
 */
function pickNeedsBoost(balance: ElementBalance): Element {
  if (balance.weak.length > 0) return balance.weak[0];
  // 상극: 목→토, 토→수, 수→화, 화→금, 금→목 (controller of dominant)
  const controller: Record<Element, Element> = {
    목: '금', 화: '수', 토: '목', 금: '화', 수: '토',
  };
  return controller[balance.dominant];
}

export async function runSajuAnalysis(
  input: UserInput,
  apiKey: string,
  model?: string,
): Promise<SajuAnalysis> {
  const chart = computeBazi(input.birthDate, input.birthHour as BirthHour);
  const elements = computeElementBalance(chart);
  const needsBoost = pickNeedsBoost(elements);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildUserPrompt(input, elements, chart.dayMaster, needsBoost),
    },
  ];

  let llm: LlmNarrativePayload;
  try {
    llm = await callSolarJson<LlmNarrativePayload>(messages, {
      apiKey,
      model,
      temperature: 0.4,
      maxTokens: 600,
    });
  } catch (err) {
    // Fallback narrative grounded in the chart so the pipeline still runs.
    llm = buildFallbackNarrative(elements, chart.dayMaster, needsBoost);
    console.warn('[sajuAnalysis] Solar fallback used:', (err as Error).message);
  }

  return {
    chart,
    elements,
    personalityKeywords: llm.personalityKeywords ?? [],
    yearlyEnergy: llm.yearlyEnergy ?? '',
    needsBoost,
    narrative: llm.narrative ?? '',
  };
}

function buildFallbackNarrative(
  balance: ElementBalance,
  dayMaster: { stem: string; element: Element },
  needsBoost: Element,
): LlmNarrativePayload {
  const dominantTraits = ELEMENT_TRAVEL_AFFINITY[balance.dominant].keywords;
  const boostEnvs = ELEMENT_TRAVEL_AFFINITY[needsBoost].environments;
  return {
    personalityKeywords: dominantTraits.slice(0, 3),
    yearlyEnergy: `${needsBoost}(${needsBoost}) 기운의 보완이 필요한 결의 시기로, ${boostEnvs[0]} 가까이에서 호흡을 가다듬으면 좋아요.`,
    narrative: `일간이 ${dayMaster.stem}(${dayMaster.element})으로, ${balance.dominant} 기운이 두드러지는 분이에요. ${balance.dominant}의 결이 강해 ${dominantTraits[0]} 성향이 자연스럽게 드러나지만, ${needsBoost}이(가) 부족해 균형을 맞출 환경이 필요합니다.`,
  };
}
