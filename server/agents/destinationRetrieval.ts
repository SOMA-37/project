/**
 * Agent 4 — Destination Retrieval Agent.
 *
 * Filters the destination catalog to a candidate pool using:
 *   - travelRange (max travel hours from departure)
 *   - element affinity overlap with the user's needsBoost element
 *   - tag overlap with the mapping's preferredTags
 *
 * Returns at minimum 5 candidates so the ranking agent has room to work with.
 * No LLM call here — pure retrieval.
 */

import type { TravelRange, UserInput } from '../../src/types';
import type { CandidateDestination, SajuAnalysis, TravelStyleMapping } from '../types';
import { SERVER_DESTINATIONS } from '../data/destinations';

const RANGE_LIMITS: Record<TravelRange, number> = {
  '2시간 이내': 2,
  '4시간 이내': 4,
  '제한 없음': 99,
};

const MIN_CANDIDATES = 5;

export interface RetrievalResult {
  candidates: CandidateDestination[];
  filterStats: {
    totalPool: number;
    afterRangeFilter: number;
    finalPool: number;
    relaxedRange: boolean;
  };
}

export function runDestinationRetrieval(
  input: UserInput,
  saju: SajuAnalysis,
  mapping: TravelStyleMapping,
): RetrievalResult {
  const limit = RANGE_LIMITS[input.travelRange];

  const inRange = SERVER_DESTINATIONS.filter(
    (d) => d.travelTime[input.departure] <= limit,
  );

  // Score by element affinity + tag overlap to seed retrieval.
  const scoreFor = (d: CandidateDestination): number => {
    const elementHits =
      d.elementAffinity.includes(saju.needsBoost) ? 2 : 0;
    const dominantPenalty = d.elementAffinity.includes(saju.elements.dominant)
      ? -0.3
      : 0;
    const tagHits = d.tags.filter((t) => mapping.preferredTags.includes(t)).length;
    const styleHits = d.styles.filter((s) =>
      [mapping.primary, mapping.secondary].filter(Boolean).includes(s),
    ).length;
    return elementHits + tagHits * 0.7 + styleHits * 1.2 + dominantPenalty;
  };

  const ranked = (inRange.length >= MIN_CANDIDATES ? inRange : SERVER_DESTINATIONS)
    .map((d) => ({ d, s: scoreFor(d) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.d);

  // Take top ~7 so ranking agent has variety.
  const candidates = ranked.slice(0, Math.min(7, ranked.length));

  return {
    candidates,
    filterStats: {
      totalPool: SERVER_DESTINATIONS.length,
      afterRangeFilter: inRange.length,
      finalPool: candidates.length,
      relaxedRange: inRange.length < MIN_CANDIDATES,
    },
  };
}
