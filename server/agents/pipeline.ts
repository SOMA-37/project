/**
 * Sequential 6-agent pipeline.
 *
 * Each step emits agent_start / agent_done events via the supplied emitter so
 * the SSE handler can stream progress to the client. Errors are caught and
 * emitted as `error` events; the caller is responsible for closing the stream.
 */

import type { UserInput } from '../../src/types';
import type { AgentEvent, AgentId, PipelineResult } from '../types';
import { validateInput } from './inputValidation';
import { runSajuAnalysis } from './sajuAnalysis';
import { runTravelStyleMapping } from './travelStyleMapping';
import { runDestinationRetrieval } from './destinationRetrieval';
import { runRanking } from './ranking';
import { runResponseGeneration } from './responseGeneration';

const AGENT_ORDER: AgentId[] = [
  'input-validation',
  'saju-analysis',
  'travel-style-mapping',
  'destination-retrieval',
  'ranking',
  'response-generation',
];

export type EventEmitter = (event: AgentEvent) => void;

export interface RunPipelineArgs {
  apiKey: string;
  rawInput: unknown;
  model?: string;
  emit: EventEmitter;
}

export async function runPipeline({
  apiKey,
  rawInput,
  model,
  emit,
}: RunPipelineArgs): Promise<PipelineResult | null> {
  const total = AGENT_ORDER.length;

  // 1) Input validation
  emit({ type: 'agent_start', agent: 'input-validation', index: 0, total });
  const validation = validateInput(apiKey, rawInput);
  if (!validation.ok || !validation.normalized) {
    emit({
      type: 'error',
      agent: 'input-validation',
      message: validation.errors.join(' / '),
    });
    return null;
  }
  const input: UserInput = validation.normalized;
  emit({
    type: 'agent_done',
    agent: 'input-validation',
    index: 0,
    total,
    payload: { ok: true },
  });

  try {
    // 2) Saju analysis
    emit({ type: 'agent_start', agent: 'saju-analysis', index: 1, total });
    const saju = await runSajuAnalysis(input, apiKey, model);
    emit({
      type: 'agent_done',
      agent: 'saju-analysis',
      index: 1,
      total,
      payload: {
        dayMaster: saju.chart.dayMaster,
        elements: saju.elements.scores,
        needsBoost: saju.needsBoost,
      },
    });

    // 3) Style mapping
    emit({ type: 'agent_start', agent: 'travel-style-mapping', index: 2, total });
    const mapping = await runTravelStyleMapping(saju, apiKey, model);
    emit({
      type: 'agent_done',
      agent: 'travel-style-mapping',
      index: 2,
      total,
      payload: {
        primary: mapping.primary,
        secondary: mapping.secondary,
      },
    });

    // 4) Retrieval
    emit({ type: 'agent_start', agent: 'destination-retrieval', index: 3, total });
    const { candidates, filterStats } = runDestinationRetrieval(input, saju, mapping);
    emit({
      type: 'agent_done',
      agent: 'destination-retrieval',
      index: 3,
      total,
      payload: { count: candidates.length, filterStats },
    });

    // 5) Ranking
    emit({ type: 'agent_start', agent: 'ranking', index: 4, total });
    const ranked = await runRanking(input, saju, mapping, candidates, apiKey, model);
    emit({
      type: 'agent_done',
      agent: 'ranking',
      index: 4,
      total,
      payload: ranked.map((r) => ({
        id: r.destination.id,
        name: r.destination.name,
        score: r.score,
      })),
    });

    // 6) Response generation
    emit({ type: 'agent_start', agent: 'response-generation', index: 5, total });
    const result = await runResponseGeneration(saju, mapping, ranked, apiKey, model);
    emit({
      type: 'agent_done',
      agent: 'response-generation',
      index: 5,
      total,
      payload: { headline: result.headline },
    });

    emit({ type: 'pipeline_done', payload: result });
    return result;
  } catch (err) {
    emit({
      type: 'error',
      message: (err as Error).message ?? '알 수 없는 오류가 발생했어요.',
    });
    return null;
  }
}
