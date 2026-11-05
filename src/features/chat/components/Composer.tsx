import { ArrowUp, Lightbulb, Loader2, Plus, Square } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AttachmentMeta } from '../../../lib/chat/types';
import { AttachmentPreview } from './AttachmentPreview';

interface ComposerProps {
  meta: ReactNode;
  notice: ReactNode;
  staged: AttachmentMeta[];
  processing: boolean;
  think: boolean;
  streaming: boolean;
  ready: boolean;
  onToggleThink: () => void;
  onOpenAttach: () => void;
  onRemoveAttachment: (id: string) => void;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
}

const MAX_TEXTAREA_PX = 168;

export function Composer(props: ComposerProps) {
  const { meta, notice, staged, processing, think, streaming, ready, onToggleThink, onOpenAttach, onRemoveAttachment, onSend, onStop } = props;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [text]);

  const empty = !text.trim() && staged.length === 0;
  const canSend = ready && !empty && !processing && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend(text.trim());
    setSending(false);
    if (ok) setText('');
  };

  return (
    <div className="shrink-0 px-3.5 pb-safe">
      {meta}
      {notice && <div className="mb-2">{notice}</div>}
      <div className="mb-3 rounded-[20px] border border-paper/[0.07] bg-ink-surface p-2.5 shadow-inset">
        {(staged.length > 0 || processing) && (
          <div className="flex gap-2 overflow-x-auto px-0.5 pb-2.5 pt-1.5">
            {staged.map((a) => (
              <AttachmentPreview key={a.id} attachment={a} size="sm" onRemove={() => onRemoveAttachment(a.id)} />
            ))}
            {processing && (
              <div className="flex h-16 shrink-0 items-center gap-2 rounded-xl border border-paper/[0.07] bg-ink-raised px-3 text-[13px] text-paper-muted">
                <Loader2 className="h-4 w-4 animate-spin text-lamp" />
                処理中…
              </div>
            )}
          </div>
        )}
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={streaming ? '生成中…' : 'メッセージ'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="block max-h-[168px] w-full resize-none bg-transparent px-1.5 pb-2 pt-0.5 text-body text-paper outline-none placeholder:text-paper-muted"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="添付"
            onClick={onOpenAttach}
            disabled={processing}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-paper/[0.07] bg-black/25 active:scale-[0.97] disabled:opacity-40"
          >
            <Plus className="h-4 w-4 text-paper-muted" />
          </button>
          <button
            type="button"
            aria-pressed={think}
            onClick={onToggleThink}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium tracking-wider active:scale-[0.97] ${
              think ? 'border-verdigris/25 bg-verdigris/[0.06] text-verdigris-text' : 'border-paper/[0.07] text-paper-muted'
            }`}
          >
            <Lightbulb className={`h-4 w-4 ${think ? 'text-verdigris-text' : 'text-paper-muted'}`} />
            Think
          </button>
          {streaming ? (
            <button
              type="button"
              aria-label="生成を停止"
              onClick={onStop}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-lamp/40 bg-ink-raised active:scale-[0.97]"
            >
              <Square className="h-3.5 w-3.5 fill-lamp text-lamp" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="送信"
              onClick={submit}
              disabled={!canSend}
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep shadow-lamp active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
            >
              <ArrowUp className="h-[18px] w-[18px] text-lamp-ink" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
