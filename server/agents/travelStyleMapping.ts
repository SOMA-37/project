/**
 * Agent 3 — Travel Style Mapping Agent.
 *
 * Maps the saju analysis (element balance + needsBoost) into the project's
 * 6 internal travel styles + recommended/avoided tags. The mapping is
 * deterministic (a scoring table) but a Solar call is used to produce the
 * human-friendly rationale that links 오행 to travel style.
 */

import type { TravelStyle } from '../../src/types';
import type { StyleKey } from '../../src/mocks/travelStyles';
import { TRAVEL_STYLES } from '../../src/mocks/travelStyles';
import type {
  Element,
  SajuAnalysis,
  TravelStyleMapping,
} from '../types';
import { callSolarJson, type ChatMessage } from '../solar';

/**
 * For each StyleKey, declare which 오행 it most aligns with. These weights
 * let us score every style against the user's element balance + boost needs.
 */
const STYLE_ELEMENT_WEIGHTS: Record<StyleKey, Partial<Record<Element, number>>> = {
  EMOTIONAL_RECOVERY: { 수: 3, 목: 1.5 },
  ENERGY_CHARGE: { 화: 3, 목: 1 },
  RELATIONSHIP_REFRESH: { 화: 2, 금: 1.5 },
  SELF_REFLECTION: { 목: 2.5, 토: 2 },
  ACTIVITY: { 화: 2, 목: 2 },
  CULTURE: { 토: 2.5, 금: 2 },
};

/**
 * Tag preference per element — taken from ELEMENT_TRAVEL_AFFINITY but
 * mapped onto the project's TravelStyle vocabulary.
 */
const ELEMENT_TO_TAGS: Record<Element, TravelStyle[]> = {
  목: ['숲', '산', '사찰/한옥'],
  화: ['핫플', '야경', '액티비티'],
  토: ['사찰/한옥', '조용한 곳', '카페'],
  금: ['전시/예술', '맛집', '카페'],
  수: ['바다', '조용한 곳', '카페'],
};

function scoreStyles(saju: SajuAnalysis): { primary: StyleKey; secondary: StyleKey | null } {
  const styleScores = new Map<StyleKey, number>();
  (Object.keys(STYLE_ELEMENT_WEIGHTS) as StyleKey[]).forEach((key) => {
    const weights = STYLE_ELEMENT_WEIGHTS[key];
    let s = 0;
    (Object.keys(weights) as Element[]).forEach((el) => {
      const w = weights[el] ?? 0;
      // Boost-need elements get extra weight — we want styles that *bring in*
      // missing energy, not styles that pile onto already-strong elements.
      const elementScore = saju.elements.scores[el];
      const isBoostTarget = el === saju.needsBoost;
      s += w * (isBoostTarget ? 1.5 : 1) * (elementScore / 5);
    });
    styleScores.set(key, s);
  });
  const sorted = Array.from(styleScores.entries()).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0][0],
    secondary: sorted[1]?.[0] ?? null,
  };
}

interface LlmRationale {
  rationale: string;
}

const SYSTEM_PROMPT = `당신은 사주 명리학과 여행 스타일을 잇는 매핑 전문가입니다.
주어진 오행 분포와 추천된 1~2개의 여행 스타일이 왜 잘 맞는지 한국어로 짧게 설명하세요.
출력은 반드시 JSON 객체 한 개로 합니다. {"rationale": "..."} 형식.
3~4문장 이내, 부족한 오행을 어떻게 보완하는지 반드시 언급하세요.`;

export async function runTravelStyleMapping(
  saju: SajuAnalysis,
  apiKey: string,
  model?: string,
): Promise<TravelStyleMapping> {
  const { primary, secondary } = scoreStyles(saju);

  // Build tag preferences: dominant + needsBoost element tags pulled in.
  const preferredTags = uniqueTags([
    ...ELEMENT_TO_TAGS[saju.needsBoost],
    ...(saju.elements.strong.flatMap((e) => ELEMENT_TO_TAGS[e]).slice(0, 2)),
    ...TRAVEL_STYLES[primary].recommendKeywords,
    ...(secondary ? TRAVEL_STYLES[secondary].recommendKeywords : []),
  ]);

  // Avoid tags that pile onto already-overstrong dominant elements when the
  // user is already heavily skewed (strong list non-empty).
  const avoidTags: TravelStyle[] =
    saju.elements.strong.length > 0
      ? overlapTags(saju.elements.strong, saju.needsBoost)
      : [];

  const userPrompt = [
    `일간(자기): ${saju.chart.dayMaster.stem}(${saju.chart.dayMaster.element})`,
    `오행 분포: ${(Object.keys(saju.elements.scores) as Element[])
      .map((k) => `${k}=${saju.elements.scores[k].toFixed(1)}`)
      .join(', ')}`,
    `보완이 필요한 오행: ${saju.needsBoost}`,
    `1순위 스타일: ${TRAVEL_STYLES[primary].label}`,
    `2순위 스타일: ${secondary ? TRAVEL_STYLES[secondary].label : '없음'}`,
    `추천 태그: ${preferredTags.join(', ')}`,
    '',
    '왜 이 스타일이 보완 오행과 맞물리는지 짧게 설명해 주세요.',
  ].join('\n');

  let rationale = '';
  try {
    const res = await callSolarJson<LlmRationale>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ] satisfies ChatMessage[],
      { apiKey, model, temperature: 0.4, maxTokens: 350 },
    );
    rationale = res.rationale ?? '';
  } catch (err) {
    console.warn('[travelStyleMapping] Solar fallback:', (err as Error).message);
    rationale = `${saju.needsBoost}(${saju.needsBoost}) 기운 보완이 필요한 시기라 ${TRAVEL_STYLES[primary].label}의 결이 잘 맞아요.`;
  }

  return {
    primary,
    secondary,
    preferredTags,
    avoidTags,
    rationale,
  };
}

function uniqueTags(tags: TravelStyle[]): TravelStyle[] {
  return Array.from(new Set(tags));
}

/**
 * If user is already strong in 화 (활동적), avoid further '핫플/액티비티' that
 * pile onto the same element — unless it's also the boost target.
 */
function overlapTags(strong: Element[], boost: Element): TravelStyle[] {
  const out: TravelStyle[] = [];
  strong.forEach((el) => {
    if (el === boost) return; // we want to add to boost target, not avoid
    ELEMENT_TO_TAGS[el].forEach((t) => out.push(t));
  });
  return Array.from(new Set(out));
}
