export interface RevisionParts {
  before: string;
  revised: string;
  after: string;
  /** False while the closing fence has not streamed in yet. */
  complete: boolean;
}

const OPEN = /```revised[^\n]*\n/;

/** Splits an answer around the ```revised block the system prompt asks for. */
export function splitRevision(answer: string): RevisionParts | null {
  const open = OPEN.exec(answer);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = answer.indexOf('```', start);
  if (close < 0) {
    return { before: answer.slice(0, open.index), revised: answer.slice(start), after: '', complete: false };
  }
  return {
    before: answer.slice(0, open.index),
    revised: answer.slice(start, close).replace(/\n$/, ''),
    after: answer.slice(close + 3),
    complete: true,
  };
}
