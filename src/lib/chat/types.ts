export type AttachmentKind = 'image' | 'audio' | 'video' | 'document';

export interface AttachmentMeta {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  sizeBytes?: number;
  thumb?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  segments?: number;
  frames?: number;
  wave?: number[];
  pages?: number;
  chars?: number;
  truncated?: boolean;
  scanned?: boolean;
  /** Extracted document body; kept so a proofreading diff can be rebuilt after reload. */
  text?: string;
}

export type Backend = 'gpu' | 'cpu';

export interface GenerationStats {
  decodeTokens: number;
  tokensPerSecond: number;
  timeToFirstTokenSec: number;
  totalMs: number;
  backend: Backend;
}

export type MessageStatus = 'streaming' | 'done' | 'cancelled' | 'error';

export interface UserTurn {
  id: string;
  role: 'user';
  text: string;
  attachments: AttachmentMeta[];
  createdAt: number;
}

export interface AssistantTurn {
  id: string;
  role: 'assistant';
  text: string;
  thought: string;
  thinkEnabled: boolean;
  /** Milliseconds spent in the thought channel before the answer started. */
  thoughtMs?: number;
  status: MessageStatus;
  error?: string;
  stats?: GenerationStats;
  createdAt: number;
}

export type ChatMessage = UserTurn | AssistantTurn;

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  messageCount: number;
}
