import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../../components/ui/Segmented';
import { copyText } from '../../../lib/clipboard';
import { changeCount, diffText } from '../../../lib/diff/textDiff';

type View = 'diff' | 'revised' | 'original';

interface DiffCardProps {
  source: { text: string; fromDocument: boolean } | null;
  revised: string;
  complete: boolean;
}

const REWRITE_THRESHOLD = 0.35;

export function DiffCard({ source, revised, complete }: DiffCardProps) {
  const [manualView, setManualView] = useState<View | null>(null);
  const [copied, setCopied] = useState(false);

  const sourceText = source?.text;
  const fromDocument = source?.fromDocument ?? false;
  const result = useMemo(
    () => (complete && sourceText !== undefined ? diffText(sourceText, revised, { trimEdgeDeletions: !fromDocument }) : null),
    [complete, sourceText, fromDocument, revised],
  );

  const autoView: View = result && !result.approximate && result.similarity >= REWRITE_THRESHOLD ? 'diff' : 'revised';
  const view = result ? (manualView ?? autoView) : 'revised';
  const changes = result ? changeCount(result.ops) : 0;

  const copy = async () => {
    if (await copyText(revised)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-paper/[0.07] bg-ink-surface">
      <div className="flex min-h-[40px] items-center justify-between border-b border-paper/[0.04] px-3.5 text-[13px] font-medium tracking-wider text-paper-muted">
        <span>{complete ? '添削結果' : '添削中…'}</span>
        {result && changes > 0 && (
          <span className="rounded-md bg-lamp/10 px-2 py-0.5 font-mono text-xs tracking-normal text-lamp-hi shadow-lamp">{changes} 箇所</span>
        )}
      </div>

      <div className="whitespace-pre-wrap break-words px-3.5 py-3 text-body">
        {view === 'diff' && result
          ? result.ops.map((op, i) =>
              op.type === 'equal' ? (
                <span key={i}>{op.text}</span>
              ) : op.type === 'insert' ? (
                <ins key={i} className="rounded-[3px] bg-sealed/15 py-px text-sealed-text no-underline">
                  {op.text}
                </ins>
              ) : (
                <del key={i} className="rounded-[3px] bg-ember/[0.12] py-px text-ember-soft decoration-ember/70">
                  {op.text}
                </del>
              ),
            )
          : view === 'original' && source
            ? <span className="text-paper-muted">{source.text}</span>
            : revised}
        {!complete && <span className="ml-0.5 inline-block h-[1.05em] w-2 translate-y-[3px] animate-breathe rounded-[1px] bg-lamp shadow-lamp-strong" />}
      </div>

      {complete && (
        <div className="flex flex-wrap items-center gap-2 border-t border-paper/[0.04] px-3 py-2.5">
          {result && (
            <Segmented
              label="表示の切り替え"
              value={view}
              onChange={setManualView}
              options={[
                { value: 'diff', label: '差分' },
                { value: 'revised', label: '修正後' },
                { value: 'original', label: '原文' },
              ]}
            />
          )}
          <button
            type="button"
            onClick={copy}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep px-3.5 text-[13px] font-medium tracking-wider text-lamp-ink shadow-lamp active:scale-[0.97]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'コピーしました' : '修正文をコピー'}
          </button>
        </div>
      )}
    </div>
  );
}
