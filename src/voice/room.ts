import { Room } from 'livekit-client';

export function createVoiceRoom(): Room {
  if (import.meta.env.MODE === 'e2e' && window.__CM_E2E_VOICE_ROOM_FACTORY__) {
    return window.__CM_E2E_VOICE_ROOM_FACTORY__() as Room;
  }
  return new Room();
}
