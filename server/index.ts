/**
 * HTTP entrypoint for the multi-agent recommendation pipeline.
 *
 * Two routes:
 *   POST /api/recommend         — JSON response, runs the full pipeline.
 *   POST /api/recommend/stream  — Server-Sent Events; emits per-agent
 *                                 progress and a final `pipeline_done` event.
 *
 * Both routes accept `{ apiKey, userInput, model? }` in the JSON body.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { runPipeline } from './agents/pipeline';
import type { AgentEvent, PipelineRequest } from './types';

const MAX_BODY_BYTES = 64 * 1024; // 64KB — tiny payload, plenty of margin

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parsePipelineRequest(raw: unknown): PipelineRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.apiKey !== 'string') return null;
  if (typeof r.userInput !== 'object' || r.userInput === null) return null;
  return {
    apiKey: r.apiKey,
    userInput: r.userInput as PipelineRequest['userInput'],
    model: typeof r.model === 'string' ? r.model : undefined,
  };
}

export async function handleRecommend(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: (err as Error).message });
    return;
  }
  const parsed = parsePipelineRequest(raw);
  if (!parsed) {
    sendJson(res, 400, { error: 'apiKey와 userInput이 필요합니다.' });
    return;
  }

  const events: AgentEvent[] = [];
  const result = await runPipeline({
    apiKey: parsed.apiKey,
    rawInput: parsed.userInput,
    model: parsed.model,
    emit: (e) => events.push(e),
  });

  if (!result) {
    const errorEvent = events.find((e) => e.type === 'error');
    sendJson(res, 400, {
      error: errorEvent?.message ?? '파이프라인 실행에 실패했어요.',
      events,
    });
    return;
  }

  sendJson(res, 200, { result, events });
}

export async function handleRecommendStream(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: (err as Error).message });
    return;
  }
  const parsed = parsePipelineRequest(raw);
  if (!parsed) {
    sendJson(res, 400, { error: 'apiKey와 userInput이 필요합니다.' });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: AgentEvent): void => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Heartbeat every 15s in case the client buffers SSE chunks.
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  try {
    await runPipeline({
      apiKey: parsed.apiKey,
      rawInput: parsed.userInput,
      model: parsed.model,
      emit: send,
    });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

export interface RouteContext {
  pathname: string;
  method: string;
}

export async function dispatch(
  ctx: RouteContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (ctx.method !== 'POST') return false;
  if (ctx.pathname === '/api/recommend') {
    await handleRecommend(req, res);
    return true;
  }
  if (ctx.pathname === '/api/recommend/stream') {
    await handleRecommendStream(req, res);
    return true;
  }
  return false;
}
