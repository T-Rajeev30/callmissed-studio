import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceAgent } from './useVoiceAgent';
import { server } from '../test/setup';

const voiceMock = vi.hoisted(() => ({
  instances: [] as Array<{
    handlers: Record<string, (...args: unknown[]) => void>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
  }>,
}));

vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TranscriptionReceived: 'transcriptionReceived',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio' } },
  Room: class {
    handlers: Record<string, (...args: unknown[]) => void> = {};
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    localParticipant = { setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined) };
    on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      this.handlers[event] = callback;
    });
    constructor() {
      voiceMock.instances.push(this as unknown as (typeof voiceMock.instances)[number]);
    }
  },
}));

describe('useVoiceAgent', () => {
  beforeEach(() => {
    voiceMock.instances.length = 0;
  });

  it('creates a session, connects, records transcript, mutes, and ends cleanly', async () => {
    const { result } = renderHook(() => useVoiceAgent());
    let connected = false;
    await act(async () => {
      connected = await result.current.start();
    });
    expect(connected).toBe(true);
    expect(result.current.status).toBe('listening');
    const room = voiceMock.instances[0];
    expect(room?.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    const audio = document.createElement('audio');
    act(() => room?.handlers.trackSubscribed?.({ kind: 'audio', attach: () => audio }));
    expect(document.body.querySelector('[data-voice-agent-audio="true"]')).toBe(audio);
    act(() => room?.handlers.trackUnsubscribed?.({ detach: () => [audio] }));
    expect(audio.isConnected).toBe(false);
    act(() =>
      room?.handlers.transcriptionReceived?.([{ final: true, text: 'Hello agent' }], {
        isLocal: true,
      }),
    );
    expect(result.current.transcript).toEqual([{ role: 'user', content: 'Hello agent' }]);
    expect(result.current.status).toBe('thinking');
    act(() => room?.handlers.activeSpeakersChanged?.([{ isLocal: false }]));
    expect(result.current.status).toBe('speaking');
    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.muted).toBe(true);
    await act(async () => {
      await result.current.end();
    });
    expect(result.current.status).toBe('idle');
    expect(room?.disconnect).toHaveBeenCalledOnce();
  });

  it('shows session creation failures and allows another attempt', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/voice', () => {
        calls += 1;
        return HttpResponse.json(
          { error: { message: 'Voice permission is missing' } },
          { status: 403 },
        );
      }),
    );
    const { result } = renderHook(() => useVoiceAgent());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Voice permission is missing');
    expect(calls).toBe(1);
  });

  it('disconnects an active room when the hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useVoiceAgent());
    await act(async () => {
      await result.current.start();
    });
    const room = voiceMock.instances[0];
    unmount();
    await waitFor(() => expect(room?.disconnect).toHaveBeenCalledOnce());
  });
});
