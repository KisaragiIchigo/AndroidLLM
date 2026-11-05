import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttachmentMeta } from '../../../lib/chat/types';
import { errorMessage, Media } from '../../../lib/native';

const LEVEL_HISTORY = 36;

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(120);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_HISTORY).fill(0));
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  useEffect(() => {
    const handle = Media.addListener('recordLevel', ({ level, elapsedMs: ms }) => {
      if (!active.current) return;
      setElapsedMs(ms);
      setLevels((prev) => [...prev.slice(1), Math.min(1, level * 1.6)]);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setElapsedMs(0);
    setLevels(Array(LEVEL_HISTORY).fill(0));
    try {
      const result = await Media.startRecording();
      active.current = true;
      setMaxSeconds(result.maxSeconds);
      setRecording(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const stop = useCallback(async (): Promise<AttachmentMeta[]> => {
    if (!active.current) return [];
    active.current = false;
    setRecording(false);
    try {
      const { attachments } = await Media.stopRecording();
      return attachments;
    } catch (e) {
      setError(errorMessage(e));
      return [];
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    setRecording(false);
    await Media.cancelRecording();
  }, []);

  return { recording, elapsedMs, maxSeconds, levels, error, start, stop, cancel };
}
