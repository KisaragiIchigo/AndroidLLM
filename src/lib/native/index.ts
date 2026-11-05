export { Llm } from './llm';
export type { HistoryTurn, ImportProgress, LlmEvent, LoadEngineResult, ModelStatus } from './llm';
export { Media } from './media';
export type { PickKind, RecordLevel } from './media';
export { AUTH_CANCELLED, KEY_INVALIDATED, Vault } from './vault';
export type { KeyStorage, VaultStatus } from './vault';

export const ATTACHMENT_EXPIRED = 'ATTACHMENT_EXPIRED';

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message;
  return '予期しないエラーが発生しました。';
}
