import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from '../../lib/chat/types';
import { errorMessage, Llm, type ModelStatus } from '../../lib/native';

export type EngineState =
  | { phase: 'checking' }
  | { phase: 'setup'; status: ModelStatus }
  | { phase: 'loading'; status: ModelStatus }
  | { phase: 'ready'; status: ModelStatus; backend: Backend; gpuError: string | null }
  | { phase: 'error'; status: ModelStatus | null; message: string };

export interface EngineHandle {
  state: EngineState;
  /** Increments after every successful load; the native conversation must be rebuilt when it changes. */
  epoch: number;
  reload: () => void;
}

export function useEngine(backend: Backend, maxTokens: number): EngineHandle {
  const [state, setState] = useState<EngineState>({ phase: 'checking' });
  const [epoch, setEpoch] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const token = useRef(0);

  useEffect(() => {
    const current = ++token.current;
    const stale = () => current !== token.current;
    let status: ModelStatus | null = null;

    (async () => {
      try {
        status = await Llm.getModelStatus();
        if (stale()) return;
        if (!status.present) {
          setState({ phase: 'setup', status });
          return;
        }
        setState({ phase: 'loading', status });
        const loaded = await Llm.loadEngine({ backend, maxTokens });
        if (stale()) return;
        setState({ phase: 'ready', status, backend: loaded.backend, gpuError: loaded.gpuError });
        setEpoch((e) => e + 1);
      } catch (error) {
        if (!stale()) setState({ phase: 'error', status, message: errorMessage(error) });
      }
    })();
  }, [backend, maxTokens, attempt]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  return { state, epoch, reload };
}
