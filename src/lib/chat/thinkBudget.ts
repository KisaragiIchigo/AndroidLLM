import { PROOFREAD_INTENT } from '../proofread/instruction';
import { THINK_BUDGET_UNLIMITED } from '../settings';
import type { AttachmentMeta } from './types';

const LIGHT_CAP = 512;
const SHORT_MESSAGE_CHARS = 40;

export type ThinkLoad = 'light' | 'full';

/** Proofreading is mostly local edits and short chit-chat needs little deliberation; both get a lighter cap. */
export function classifyThinkLoad(text: string, attachments: AttachmentMeta[]): ThinkLoad {
  if (PROOFREAD_INTENT.test(text)) return 'light';
  if (attachments.length === 0 && text.trim().length <= SHORT_MESSAGE_CHARS) return 'light';
  return 'full';
}

export function effectiveThinkBudget(requested: number, auto: boolean, text: string, attachments: AttachmentMeta[]): number {
  if (!auto || classifyThinkLoad(text, attachments) === 'full') return requested;
  return requested === THINK_BUDGET_UNLIMITED ? LIGHT_CAP : Math.min(requested, LIGHT_CAP);
}
