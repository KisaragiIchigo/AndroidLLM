export const PROOFREAD_INTENT = /添削|校正|推敲|リライト|言い換え|書き直|直して|整えて|誤字|脱字/;

const FORMAT_NOTE = [
  '［出力形式］',
  '修正後の全文を ```revised で始まり ``` で終わるブロックに入れて出力してください。ブロックの中には修正後の本文だけを書きます。',
  'その後に「修正のポイント」という見出しを置き、主な変更点を3〜6個の箇条書きで説明してください。',
  '原文の意図・固有名詞・数値は変えず、長い文書でも省略せずに全文を出力してください。',
].join('\n');

/**
 * Small models over-apply standing rules, so the diff-card format is attached only to
 * messages that actually ask for proofreading instead of living in the system prompt.
 */
export function withProofreadFormat(text: string, intentSource: string): string {
  if (!PROOFREAD_INTENT.test(intentSource)) return text;
  return [text, FORMAT_NOTE].filter(Boolean).join('\n\n');
}
