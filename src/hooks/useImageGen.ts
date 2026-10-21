import { useCallback, useEffect, useRef, useState } from 'react';
import { callMissedApi } from '../api/client';

export type GeneratedAsset = { id: string; prompt: string; src: string; createdAt: number };

export function useImageGen() {
  const [gallery, setGallery] = useState<GeneratedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const generate = useCallback(
    async (prompt: string): Promise<boolean> => {
      const value = prompt.trim();
      if (!value || busy) return false;
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError(null);
      try {
        const result = await callMissedApi.generateImage(value, controller.signal);
        const item = result.data[0];
        const src = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
        if (!src) throw new Error('No image was returned.');
        setGallery((items) => [
          { id: crypto.randomUUID(), prompt: value, src, createdAt: Date.now() },
          ...items,
        ]);
        return true;
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Image generation failed.');
        return false;
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy(false);
        }
      }
    },
    [busy],
  );

  return { gallery, busy, error, generate, dismissError: () => setError(null) };
}
