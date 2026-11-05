import { useCallback, useRef, useState } from 'react';
import type { AttachmentMeta } from '../../../lib/chat/types';
import { errorMessage, Media, type PickKind } from '../../../lib/native';
import { documentCharLimit } from '../../../lib/settings';

export const MAX_VISUALS_PER_MESSAGE = 10;

function visualCost(a: AttachmentMeta): number {
  if (a.kind === 'image') return 1;
  if (a.kind === 'video') return a.frames ?? 0;
  if (a.kind === 'document' && a.scanned) return Math.min(a.pages ?? 0, 4);
  return 0;
}

export function useAttachments(maxTokens: number) {
  const [staged, setStagedState] = useState<AttachmentMeta[]>([]);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stagedRef = useRef<AttachmentMeta[]>([]);

  const setStaged = useCallback((next: AttachmentMeta[]) => {
    stagedRef.current = next;
    setStagedState(next);
  }, []);

  const accept = useCallback(
    (incoming: AttachmentMeta[]) => {
      const next = [...stagedRef.current];
      const rejected: string[] = [];
      for (const item of incoming) {
        const used = next.reduce((sum, a) => sum + visualCost(a), 0);
        if (used + visualCost(item) > MAX_VISUALS_PER_MESSAGE) {
          rejected.push(item.id);
        } else {
          next.push(item);
        }
      }
      setStaged(next);
      if (rejected.length) {
        void Media.discard({ ids: rejected });
        setNotice(`画像と動画のコマは、1回の送信で合計 ${MAX_VISUALS_PER_MESSAGE} 枚までです。`);
        return;
      }
      const truncated = incoming.find((a) => a.truncated);
      if (truncated) {
        setNotice(
          truncated.kind === 'document'
            ? '文書が長いため、先頭部分のみを読み込みました。設定でコンテキスト長を広げると、より多く読み込めます。'
            : '長さの上限を超えたため、先頭部分のみを読み込みました。',
        );
      }
    },
    [setStaged],
  );

  const run = useCallback(
    async (task: () => Promise<{ attachments: AttachmentMeta[] }>) => {
      setProcessing(true);
      setNotice(null);
      try {
        const { attachments } = await task();
        accept(attachments);
      } catch (e) {
        setNotice(errorMessage(e));
      } finally {
        setProcessing(false);
      }
    },
    [accept],
  );

  const pick = useCallback(
    (kind: PickKind) => run(() => Media.pick({ kind, maxChars: documentCharLimit(maxTokens) })),
    [run, maxTokens],
  );

  const capture = useCallback(() => run(() => Media.capturePhoto()), [run]);

  const remove = useCallback(
    (id: string) => {
      setStaged(stagedRef.current.filter((a) => a.id !== id));
      void Media.discard({ ids: [id] });
    },
    [setStaged],
  );

  /** Hands the staged list to the caller; native payloads stay alive for the send. */
  const take = useCallback(() => {
    const taken = stagedRef.current;
    setStaged([]);
    return taken;
  }, [setStaged]);

  /** Puts attachments back when a send could not start. */
  const restore = useCallback((items: AttachmentMeta[]) => setStaged([...items, ...stagedRef.current]), [setStaged]);

  return { staged, processing, notice, clearNotice: () => setNotice(null), pick, capture, accept, remove, take, restore };
}
