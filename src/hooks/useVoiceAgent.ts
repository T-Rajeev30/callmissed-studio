import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomEvent, Track, type Room } from 'livekit-client';
import { callMissedApi, type ChatMessage } from '../api/client';
import { createVoiceRoom } from '../voice/room';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

function removeVoiceAudio() {
  document
    .querySelectorAll('[data-voice-agent-audio="true"]')
    .forEach((element) => element.remove());
}

function publishVoiceState(setState: (state: VoiceState) => void, state: VoiceState) {
  setState(state);
  window.dispatchEvent(new CustomEvent<VoiceState>('callmissed:voice-status', { detail: state }));
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const pending = useRef<AbortController | null>(null);

  const end = useCallback(async () => {
    pending.current?.abort();
    pending.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    removeVoiceAudio();
    publishVoiceState(setStatus, 'idle');
    setMuted(false);
  }, []);

  useEffect(
    () => () => {
      pending.current?.abort();
      void roomRef.current?.disconnect();
      roomRef.current = null;
      removeVoiceAudio();
    },
    [],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (
      status === 'connecting' ||
      status === 'listening' ||
      status === 'thinking' ||
      status === 'speaking'
    )
      return false;
    setTranscript([]);
    setError(null);
    publishVoiceState(setStatus, 'connecting');
    const controller = new AbortController();
    pending.current = controller;
    let room: Room | null = null;
    try {
      const session = await callMissedApi.createVoiceSession(controller.signal);
      if (controller.signal.aborted) return false;
      room = createVoiceRoom();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.autoplay = true;
          element.dataset.voiceAgentAudio = 'true';
          document.body.appendChild(element);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) =>
        track.detach().forEach((element) => element.remove()),
      );
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        for (const segment of segments) {
          if (!segment.final || !segment.text.trim()) continue;
          setTranscript((items) => [
            ...items,
            {
              role: participant?.isLocal ? 'user' : 'assistant',
              content: segment.text.trim(),
            },
          ]);
          if (participant?.isLocal) publishVoiceState(setStatus, 'thinking');
          else publishVoiceState(setStatus, 'speaking');
        }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (participants) => {
        if (participants.some((participant) => !participant.isLocal))
          publishVoiceState(setStatus, 'speaking');
        else if (participants.some((participant) => participant.isLocal))
          publishVoiceState(setStatus, 'listening');
        else
          setStatus((current) => {
            const next = current === 'thinking' ? current : 'listening';
            window.dispatchEvent(
              new CustomEvent<VoiceState>('callmissed:voice-status', { detail: next }),
            );
            return next;
          });
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
          publishVoiceState(setStatus, 'idle');
          setMuted(false);
        }
      });
      await room.connect(session.ws_url, session.token);
      if (controller.signal.aborted) {
        await room.disconnect();
        return false;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      publishVoiceState(setStatus, 'listening');
      return true;
    } catch (cause) {
      if (room) await room.disconnect();
      if (!controller.signal.aborted) {
        const message =
          cause instanceof Error ? cause.message : 'Could not connect to the voice agent.';
        setError(message);
        publishVoiceState(setStatus, 'error');
      }
      return false;
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [status]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  return { status, transcript, error, muted, start, end, toggleMute };
}
