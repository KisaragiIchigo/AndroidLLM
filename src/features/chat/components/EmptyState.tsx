import { m } from 'framer-motion';

/** Each sentence wraps only after its comma, so the copy never splits mid-phrase on narrow screens. */
const LINES = [
  ['ここでの会話は、', 'この端末の外へは出ません。'],
  ['文章の添削も、', 'ちょっとした雑談もどうぞ。'],
];

export function EmptyState({ name }: { name: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pt-safe text-center">
      <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <p className="break-all font-display text-[clamp(28px,8vw,36px)] font-bold tracking-tight">
          {name}
          <span className="text-lamp">.</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-paper-muted">
          {LINES.map((phrases) => (
            <span key={phrases[0]} className="block">
              {phrases.map((phrase) => (
                <span key={phrase} className="inline-block">
                  {phrase}
                </span>
              ))}
            </span>
          ))}
        </p>
      </m.div>
    </div>
  );
}
