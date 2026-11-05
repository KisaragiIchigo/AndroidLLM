import type { HistoryTurn } from '../native/llm';
import { formatDuration } from '../format';
import { newId } from './ids';
import type { AttachmentMeta, ChatMessage, Conversation, ConversationSummary, UserTurn } from './types';

const TITLE_LENGTH = 28;
const PREVIEW_LENGTH = 60;

export function emptyConversation(now: number): Conversation {
  return { id: newId(), title: '新しい会話', createdAt: now, updatedAt: now, messages: [] };
}

export function attachmentLabel(attachment: AttachmentMeta): string {
  switch (attachment.kind) {
    case 'image':
      return '画像';
    case 'audio':
      return `音声 ${formatDuration(attachment.durationMs ?? 0)}`;
    case 'video':
      return `動画 ${formatDuration(attachment.durationMs ?? 0)}`;
    case 'document':
      return `文書「${attachment.name}」`;
  }
}

function oneLine(text: string, length: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

export function deriveTitle(turn: UserTurn): string {
  if (turn.text.trim()) return oneLine(turn.text, TITLE_LENGTH);
  const first = turn.attachments[0];
  return first ? oneLine(attachmentLabel(first), TITLE_LENGTH) : '新しい会話';
}

function plainPreview(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/[#*_>`]/g, '')
    .trim();
}

export function summarize(conversation: Conversation): ConversationSummary {
  const last = [...conversation.messages].reverse().find((m) => m.text.trim());
  return {
    id: conversation.id,
    title: conversation.title,
    preview: last ? oneLine(plainPreview(last.text), PREVIEW_LENGTH) : '',
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
  };
}

function userTextForHistory(turn: UserTurn): string {
  const notes = turn.attachments.map((a) => `［${attachmentLabel(a)}を添付］`).join('');
  return [notes, turn.text].filter(Boolean).join('\n');
}

/**
 * Text-only history used to rebuild the model's context when a saved conversation is reopened.
 * Media cannot be replayed, so attachments become short notes. Oldest turns are dropped first.
 */
export function resumeHistory(messages: ChatMessage[], charBudget: number): HistoryTurn[] {
  const pairs: HistoryTurn[][] = [];
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    if (current.role !== 'user' || !next || next.role !== 'assistant') continue;
    if (next.status === 'error' || !next.text.trim()) continue;
    pairs.push([
      { role: 'user', text: userTextForHistory(current) },
      { role: 'model', text: next.text },
    ]);
  }
  const kept: HistoryTurn[][] = [];
  let used = 0;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const size = pairs[i][0].text.length + pairs[i][1].text.length;
    if (used + size > charBudget) break;
    kept.unshift(pairs[i]);
    used += size;
  }
  return kept.flat();
}

/** The text a proofreading answer should be diffed against: an attached document, or the user's own words. */
export function proofreadSource(turn: UserTurn | undefined): { text: string; fromDocument: boolean } | null {
  if (!turn) return null;
  const doc = turn.attachments.find((a) => a.kind === 'document' && a.text);
  if (doc?.text) return { text: doc.text, fromDocument: true };
  if (turn.text.trim()) return { text: turn.text, fromDocument: false };
  return null;
}
