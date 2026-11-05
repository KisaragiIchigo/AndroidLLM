import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex, { type Options as KatexOptions } from 'rehype-katex';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { prepareMarkdown } from '../../../lib/markdown';

// CommonMark refuses to close ** after 「）」 when Japanese follows; the CJK plugin relaxes that rule.
const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkCjkFriendly];
const KATEX_OPTIONS: KatexOptions = { strict: 'ignore', errorColor: '#e07a6b' };
const REHYPE_PLUGINS: [typeof rehypeKatex, KatexOptions][] = [[rehypeKatex, KATEX_OPTIONS]];

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-5 marker:text-lamp">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-6 marker:font-mono marker:text-[13px] marker:text-lamp">{children}</ol>,
  li: ({ children }) => <li className="my-0.5 pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-paper">{children}</strong>,
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-[1.05em] font-semibold tracking-wide first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-[1.05em] font-semibold tracking-wide first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-semibold tracking-wide first:mt-0">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-paper/10 pl-3 text-paper-muted">{children}</blockquote>,
  hr: () => <hr className="my-4 border-paper/[0.07]" />,
  a: ({ children }) => <span className="text-lamp-hi underline decoration-lamp/40 underline-offset-2">{children}</span>,
  img: () => null,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-paper/[0.07] bg-black/40 p-3 font-mono text-[13px] leading-relaxed shadow-inset [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.88em] text-lamp-hi">{children}</code>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-paper/[0.07]">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-paper/[0.07] bg-ink-raised px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-paper/[0.04] px-3 py-2 align-top">{children}</td>,
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="break-words text-body">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components} skipHtml>
        {prepareMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
});
