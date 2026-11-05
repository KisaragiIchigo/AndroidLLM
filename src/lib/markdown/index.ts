import { tightenCjkEmphasis } from './cjkEmphasis';
import { normalizeMathDelimiters } from './mathDelimiters';
import { mapProse } from './prose';

/** Repairs model output quirks before it reaches the Markdown parser. */
export function prepareMarkdown(markdown: string): string {
  return mapProse(markdown, (prose) => tightenCjkEmphasis(normalizeMathDelimiters(prose)));
}
