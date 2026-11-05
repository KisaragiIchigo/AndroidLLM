import { Camera, FileText, Image, Mic, ShieldCheck, Video, type LucideIcon } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import type { PickKind } from '../../../lib/native';

export type AttachAction = PickKind | 'camera' | 'record';

interface AttachSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: AttachAction) => void;
}

const TILES: { action: AttachAction; label: string; icon: LucideIcon }[] = [
  { action: 'image', label: '写真', icon: Image },
  { action: 'camera', label: 'カメラ', icon: Camera },
  { action: 'record', label: '録音', icon: Mic },
  { action: 'video', label: '動画', icon: Video },
  { action: 'document', label: 'ファイル', icon: FileText },
];

const LIMITS = [
  { kind: '画像', text: '1回の送信で10枚まで添付できます。' },
  { kind: '音声', text: '2分まで、30秒ごとに処理します。' },
  { kind: '動画', text: '8コマと音声60秒までを読み取ります。' },
  { kind: 'ファイル', text: 'PDF・Word・テキストに対応しています。' },
];

export function AttachSheet({ open, onOpenChange, onAction }: AttachSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="添付">
      <div className="mb-5 grid grid-cols-5 gap-2">
        {TILES.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="flex flex-col items-center gap-2 text-[13px] font-medium tracking-wider active:scale-[0.97]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper/[0.07] bg-ink-raised">
              <Icon className="h-5 w-5 text-paper" strokeWidth={1.7} />
            </span>
            {label}
          </button>
        ))}
      </div>
      <dl className="divide-y divide-paper/[0.04] rounded-2xl border border-paper/[0.07] bg-black/25">
        {LIMITS.map(({ kind, text }) => (
          <div key={kind} className="flex gap-3 px-3.5 py-2.5 text-[13px] leading-relaxed">
            <dt className="w-14 shrink-0 font-medium text-paper">{kind}</dt>
            <dd className="text-paper-muted">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 flex items-center gap-2 text-[13px] text-sealed">
        <ShieldCheck className="h-4 w-4" />
        端末の中だけで処理されます。
      </p>
    </Sheet>
  );
}
