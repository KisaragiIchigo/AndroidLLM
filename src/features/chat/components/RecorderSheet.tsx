import { Mic } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Notice } from '../../../components/ui/Notice';
import { Sheet } from '../../../components/ui/Sheet';
import type { AttachmentMeta } from '../../../lib/chat/types';
import { formatDuration } from '../../../lib/format';
import { useRecorder } from '../hooks/useRecorder';

interface RecorderSheetProps {
  open: boolean;
  onClose: () => void;
  onRecorded: (attachments: AttachmentMeta[]) => void;
}

export function RecorderSheet({ open, onClose, onRecorded }: RecorderSheetProps) {
  const recorder = useRecorder();
  const startedFor = useRef(false);

  useEffect(() => {
    if (open && !startedFor.current) {
      startedFor.current = true;
      void recorder.start();
    }
    if (!open) startedFor.current = false;
  }, [open, recorder]);

  const atLimit = recorder.recording && recorder.elapsedMs >= recorder.maxSeconds * 1000;

  const finish = async () => {
    const attachments = await recorder.stop();
    if (attachments.length) onRecorded(attachments);
    onClose();
  };

  const dismiss = () => {
    void recorder.cancel();
    onClose();
  };

  useEffect(() => {
    if (atLimit) void finish();
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && dismiss()}
      title="録音"
      footer={
        <div className="flex gap-2 pb-3">
          <button
            type="button"
            onClick={dismiss}
            className="h-11 flex-1 rounded-xl border border-paper/[0.07] bg-ink-raised text-sm font-medium tracking-wider active:scale-[0.97]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!recorder.recording}
            className="h-11 flex-1 rounded-xl bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep text-sm font-medium tracking-wider text-lamp-ink shadow-lamp active:scale-[0.97] disabled:opacity-40"
          >
            停止して添付
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full border ${recorder.recording ? 'border-lamp/40 shadow-lamp' : 'border-paper/[0.07]'}`}>
          <Mic className={`h-5 w-5 ${recorder.recording ? 'animate-breathe text-lamp' : 'text-paper-muted'}`} />
        </span>
        <p className="font-mono text-2xl tracking-wider">
          {formatDuration(recorder.elapsedMs)}
          <span className="text-base text-paper-muted"> / {formatDuration(recorder.maxSeconds * 1000)}</span>
        </p>
        <div className="flex h-10 items-center gap-[3px]" aria-hidden>
          {recorder.levels.map((level, i) => (
            <i key={i} className="block w-[3px] rounded-full bg-lamp transition-[height] duration-100" style={{ height: `${Math.max(3, level * 40)}px`, opacity: 0.35 + level * 0.65 }} />
          ))}
        </div>
        <p className="text-center text-sm leading-relaxed text-paper-muted">
          録音した音声は、この端末の中だけでモデルに渡されます。
          <br />
          30秒ごとに区切って、最大2分まで処理します。
        </p>
        {recorder.error && <Notice tone="danger">{recorder.error}</Notice>}
      </div>
    </Sheet>
  );
}
