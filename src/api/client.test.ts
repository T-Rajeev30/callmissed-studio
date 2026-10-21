import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CallMissedError, callMissedApi, getApiStatus } from './client';
import { server } from '../test/setup';

const chatUrl = '*/api/chat';

describe('CallMissed API client', () => {
  it('reads server configuration status', async () => {
    await expect(getApiStatus()).resolves.toEqual({ configured: true });
  });

  it('returns a typed error when the server cannot read API status', async () => {
    server.use(
      http.get('*/api/status', () =>
        HttpResponse.json({ error: { message: 'Unavailable' } }, { status: 503 }),
      ),
    );
    await expect(getApiStatus()).rejects.toMatchObject({ status: 503, message: 'Unavailable' });
  });

  it('returns a typed chat response and sends an idempotency key', async () => {
    let key = '';
    server.use(
      http.post(chatUrl, ({ request }) => {
        key = request.headers.get('idempotency-key') ?? '';
        return HttpResponse.json({
          choices: [{ message: { role: 'assistant', content: 'Hello' } }],
        });
      }),
    );
    const result = await callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5');
    expect(result.choices[0]?.message.content).toBe('Hello');
    expect(key).toMatch(/^[a-zA-Z0-9-]+$/);
  });

  it('preserves CallMissed errors and does not retry an unauthorized request', async () => {
    let calls = 0;
    server.use(
      http.post(chatUrl, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { message: 'Invalid API key', code: 'invalid_api_key' } },
          { status: 401 },
        );
      }),
    );
    await expect(
      callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5'),
    ).rejects.toMatchObject<Partial<CallMissedError>>({
      status: 401,
      code: 'invalid_api_key',
      message: 'Invalid API key',
    });
    expect(calls).toBe(1);
  });

  it('retries a 429 with the same idempotency key', async () => {
    let calls = 0;
    const keys: string[] = [];
    server.use(
      http.post(chatUrl, ({ request }) => {
        calls += 1;
        keys.push(request.headers.get('idempotency-key') ?? '');
        if (calls === 1)
          return HttpResponse.json(
            { error: { message: 'Try later' } },
            { status: 429, headers: { 'Retry-After': '0' } },
          );
        return HttpResponse.json({
          choices: [{ message: { role: 'assistant', content: 'Retried' } }],
        });
      }),
    );
    await expect(
      callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5'),
    ).resolves.toMatchObject({ choices: [{ message: { content: 'Retried' } }] });
    expect(calls).toBe(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('retries a 5xx response with the idempotency key', async () => {
    let calls = 0;
    server.use(
      http.post(chatUrl, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { message: 'Temporary outage' } },
              { status: 503, headers: { 'Retry-After': '0' } },
            )
          : HttpResponse.json({
              choices: [{ message: { role: 'assistant', content: 'Back online' } }],
            });
      }),
    );
    const result = await callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5');
    expect(result.choices[0]?.message.content).toBe('Back online');
    expect(calls).toBe(2);
  });

  it('times out a hung request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );
    const result = callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5');
    const assertion = expect(result).rejects.toMatchObject({
      message: 'Request timed out. Please try again.',
    });
    await vi.advanceTimersByTimeAsync(45_000);
    await assertion;
  });

  it('retries transient network errors and then returns a typed failure', async () => {
    let calls = 0;
    server.use(
      http.post(chatUrl, () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );
    await expect(
      callMissedApi.chat([{ role: 'user', content: 'Hi' }], 'kimi-k2.5'),
    ).rejects.toBeInstanceOf(CallMissedError);
    expect(calls).toBe(3);
  });

  it('does not retry voice session creation', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/voice', () => {
        calls += 1;
        return HttpResponse.json({ error: { message: 'Unavailable' } }, { status: 503 });
      }),
    );
    await expect(callMissedApi.createVoiceSession()).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });

  it('cancels while waiting for a retry window', async () => {
    const controller = new AbortController();
    let calls = 0;
    server.use(
      http.post(chatUrl, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { message: 'Rate limited' } },
          { status: 429, headers: { 'Retry-After': '10' } },
        );
      }),
    );
    const request = callMissedApi.chat(
      [{ role: 'user', content: 'Hi' }],
      'kimi-k2.5',
      controller.signal,
    );
    await vi.waitFor(() => expect(calls).toBe(1));
    controller.abort();
    await expect(request).rejects.toMatchObject({ message: 'Request cancelled.' });
    expect(calls).toBe(1);
  });
});
