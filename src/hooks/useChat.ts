import { useCallback, useEffect, useRef, useState } from 'react';
import { callMissedApi, type ChatMessage } from '../api/client';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'Hey there. I’m your creative sidekick. What are we making today?',
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('kimi-k2.5');
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const send = useCallback(
    async (text: string, base: ChatMessage[] = messages) => {
      const value = text.trim();
      if (!value || busy) return;
      const history: ChatMessage[] = [...base, { role: 'user', content: value }];
      const controller = new AbortController();
      pending.current = controller;
      setMessages(history);
      setBusy(true);
      setError(null);
      try {
        const result = await callMissedApi.chat(history, model, controller.signal);
        const answer = result.choices[0]?.message?.content;
        if (!answer) throw new Error('The API returned an empty reply.');
        setMessages([...history, { role: 'assistant', content: answer }]);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'The message could not be sent.');
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy(false);
        }
      }
    },
    [busy, messages, model],
  );

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser || busy) return;
    const history = messages.slice(0, messages.lastIndexOf(lastUser));
    setError(null);
    void send(lastUser.content, history);
  }, [busy, messages, send]);

  const clear = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setMessages([WELCOME]);
    setBusy(false);
    setError(null);
  }, []);

  return { messages, busy, error, model, setModel, send, retry, clear };
}
