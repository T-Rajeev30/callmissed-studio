export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionResponse = {
  choices: Array<{ message: ChatMessage }>;
};

export type GeneratedImage = {
  b64_json?: string;
  url?: string;
};

export type ImageGenerationResponse = {
  data: GeneratedImage[];
};

export type VoiceSessionResponse = {
  id: string;
  ws_url: string;
  token: string;
  status: string;
};

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  retryable?: boolean;
};

type ErrorBody = {
  error?: { message?: string; code?: string; type?: string };
  detail?: Array<{ msg?: string }>;
};

export class CallMissedError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: { status?: number; code?: string; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'CallMissedError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

const RETRY_LIMIT = 2;

function makeIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function retryDelay(response: Response | undefined, retry: number): number {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 10_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.min(Math.max(dateDelay, 0), 10_000);
  }
  return Math.min(500 * 2 ** retry, 4_000);
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Request cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Request cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function parseError(response: Response): Promise<CallMissedError> {
  const body = (await response.json().catch(() => ({}) as ErrorBody)) as ErrorBody;
  return new CallMissedError(
    body.error?.message ??
      body.detail?.[0]?.msg ??
      `CallMissed request failed (${response.status}).`,
    {
      status: response.status,
      code: body.error?.code,
      requestId: response.headers.get('x-request-id') ?? undefined,
    },
  );
}

async function post<T>(
  service: 'chat' | 'images' | 'voice',
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const retryable = options.retryable ?? service !== 'voice';
  const idempotencyKey = retryable ? makeIdempotencyKey() : undefined;

  for (let retry = 0; ; retry += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Request timed out.', 'TimeoutError')),
      options.timeoutMs ?? 45_000,
    );
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetch(new URL(`/api/${service}`, window.location.origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) return (await response.json()) as T;

      const error = await parseError(response);
      if (retryable && retry < RETRY_LIMIT && (response.status === 429 || response.status >= 500)) {
        await wait(retryDelay(response, retry), options.signal);
        continue;
      }
      throw error;
    } catch (error) {
      if (error instanceof CallMissedError) throw error;
      if (options.signal?.aborted) throw new CallMissedError('Request cancelled.');
      if (controller.signal.aborted)
        throw new CallMissedError('Request timed out. Please try again.');
      if (retryable && retry < RETRY_LIMIT) {
        await wait(retryDelay(undefined, retry), options.signal);
        continue;
      }
      throw new CallMissedError(error instanceof Error ? error.message : 'Network request failed.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const callMissedApi = {
  chat(messages: ChatMessage[], model: string, signal?: AbortSignal) {
    return post<ChatCompletionResponse>(
      'chat',
      { model, messages, max_tokens: 700 },
      { signal, timeoutMs: 45_000 },
    );
  },
  generateImage(prompt: string, signal?: AbortSignal) {
    return post<ImageGenerationResponse>(
      'images',
      {
        model: 'flux-2-klein-9b',
        prompt,
        n: 1,
        size: '1024x1024',
      },
      { signal, timeoutMs: 120_000 },
    );
  },
  createVoiceSession(signal?: AbortSignal) {
    return post<VoiceSessionResponse>(
      'voice',
      {
        system_prompt:
          'You are a warm, concise creative assistant. Help the user brainstorm, write, and explore ideas.',
        voice: 'shubh',
        language: 'en-IN',
        llm_model: 'kimi-k2.5',
        max_duration_seconds: 180,
      },
      { signal, timeoutMs: 30_000, retryable: false },
    );
  },
};

export async function getApiStatus(signal?: AbortSignal): Promise<{ configured: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener('abort', relayAbort, { once: true });
  try {
    const response = await fetch(new URL('/api/status', window.location.origin), {
      signal: controller.signal,
    });
    if (!response.ok) throw await parseError(response);
    return (await response.json()) as { configured: boolean };
  } catch (error) {
    if (error instanceof CallMissedError) throw error;
    throw new CallMissedError('Could not reach the app server.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relayAbort);
  }
}
