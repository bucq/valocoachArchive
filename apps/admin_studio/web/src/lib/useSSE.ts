import { useState, useCallback } from 'react';

const BASE = 'http://localhost:3001';

export function useSSE<T>() {
  const [logs, setLogs]       = useState<T[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const start = useCallback((path: string, body: unknown) => {
    setLogs([]);
    setError(null);
    setRunning(true);

    fetch(`${BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error((err as { error?: string }).error ?? res.statusText);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as T;
              setLogs(prev => [...prev, event]);
            } catch { /* ignore malformed */ }
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setRunning(false));
  }, []);

  const clear = useCallback(() => { setLogs([]); setError(null); }, []);

  return { logs, running, error, start, clear };
}
