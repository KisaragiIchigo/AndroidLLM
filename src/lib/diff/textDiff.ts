export type DiffType = 'equal' | 'insert' | 'delete';

export interface DiffOp {
  type: DiffType;
  text: string;
}

export interface DiffResult {
  ops: DiffOp[];
  /** Share of the longer text left untouched, 0..1. Low values mean a rewrite rather than an edit. */
  similarity: number;
  /** True when the edit distance was too large to compute and the result is a plain replace. */
  approximate: boolean;
}

const MAX_EDIT_DISTANCE = 1500;

/**
 * Splits by script runs so Japanese diffs land on word-like boundaries
 * (kanji / hiragana / katakana / latin runs), with punctuation as single tokens.
 */
export function tokenize(text: string): string[] {
  return (
    text.match(
      /[一-鿿㐀-䶿々〆ヶ]+|[ぁ-ゟ]+|[゠-ヿー]+|[A-Za-z0-9０-９Ａ-Ｚａ-ｚ_]+|\s+|[\s\S]/gu,
    ) ?? []
  );
}

/** Myers O(ND) shortest edit script; returns null when D exceeds the cap. */
function myers(a: string[], b: string[]): DiffOp[] | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, MAX_EDIT_DISTANCE);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, offset);
    }
  }
  return null;
}

function backtrack(trace: Int32Array[], a: string[], b: string[], offset: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', text: a[x - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ type: 'insert', text: b[y - 1] });
      else ops.push({ type: 'delete', text: a[x - 1] });
    }
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
}

function merge(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  for (const op of ops) {
    if (!op.text) continue;
    const last = out[out.length - 1];
    if (last && last.type === op.type) last.text += op.text;
    else out.push({ ...op });
  }
  return out;
}

/** Absorbs single-character islands of equality between edits, and orders deletions before insertions. */
function cleanup(ops: DiffOp[]): DiffOp[] {
  const groups: DiffOp[] = [];
  let del = '';
  let ins = '';
  const flush = () => {
    if (del) groups.push({ type: 'delete', text: del });
    if (ins) groups.push({ type: 'insert', text: ins });
    del = '';
    ins = '';
  };
  ops.forEach((op, i) => {
    const between = i > 0 && i < ops.length - 1 && ops[i - 1].type !== 'equal' && ops[i + 1].type !== 'equal';
    if (op.type === 'equal' && !(between && [...op.text].length <= 1)) {
      flush();
      groups.push(op);
    } else if (op.type === 'equal') {
      del += op.text;
      ins += op.text;
    } else if (op.type === 'delete') {
      del += op.text;
    } else {
      ins += op.text;
    }
  });
  flush();
  return merge(groups);
}

const REFINE_MAX_CHARS = 400;

/** Re-diffs each replaced span character by character, so 「致します→いたします」 marks only 「致→いた」. */
function refine(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    const del = ops[i];
    const ins = ops[i + 1];
    if (
      del.type === 'delete' &&
      ins?.type === 'insert' &&
      del.text.length <= REFINE_MAX_CHARS &&
      ins.text.length <= REFINE_MAX_CHARS
    ) {
      out.push(...(myers([...del.text], [...ins.text]) ?? [del, ins]));
      i++;
    } else {
      out.push({ ...del });
    }
  }
  return out;
}


export function diffText(original: string, revised: string, options: { trimEdgeDeletions?: boolean } = {}): DiffResult {
  const a = tokenize(original);
  const b = tokenize(revised);
  const raw = myers(a, b);
  let ops = raw
    ? cleanup(merge(refine(cleanup(merge(raw)))))
    : merge([
        { type: 'delete', text: original },
        { type: 'insert', text: revised },
      ]);

  if (options.trimEdgeDeletions) {
    while (ops[0]?.type === 'delete') ops = ops.slice(1);
    while (ops[ops.length - 1]?.type === 'delete') ops = ops.slice(0, -1);
  }

  const equalChars = ops.filter((op) => op.type === 'equal').reduce((sum, op) => sum + op.text.length, 0);
  const longest = Math.max(1, revised.length, ops.filter((op) => op.type !== 'insert').reduce((s, op) => s + op.text.length, 0));
  return { ops, similarity: equalChars / longest, approximate: raw === null };
}

export function changeCount(ops: DiffOp[]): number {
  let count = 0;
  ops.forEach((op, i) => {
    if (op.type !== 'equal' && (i === 0 || ops[i - 1].type === 'equal')) count++;
  });
  return count;
}
