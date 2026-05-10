/**
 * Vercel Edge Function — POST /api/recommend/stream
 *
 * Server-Sent Events: emits per-agent progress as the pipeline runs and a
 * terminal `pipeline_done` (or `error`) event before closing the stream.
 */

import { runPipeline } from '../../server/agents/pipeline';
import type { AgentEvent } from '../../server/types';
import { parsePipelineRequest } from '../_lib/parse';

export const config = { runtime: 'edge' };

const HEARTBEAT_MS = 15_000;

export default async function handler(req: Request): Promise<Response> {
  const parsed = await parsePipelineRequest(req);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: parsed.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const encoder = new TextEncoder();
  const { apiKey, userInput, model } = parsed.value;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array): void => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const send = (event: AgentEvent): void => {
        safeEnqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      };

      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_MS);

      // Bail out early if the client disconnects.
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      try {
        await runPipeline({
          apiKey,
          rawInput: userInput,
          model,
          emit: send,
        });
      } catch (err) {
        send({
          type: 'error',
          message: (err as Error).message ?? '알 수 없는 오류가 발생했어요.',
        });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
