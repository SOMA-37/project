import type { PipelineRequest } from '../../server/types';

export type ParseResult =
  | { ok: true; value: PipelineRequest }
  | { ok: false; error: string; status: number };

const MAX_BODY_BYTES = 64 * 1024;

export async function parsePipelineRequest(req: Request): Promise<ParseResult> {
  if (req.method !== 'POST') {
    return { ok: false, error: 'Method not allowed', status: 405 };
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, error: 'Request body too large', status: 413 };
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body', status: 400 };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'apiKey와 userInput이 필요합니다.', status: 400 };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.apiKey !== 'string' || r.apiKey.length === 0) {
    return { ok: false, error: 'apiKey와 userInput이 필요합니다.', status: 400 };
  }
  if (typeof r.userInput !== 'object' || r.userInput === null) {
    return { ok: false, error: 'apiKey와 userInput이 필요합니다.', status: 400 };
  }
  return {
    ok: true,
    value: {
      apiKey: r.apiKey,
      userInput: r.userInput as PipelineRequest['userInput'],
      model: typeof r.model === 'string' ? r.model : undefined,
    },
  };
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
