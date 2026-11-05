import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface ThinkBlockProps {
  thought: string;
  thinking: boolean;
  thoughtMs?: number;
}

export function ThinkBlock({ thought, thinking, thoughtMs }: ThinkBlockProps) {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? thinking;
  const hasBody = thought.trim().length > 0;

  return (
    <div className="rounded-xl border border-verdigris/20 bg-verdigris/[0.06]">
      <button
        type="button"
        onClick={() => hasBody && setManual(!open)}
        aria-expanded={open}
        className="flex min-h-[40px] w-full items-center gap-2 px-3 text-[13px] font-medium tracking-wider text-verdigris-text"
      >
        <Lightbulb className={`h-4 w-4 text-verdigris ${thinking ? 'animate-breathe' : ''}`} />
        {thinking ? '思考中…' : '思考'}
        <span className="ml-auto font-mono text-xs tracking-normal text-verdigris">
          {thoughtMs !== undefined && `${(thoughtMs / 1000).toFixed(1)}s · `}
          {thought.length.toLocaleString('ja-JP')}字
        </span>
        {hasBody && <ChevronDown className={`h-4 w-4 text-verdigris transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && hasBody && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words border-t border-verdigris/[0.12] px-3 pb-3 pt-2.5 text-[13px] leading-relaxed text-verdigris-text">
              {thought}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
