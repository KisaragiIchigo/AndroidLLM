import type { UserTurn } from '../../../lib/chat/types';
import { AttachmentPreview } from './AttachmentPreview';

export function UserMessage({ turn }: { turn: UserTurn }) {
  const visuals = turn.attachments.filter((a) => (a.kind === 'image' || a.kind === 'video') && a.thumb);
  const chips = turn.attachments.filter((a) => !visuals.includes(a));

  return (
    <div className="flex max-w-[86%] flex-col items-end gap-1.5 self-end">
      {visuals.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {visuals.map((a) => (
            <AttachmentPreview key={a.id} attachment={a} size="lg" />
          ))}
        </div>
      )}
      {chips.map((a) => (
        <AttachmentPreview key={a.id} attachment={a} size="sm" />
      ))}
      {turn.text && (
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-paper/[0.07] bg-ink-raised px-3.5 py-2.5 text-body">
          {turn.text}
        </div>
      )}
    </div>
  );
}
