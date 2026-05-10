/**
 * Agent 1 — Input Validation Agent.
 *
 * Validates the user input + API key before any LLM call. Returns either
 * `{ ok: true }` or a structured error message that the pipeline can return
 * as a 400 response.
 */

import type {
  BirthHour,
  DepartureRegion,
  TravelDuration,
  TravelRange,
  UserInput,
} from '../../src/types';

const ALLOWED_HOURS: BirthHour[] = [
  '모름',
  '자시(23-01)',
  '축시(01-03)',
  '인시(03-05)',
  '묘시(05-07)',
  '진시(07-09)',
  '사시(09-11)',
  '오시(11-13)',
  '미시(13-15)',
  '신시(15-17)',
  '유시(17-19)',
  '술시(19-21)',
  '해시(21-23)',
];

const ALLOWED_DEPARTURE: DepartureRegion[] = [
  '서울', '경기', '부산', '대구', '광주', '대전', '기타',
];

const ALLOWED_RANGE: TravelRange[] = ['2시간 이내', '4시간 이내', '제한 없음'];
const ALLOWED_DURATION: TravelDuration[] = ['당일', '1박 2일', '2박 3일'];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  normalized?: UserInput;
}

export function validateInput(
  apiKey: unknown,
  rawInput: unknown,
): ValidationResult {
  const errors: string[] = [];

  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    errors.push('Solar API 키가 누락되었거나 형식이 올바르지 않습니다.');
  }

  if (typeof rawInput !== 'object' || rawInput === null) {
    errors.push('사용자 입력이 비어 있습니다.');
    return { ok: false, errors };
  }

  const input = rawInput as Partial<UserInput>;

  if (typeof input.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    errors.push('생년월일은 YYYY-MM-DD 형식이어야 합니다.');
  } else {
    const date = new Date(`${input.birthDate}T00:00:00Z`);
    const year = date.getUTCFullYear();
    if (Number.isNaN(date.getTime()) || year < 1900 || year > 2100) {
      errors.push('생년월일이 유효한 날짜가 아닙니다.');
    }
  }

  if (typeof input.birthHour !== 'string' || !ALLOWED_HOURS.includes(input.birthHour as BirthHour)) {
    errors.push('태어난 시간 값이 유효하지 않습니다.');
  }

  if (!ALLOWED_DEPARTURE.includes(input.departure as DepartureRegion)) {
    errors.push('출발지 값이 유효하지 않습니다.');
  }

  if (!ALLOWED_RANGE.includes(input.travelRange as TravelRange)) {
    errors.push('이동 범위 값이 유효하지 않습니다.');
  }

  if (!ALLOWED_DURATION.includes(input.travelDuration as TravelDuration)) {
    errors.push('여행 기간 값이 유효하지 않습니다.');
  }

  if (!Array.isArray(input.preferredStyles)) {
    errors.push('선호 스타일은 배열이어야 합니다.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    normalized: {
      birthDate: input.birthDate as string,
      birthHour: input.birthHour as BirthHour,
      departure: input.departure as DepartureRegion,
      travelRange: input.travelRange as TravelRange,
      travelDuration: input.travelDuration as TravelDuration,
      preferredStyles: (input.preferredStyles ?? []) as UserInput['preferredStyles'],
    },
  };
}
