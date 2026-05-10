/**
 * Solar API (Upstage) chat client.
 * Endpoint follows OpenAI-compatible /v1/chat/completions schema.
 */

const SOLAR_BASE_URL =
  process.env.SOLAR_BASE_URL ?? 'https://api.upstage.ai/v1';

export const DEFAULT_SOLAR_MODEL = process.env.SOLAR_MODEL ?? 'solar-pro2';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SolarOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

interface SolarChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
}

export class SolarApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly bodyText?: string,
  ) {
    super(message);
    this.name = 'SolarApiError';
  }
}

export async function callSolar(
  messages: ChatMessage[],
  opts: SolarOptions,
): Promise<string> {
  if (!opts.apiKey || opts.apiKey.trim().length === 0) {
    throw new SolarApiError('Solar API key is missing', 401);
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_SOLAR_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
    stream: false,
  };

  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const url = `${SOLAR_BASE_URL.replace(/\/$/, '')}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new SolarApiError(
      `Network error contacting Solar: ${(err as Error).message}`,
      0,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SolarApiError(
      `Solar API error ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      text,
    );
  }

  const data = (await res.json()) as SolarChatResponse;
  const content = data.choices?.[0]?.message?.content ?? '';
  if (typeof content !== 'string' || content.length === 0) {
    throw new SolarApiError('Solar returned empty content', 500);
  }
  return content;
}

/**
 * Call Solar and parse the response as JSON, retrying once on parse failure
 * by repeating with a stricter system reminder.
 */
export async function callSolarJson<T>(
  messages: ChatMessage[],
  opts: SolarOptions,
): Promise<T> {
  const raw = await callSolar(messages, {
    ...opts,
    responseFormat: 'json_object',
  });

  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content:
          'Previous response was not valid JSON. Reply with ONLY a single JSON object, no prose, no markdown.',
      },
    ];
    const retry = await callSolar(retryMessages, {
      ...opts,
      responseFormat: 'json_object',
      temperature: 0,
    });
    return JSON.parse(stripCodeFence(retry)) as T;
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  }
  return trimmed;
}
