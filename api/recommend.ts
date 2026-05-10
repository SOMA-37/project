/**
 * Vercel Edge Function — POST /api/recommend
 *
 * Runs the full 6-agent pipeline and returns a single JSON payload with the
 * final result plus the in-order event log.
 */

import { runPipeline } from '../server/agents/pipeline';
import type { AgentEvent } from '../server/types';
import { jsonResponse, parsePipelineRequest } from './_lib/parse';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const parsed = await parsePipelineRequest(req);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, parsed.status);
  }

  const events: AgentEvent[] = [];
  const result = await runPipeline({
    apiKey: parsed.value.apiKey,
    rawInput: parsed.value.userInput,
    model: parsed.value.model,
    emit: (e) => events.push(e),
  });

  if (!result) {
    const errorEvent = events.find((e) => e.type === 'error');
    return jsonResponse(
      {
        error: errorEvent?.message ?? '파이프라인 실행에 실패했어요.',
        events,
      },
      400,
    );
  }
  return jsonResponse({ result, events }, 200);
}
