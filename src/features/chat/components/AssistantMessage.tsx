import { Check, Copy, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Notice } from '../../../components/ui/Notice';
import type { AssistantTurn } from '../../../lib/chat/types';
import { copyText } from '../../../lib/clipboard';
import { splitRevision } from '../../../lib/proofread/revision';
import { DiffCard } from './DiffCard';
import { Markdown } from './Markdown';
import { ThinkBlock } from './ThinkBlock';

interface AssistantMessageProps {
  turn: AssistantTurn;
  source: { text: string; fromDocument: boolean } | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

function Caret() {
  return <span className="inline-block h-[17px] w-2 animate-breathe rounded-[1px] bg-lamp shadow-lamp-strong" aria-hidden />;
}

export function AssistantMessage({ turn, source, canRegenerate, onRegenerate }: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const revision = useMemo(() => splitRevision(turn.text), [turn.text]);
  const streaming = turn.status === 'streaming';
  const thinking = streaming && !turn.text;
  const showThink = turn.thought.length > 0 || (turn.thinkEnabled && thinking);

  const copy = async () => {
    if (await copyText(revision?.complete ? revision.revised : turn.text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {showThink && <ThinkBlock thought={turn.thought} thinking={thinking} thoughtMs={turn.thoughtMs} />}

      {revision ? (
        <>
          {revision.before.trim() && <Markdown text={revision.before} />}
          <DiffCard source={source} revised={revision.revised} complete={revision.complete} />
          {revision.after.trim() && <Markdown text={revision.after} />}
        </>
      ) : (
        turn.text && <Markdown text={turn.text} />
      )}

      {streaming && !revision?.complete && !showThink && !turn.text && (
        <div className="flex gap-1.5 py-2" aria-label="応答を待っています">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-breathe rounded-full bg-lamp" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}
      {streaming && turn.text && !revision && <Caret />}

      {turn.status === 'cancelled' && <span className="text-sm text-paper-muted">停止しました。</span>}
      {turn.status === 'error' && <Notice tone="danger">{turn.error ?? '応答の生成に失敗しました。'}</Notice>}

      {!streaming && (
        <div className="-ml-2 flex items-center gap-0.5">
          {turn.text && (
            <button type="button" onClick={copy} aria-label="回答をコピー" className="flex h-9 w-9 items-center justify-center rounded-lg active:scale-[0.97]">
              {copied ? <Check className="h-4 w-4 text-sealed" /> : <Copy className="h-4 w-4 text-paper-muted" />}
            </button>
          )}
          {canRegenerate && (
            <button type="button" onClick={onRegenerate} aria-label="もう一度生成" className="flex h-9 w-9 items-center justify-center rounded-lg active:scale-[0.97]">
              <RotateCcw className="h-4 w-4 text-paper-muted" />
            </button>
          )}
          {turn.stats && (
            <span className="ml-1.5 font-mono text-xs text-paper-muted">
              {turn.stats.tokensPerSecond.toFixed(1)} tok/s · {turn.stats.decodeTokens} tok
            </span>
          )}
        </div>
      )}
    </div>
  );
}
