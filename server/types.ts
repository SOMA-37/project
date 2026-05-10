import type {
  BirthHour,
  DepartureRegion,
  TravelDuration,
  TravelRange,
  TravelStyle,
  UserInput,
} from '../src/types';
import type { StyleKey } from '../src/mocks/travelStyles';

export type Element = '목' | '화' | '토' | '금' | '수';

export interface BaziPillar {
  stem: string;
  branch: string;
  stemElement: Element;
  branchElement: Element;
}

export interface BaziChart {
  year: BaziPillar;
  month: BaziPillar;
  day: BaziPillar;
  hour: BaziPillar | null;
  dayMaster: { stem: string; element: Element };
}

export interface ElementBalance {
  scores: Record<Element, number>;
  dominant: Element;
  weakest: Element;
  strong: Element[];
  weak: Element[];
}

export interface SajuAnalysis {
  chart: BaziChart;
  elements: ElementBalance;
  personalityKeywords: string[];
  yearlyEnergy: string;
  needsBoost: Element;
  narrative: string;
}

export interface TravelStyleMapping {
  primary: StyleKey;
  secondary: StyleKey | null;
  preferredTags: TravelStyle[];
  avoidTags: TravelStyle[];
  rationale: string;
}

export interface CandidateDestination {
  id: string;
  name: string;
  region: string;
  tags: TravelStyle[];
  styles: StyleKey[];
  emoji: string;
  description: string;
  activities: string[];
  travelTime: Record<DepartureRegion, number>;
  elementAffinity: Element[];
}

export interface ScoreBreakdown {
  saju: number;
  preference: number;
  distance: number;
  total: number;
}

export interface RankedDestination {
  destination: CandidateDestination;
  score: ScoreBreakdown;
  reason: string;
}

export interface PipelineRequest {
  apiKey: string;
  userInput: UserInput;
  model?: string;
}

export interface PipelineResult {
  saju: SajuAnalysis;
  styleMapping: TravelStyleMapping;
  ranked: RankedDestination[];
  selectedStyles: StyleKey[];
  styleReason: string;
  reasonsByDestination: Record<string, string>;
  headline: string;
}

export type AgentId =
  | 'input-validation'
  | 'saju-analysis'
  | 'travel-style-mapping'
  | 'destination-retrieval'
  | 'ranking'
  | 'response-generation';

export interface AgentEvent {
  type: 'agent_start' | 'agent_done' | 'pipeline_done' | 'error';
  agent?: AgentId;
  index?: number;
  total?: number;
  payload?: unknown;
  message?: string;
}

export type { UserInput, TravelStyle, BirthHour, DepartureRegion, TravelDuration, TravelRange };
