const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

/** Applies a rewrite to prose only; fenced blocks and inline code pass through untouched. */
export function mapProse(markdown: string, rewrite: (prose: string) => string): string {
  return markdown
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : rewrite(part)))
    .join('');
}
