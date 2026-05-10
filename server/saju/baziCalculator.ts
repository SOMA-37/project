/**
 * Deterministic Bazi (사주팔자) calculator.
 *
 * Given a birth date (YYYY-MM-DD) + Korean two-hour branch, returns the four
 * pillars (year/month/day/hour) with their heavenly stems and earthly branches,
 * plus an aggregated five-element (오행) balance.
 *
 * This is a simplified astronomical model (not full Lichun / true solar time
 * adjusted) — accurate enough that different birthdays produce different
 * charts, which is what the recommendation pipeline needs.
 */

import type {
  BaziChart,
  BaziPillar,
  Element,
  ElementBalance,
} from '../types';
import type { BirthHour } from '../../src/types';

const HEAVENLY_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
const EARTHLY_BRANCHES = [
  '자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해',
] as const;

const STEM_ELEMENTS: Record<(typeof HEAVENLY_STEMS)[number], Element> = {
  갑: '목', 을: '목',
  병: '화', 정: '화',
  무: '토', 기: '토',
  경: '금', 신: '금',
  임: '수', 계: '수',
};

const BRANCH_ELEMENTS: Record<(typeof EARTHLY_BRANCHES)[number], Element> = {
  자: '수', 해: '수',
  축: '토', 진: '토', 미: '토', 술: '토',
  인: '목', 묘: '목',
  사: '화', 오: '화',
  신: '금', 유: '금',
};

const HOUR_BRANCH_INDEX: Record<BirthHour, number | null> = {
  모름: null,
  '자시(23-01)': 0,
  '축시(01-03)': 1,
  '인시(03-05)': 2,
  '묘시(05-07)': 3,
  '진시(07-09)': 4,
  '사시(09-11)': 5,
  '오시(11-13)': 6,
  '미시(13-15)': 7,
  '신시(15-17)': 8,
  '유시(17-19)': 9,
  '술시(19-21)': 10,
  '해시(21-23)': 11,
};

/**
 * Reference Julian day for known stem/branch (1900-01-31 = 갑진일 in 60-jiazi).
 * We use a fixed offset so day index can be derived from any date.
 */
function dayPillarIndex(date: Date): number {
  const refUtc = Date.UTC(1900, 0, 31);
  const dayMs = 24 * 60 * 60 * 1000;
  const targetUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.floor((targetUtc - refUtc) / dayMs);
  // 1900-01-31 = jiazi index 40 (갑진). Mod 60.
  return ((dayDiff + 40) % 60 + 60) % 60;
}

function buildPillar(stemIdx: number, branchIdx: number): BaziPillar {
  const stem = HEAVENLY_STEMS[((stemIdx % 10) + 10) % 10];
  const branch = EARTHLY_BRANCHES[((branchIdx % 12) + 12) % 12];
  return {
    stem,
    branch,
    stemElement: STEM_ELEMENTS[stem],
    branchElement: BRANCH_ELEMENTS[branch],
  };
}

/** Year pillar — uses lunar new year approximation (Feb 4 cutoff). */
function yearPillar(date: Date): BaziPillar {
  const yr =
    date.getMonth() < 1 || (date.getMonth() === 1 && date.getDate() < 4)
      ? date.getFullYear() - 1
      : date.getFullYear();
  // 1984 = 갑자 (jiazi index 0).
  const idx = ((yr - 1984) % 60 + 60) % 60;
  const stemIdx = idx % 10;
  const branchIdx = idx % 12;
  return buildPillar(stemIdx, branchIdx);
}

/**
 * Month pillar — branch follows solar terms approximated by the Gregorian
 * month boundary (인월=Feb, 묘월=Mar, ...). Stem derived from year stem via
 * the standard 五虎遁 rule.
 */
