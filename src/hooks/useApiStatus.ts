import { useEffect, useState } from 'react';
import { getApiStatus } from '../api/client';

export function useApiStatus() {
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getApiStatus(controller.signal)
      .then((result) => setConfigured(result.configured))
      .catch(() => {
        if (!controller.signal.aborted) setConfigured(false);
      });
    return () => controller.abort();
  }, []);
  return configured;
}
