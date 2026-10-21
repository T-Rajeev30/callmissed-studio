import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useChat } from './useChat';
import { server } from '../test/setup';

describe('useChat', () => {
  it('sends a message and appends the assistant response', async () => {
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send('  Hello  ');
    });
    expect(result.current.messages[result.current.messages.length - 1]).toEqual({
      role: 'assistant',
      content: 'A mocked reply.',
    });
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('keeps the failed user message and can retry it', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/chat', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: { message: 'Key is not authorized' } }, { status: 401 })
          : HttpResponse.json({
              choices: [{ message: { role: 'assistant', content: 'Recovered.' } }],
            });
      }),
    );
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send('Try this again');
    });
    expect(result.current.error).toBe('Key is not authorized');
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() =>
      expect(result.current.messages[result.current.messages.length - 1]?.content).toBe(
        'Recovered.',
      ),
    );
    expect(result.current.error).toBeNull();
  });

  it('resets the conversation and model selection', async () => {
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send('A question');
    });
    act(() => {
      result.current.setModel('gpt-5-mini');
      result.current.clear();
    });
    expect(result.current.model).toBe('gpt-5-mini');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe('assistant');
  });
});
