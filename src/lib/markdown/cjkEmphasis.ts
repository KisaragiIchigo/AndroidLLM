const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々「」『』（）【】〈〉《》、。！？：';

const SPACE_AFTER_OPEN = new RegExp(`(^|[\\s${CJK}])\\*\\*[ \\u3000]+(?=[${CJK}])`, 'gu');
const SPACE_BEFORE_CLOSE = new RegExp(`(?<=[${CJK}])[ \\u3000]+\\*\\*(?=$|[\\s${CJK}])`, 'gu');

/**
 * The model often writes 「** 強調**」 with a stray space after the opening delimiter, which
 * CommonMark refuses to treat as emphasis. The space carries no meaning between Japanese
 * characters, so it is dropped there. Only lines whose ** pair up are touched, so prose that
 * mentions a lone "**" stays as written.
 */
export function tightenCjkEmphasis(prose: string): string {
  return prose
    .split('\n')
    .map((line) =>
      (line.match(/\*\*/g)?.length ?? 0) % 2 === 0 ? line.replace(SPACE_AFTER_OPEN, '$1**').replace(SPACE_BEFORE_CLOSE, '**') : line,
    )
    .join('\n');
}