function monthPillar(date: Date, yearStem: (typeof HEAVENLY_STEMS)[number]): BaziPillar {
  // 인월 = month 2 (Feb), 묘월 = 3, ... 축월 = 1 (Jan).
  const m = date.getMonth() + 1;
  const branchIdx = m === 1 ? 1 : (m + 0) % 12; // Jan→축(1), Feb→인(2), ..., Dec→자(0? actually 子 is 0)
  // Correct mapping: Feb=2→인(idx 2), Mar=3→묘(3), ..., Dec=12→자(0), Jan=1→축(1).
  const correctedBranch = ((m + 0) % 12 + 12) % 12 === 0 ? 0 : branchIdx;
  // 五虎遁: 갑/기 year → 인월 stem 병; 을/경 → 무; 병/신 → 경; 정/임 → 임; 무/계 → 갑.
  const stemSeed: Record<(typeof HEAVENLY_STEMS)[number], number> = {
    갑: 2, 기: 2, // 병
    을: 4, 경: 4, // 무
    병: 6, 신: 6, // 경
    정: 8, 임: 8, // 임
    무: 0, 계: 0, // 갑
  };
  const branchOffset = ((correctedBranch - 2) + 12) % 12; // 인월=0
  const stemIdx = (stemSeed[yearStem] + branchOffset) % 10;
  return buildPillar(stemIdx, correctedBranch);
}

function dayPillar(date: Date): BaziPillar {
  const idx = dayPillarIndex(date);
  return buildPillar(idx % 10, idx % 12);
}

/**
 * Hour pillar via 五鼠遁: stem = (day stem index * 2 + hour branch index) mod 10.
 */
function hourPillar(
  dayStem: (typeof HEAVENLY_STEMS)[number],
  branchIdx: number,
): BaziPillar {
  const dayStemIdx = HEAVENLY_STEMS.indexOf(dayStem);
  const stemIdx = ((dayStemIdx * 2) + branchIdx) % 10;
  return buildPillar(stemIdx, branchIdx);
}

export function computeBazi(birthDate: string, birthHour: BirthHour): BaziChart {
  const date = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid birthDate: ${birthDate}`);
  }
  const localDate = new Date(birthDate); // same calendar day, local-naive
  const year = yearPillar(localDate);
  const month = monthPillar(localDate, year.stem as (typeof HEAVENLY_STEMS)[number]);
  const day = dayPillar(localDate);
  const hourBranchIdx = HOUR_BRANCH_INDEX[birthHour];
  const hour =
    hourBranchIdx === null
      ? null
      : hourPillar(
          day.stem as (typeof HEAVENLY_STEMS)[number],
          hourBranchIdx,
        );

  return {
    year,
    month,
    day,
    hour,
    dayMaster: { stem: day.stem, element: day.stemElement },
  };
}

const ALL_ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];

export function computeElementBalance(chart: BaziChart): ElementBalance {
  const scores: Record<Element, number> = {
    목: 0, 화: 0, 토: 0, 금: 0, 수: 0,
  };

  // Stems weight 1.0, branches weight 0.8 (branches carry hidden stems we
  // approximate by branch element only — close enough for ranking).
  const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(
    (p): p is BaziPillar => p !== null,
  );
  pillars.forEach((p) => {
    scores[p.stemElement] += 1;
    scores[p.branchElement] += 0.8;
  });

  // Day master gets a slight extra weight — it represents the self.
  scores[chart.dayMaster.element] += 0.5;

  const sorted = ALL_ELEMENTS.slice().sort((a, b) => scores[b] - scores[a]);
  const dominant = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const total = ALL_ELEMENTS.reduce((s, e) => s + scores[e], 0);
  const avg = total / 5;
  const strong = ALL_ELEMENTS.filter((e) => scores[e] >= avg * 1.25);
  const weak = ALL_ELEMENTS.filter((e) => scores[e] <= avg * 0.6);

  return { scores, dominant, weakest, strong, weak };
}

/** Each element maps to travel-environment affinities used by ranking. */
export const ELEMENT_TRAVEL_AFFINITY: Record<Element, {
  environments: string[];
  keywords: string[];
}> = {
  목: {
    environments: ['숲', '산', '한옥/사찰'],
    keywords: ['성장', '확장', '아침의 결'],
  },
  화: {
    environments: ['핫플', '야경', '액티비티'],
    keywords: ['활동성', '개방감', '밝은 빛'],
  },
  토: {
    environments: ['전원', '한옥', '시골 한적'],
    keywords: ['안정', '머무름', '품에 안기는'],
  },
  금: {
    environments: ['전시/예술', '도시 미식', '깔끔한 공간'],
    keywords: ['정돈', '날카로운 영감', '단정함'],
  },
  수: {
    environments: ['바다', '호수', '온천', '강가'],
    keywords: ['흐름', '회복', '깊은 고요'],
  },
};
