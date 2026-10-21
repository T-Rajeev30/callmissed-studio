import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useImageGen } from './useImageGen';
import { server } from '../test/setup';

describe('useImageGen', () => {
  it('adds a successful image to its session gallery', async () => {
    const { result } = renderHook(() => useImageGen());
    let success = false;
    await act(async () => {
      success = await result.current.generate('Sunrise over Bengaluru');
    });
    expect(success).toBe(true);
    expect(result.current.gallery[0]).toMatchObject({
      prompt: 'Sunrise over Bengaluru',
      src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
    });
    expect(result.current.busy).toBe(false);
  });

  it('surfaces a generation error without adding an image', async () => {
    server.use(
      http.post('*/api/images', () =>
        HttpResponse.json({ error: { message: 'Image quota reached' } }, { status: 402 }),
      ),
    );
    const { result } = renderHook(() => useImageGen());
    let success = true;
    await act(async () => {
      success = await result.current.generate('A small paper boat');
    });
    expect(success).toBe(false);
    expect(result.current.error).toBe('Image quota reached');
    expect(result.current.gallery).toHaveLength(0);
  });
});
