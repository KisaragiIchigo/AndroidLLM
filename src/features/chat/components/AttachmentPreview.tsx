import { FileText, Play, ScanText, X } from 'lucide-react';
import type { AttachmentMeta } from '../../../lib/chat/types';
import { formatCount, formatDuration } from '../../../lib/format';

interface AttachmentPreviewProps {
  attachment: AttachmentMeta;
  size: 'sm' | 'lg';
  onRemove?: () => void;
}

function RemoveButton({ onRemove, name }: { onRemove: () => void; name: string }) {
  return (
    <button
      type="button"
      aria-label={`${name} を外す`}
      onClick={onRemove}
      className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-paper/[0.07] bg-ink-deep/90">
        <X className="h-3 w-3 text-paper" />
      </span>
    </button>
  );
}

function Wave({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-6 items-center gap-[2px]" aria-hidden>
      {levels.map((level, i) => (
        <i key={i} className="block w-[2px] rounded-full bg-lamp" style={{ height: `${Math.max(3, level * 22)}px`, opacity: 0.45 + level * 0.55 }} />
      ))}
    </div>
  );
}

export function AttachmentPreview({ attachment, size, onRemove }: AttachmentPreviewProps) {
  const box = size === 'lg' ? 'h-28 w-28' : 'h-16 w-16';

  if ((attachment.kind === 'image' || attachment.kind === 'video') && attachment.thumb) {
    return (
      <div className={`relative shrink-0 ${box}`}>
        <img src={attachment.thumb} alt={attachment.name} className="h-full w-full rounded-xl border border-paper/[0.07] object-cover" />
        {attachment.kind === 'video' && (
          <>
            <span className="absolute inset-0 flex items-center justify-center">
              <Play className="h-5 w-5 fill-paper text-paper drop-shadow" />
            </span>
            <span className="absolute bottom-1 left-1.5 font-mono text-xs text-paper [text-shadow:0_1px_3px_#000]">
              {formatDuration(attachment.durationMs ?? 0)}
            </span>
          </>
        )}
        {onRemove && <RemoveButton onRemove={onRemove} name={attachment.name} />}
      </div>
    );
  }

  const isAudio = attachment.kind === 'audio';
  const sub = isAudio
    ? formatDuration(attachment.durationMs ?? 0)
    : attachment.scanned
      ? `スキャン · ${attachment.pages ?? 0}p`
      : [attachment.pages ? `${attachment.pages}p` : null, `${formatCount(attachment.chars ?? 0)}字`].filter(Boolean).join(' · ');

  return (
    <div className="relative flex min-w-0 max-w-full shrink-0 items-center gap-2.5 rounded-xl border border-paper/[0.07] bg-ink-raised py-2 pl-2 pr-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lamp/10">
        {isAudio ? (
          <Play className="h-4 w-4 text-lamp" />
        ) : attachment.scanned ? (
          <ScanText className="h-4 w-4 text-lamp" />
        ) : (
          <FileText className="h-4 w-4 text-lamp" />
        )}
      </span>
      {isAudio && attachment.wave ? (
        <>
          <Wave levels={attachment.wave} />
          <span className="font-mono text-xs text-paper-muted">{sub}</span>
        </>
      ) : (
        <div className="min-w-0">
          <b className="block max-w-[180px] truncate text-[13px] font-medium">{attachment.name}</b>
          <small className="block font-mono text-xs text-paper-muted">{sub}</small>
        </div>
      )}
      {onRemove && <RemoveButton onRemove={onRemove} name={attachment.name} />}
    </div>
  );
}
