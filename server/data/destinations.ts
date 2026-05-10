/**
 * Server-side destination catalog. Mirrors src/mocks/destinations.ts but adds
 * `elementAffinity` — which 오행 environments each place naturally aligns with.
 */

import { DESTINATIONS as MOCK_DESTINATIONS } from '../../src/mocks/destinations';
import type { CandidateDestination, Element } from '../types';

const ELEMENT_AFFINITY_BY_ID: Record<string, Element[]> = {
  gangneung: ['수', '목'],
  yangyang: ['수', '화'],
  gapyeong: ['목', '토'],
  gyeongju: ['토', '금'],
  jeonju: ['토', '화'],
  busan: ['수', '화'],
  jeju: ['수', '목'],
  tongyeong: ['수', '금'],
  andong: ['토', '금'],
  sokcho: ['수', '목'],
  yeosu: ['수', '화'],
  damyang: ['목', '수'],
  boseong: ['목', '토'],
  danyang: ['목', '토'],
  samcheok: ['수', '토'],
};

export const SERVER_DESTINATIONS: CandidateDestination[] = MOCK_DESTINATIONS.map(
  (d) => ({
    id: d.id,
    name: d.name,
    region: d.region,
    tags: d.tags,
    styles: d.styles,
    emoji: d.emoji,
    description: d.description,
    activities: d.activities,
    travelTime: d.travelTime,
    elementAffinity: ELEMENT_AFFINITY_BY_ID[d.id] ?? [],
  }),
);

export function findDestinationById(id: string): CandidateDestination | undefined {
  return SERVER_DESTINATIONS.find((d) => d.id === id);
}
