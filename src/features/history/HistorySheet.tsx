import { Fingerprint, Loader2, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Notice } from '../../components/ui/Notice';
import { Sheet } from '../../components/ui/Sheet';
import type { ConversationSummary } from '../../lib/chat/types';
import { dayBucket, formatClock } from '../../lib/format';
import { AUTH_CANCELLED, errorCode, errorMessage, KEY_INVALIDATED, Vault } from '../../lib/native';

interface HistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentId: string;
  ephemeral: boolean;
  onOpenConversation: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<boolean>;
}

type Phase = 'auth' | 'ready' | 'cancelled' | 'invalidated' | 'error';

const PRIMARY =
  'flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep px-5 text-sm font-medium tracking-wider text-lamp-ink shadow-lamp active:scale-[0.97]';

export function HistorySheet(props: HistorySheetProps) {
  const { open, onOpenChange, currentId, ephemeral, onOpenConversation, onDelete, onDeleteAll } = props;
  const [phase, setPhase] = useState<Phase>('auth');
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const unlock = useCallback(async () => {
    setPhase('auth');
    setError(null);
    try {
      const { items: list } = await Vault.openHistory();
      setItems(list);
      setPhase('ready');
    } catch (e) {
      const code = errorCode(e);
      if (code === AUTH_CANCELLED) setPhase('cancelled');
      else if (code === KEY_INVALIDATED) setPhase('invalidated');
      else {
        setError(errorMessage(e));
        setPhase('error');
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    void unlock();
    return () => {
      setItems([]);
      void Vault.closeHistory();
    };
  }, [open, unlock]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => `${i.title} ${i.preview}`.toLowerCase().includes(q)) : items;
    const now = Date.now();
    const map = new Map<string, ConversationSummary[]>();
    filtered.forEach((item) => {
      const key = dayBucket(item.updatedAt, now);
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()];
  }, [items, query]);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="履歴"
        tall
        footer={
          phase === 'ready' && items.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              className="mb-3 h-11 w-full rounded-xl border border-ember/25 bg-ember/10 text-sm font-medium tracking-wider text-ember-text active:scale-[0.97]"
            >
              すべての会話を削除
            </button>
          ) : undefined
        }
      >
        {ephemeral && (
          <div className="mb-3">
            <Notice tone="warning">揮発モードがオンのため、現在の会話は保存されません。</Notice>
          </div>
        )}

        {phase === 'auth' && (
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-paper-muted">
            <Loader2 className="h-5 w-5 animate-spin text-lamp" />
            認証しています…
          </div>
        )}

        {phase === 'cancelled' && (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-lamp/30 bg-lamp/10">
              <Fingerprint className="h-5 w-5 text-lamp" />
            </span>
            <p className="text-sm leading-relaxed text-paper-muted">保存した会話を表示するには、認証が必要です。</p>
            <button type="button" onClick={unlock} className={PRIMARY}>
              もう一度認証する
            </button>
          </div>
        )}

        {phase === 'invalidated' && (
          <div className="flex flex-col gap-4 py-6">
            <Notice tone="danger">
              端末の画面ロックが変更されたため、保存済みの会話を復号できません。会話を消去すると、新しい鍵で記録を再開できます。
            </Notice>
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              className="h-11 rounded-xl border border-ember/25 bg-ember/10 text-sm font-medium tracking-wider text-ember-text active:scale-[0.97]"
            >
              保存した会話を消去して続ける
            </button>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="flex flex-col items-start gap-3 py-6">
            <Notice tone="danger">{error}</Notice>
            <button type="button" onClick={unlock} className="text-sm text-lamp-hi underline underline-offset-2">
              再試行
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            {items.length > 0 && (
              <label className="mb-4 flex h-11 items-center gap-2 rounded-xl border border-paper/[0.07] bg-black/40 px-3 shadow-inset focus-within:border-lamp/50">
                <Search className="h-4 w-4 shrink-0 text-paper-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="履歴を検索"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-paper-muted"
                />
              </label>
            )}
            {items.length === 0 && <p className="py-10 text-center text-sm leading-relaxed text-paper-muted">保存された会話はまだありません。</p>}
            {items.length > 0 && groups.length === 0 && <p className="py-10 text-center text-sm text-paper-muted">一致する会話はありません。</p>}
            <div className="flex flex-col gap-5">
              {groups.map(([label, list]) => (
                <section key={label}>
                  <h3 className="label-jp mb-2">{label}</h3>
                  <ul className="divide-y divide-paper/[0.04] overflow-hidden rounded-2xl border border-paper/[0.07] bg-ink-raised/60">
                    {list.map((item) => (
                      <li key={item.id} className="flex items-stretch">
                        <button
                          type="button"
                          onClick={async () => {
                            await onOpenConversation(item.id);
                            onOpenChange(false);
                          }}
                          className="min-w-0 flex-1 px-3.5 py-3 text-left active:bg-paper/[0.03]"
                        >
                          <span className="flex items-center gap-2">
                            {item.id === currentId && <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-lamp shadow-lamp-strong" />}
                            <span className="truncate text-[15px] font-medium">{item.title}</span>
                            <span className="ml-auto shrink-0 font-mono text-xs text-paper-muted">{formatClock(item.updatedAt)}</span>
                          </span>
                          {item.preview && <span className="mt-1 block truncate text-sm text-paper-muted">{item.preview}</span>}
                        </button>
                        <button
                          type="button"
                          aria-label={`「${item.title}」を削除`}
                          onClick={() => setPendingDelete(item)}
                          className="flex w-12 shrink-0 items-center justify-center active:bg-ember/10"
                        >
                          <Trash2 className="h-4 w-4 text-paper-muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="この会話を削除しますか？"
        description={`「${pendingDelete?.title ?? ''}」を端末から完全に削除します。元に戻すことはできません。`}
        confirmLabel="削除する"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          const id = pendingDelete.id;
          setPendingDelete(null);
          await onDelete(id);
          setItems((list) => list.filter((i) => i.id !== id));
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="すべての会話を削除しますか？"
        description="保存されているすべての会話と、その暗号鍵を端末から削除します。元に戻すことはできません。"
        confirmLabel="すべて削除"
        destructive
        onConfirm={async () => {
          setConfirmAll(false);
          if (await onDeleteAll()) {
            setItems([]);
            setPhase('ready');
          }
        }}
      />
    </>
  );
}
