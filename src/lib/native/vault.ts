import { registerPlugin } from '@capacitor/core';
import type { Conversation, ConversationSummary } from '../chat/types';

export type KeyStorage = 'strongbox' | 'tee' | 'software';

export interface VaultStatus {
  /** Reading history requires biometric or screen-lock authentication. */
  historyLock: boolean;
  /** False when the device has no screen lock, which makes the history lock impossible. */
  lockAvailable: boolean;
  keyStorage: KeyStorage | null;
  /** Installed (non-preinstalled) accessibility services that can read the screen. */
  accessibilityServices: string[];
}

export const AUTH_CANCELLED = 'AUTH_CANCELLED';
export const KEY_INVALIDATED = 'KEY_INVALIDATED';

interface HisokaVaultPlugin {
  status(): Promise<VaultStatus>;
  /** Authenticates when the history lock is on, then lists summaries; keys stay open until closeHistory. */
  openHistory(): Promise<{ items: ConversationSummary[] }>;
  closeHistory(): Promise<void>;
  read(options: { id: string }): Promise<{ conversation: Conversation }>;
  save(options: { conversation: Conversation; summary: ConversationSummary }): Promise<void>;
  remove(options: { id: string }): Promise<void>;
  removeAll(): Promise<void>;
  setHistoryLock(options: { enabled: boolean }): Promise<{ historyLock: boolean; keyStorage: KeyStorage }>;
  getSecureScreen(): Promise<{ enabled: boolean }>;
  setSecureScreen(options: { enabled: boolean }): Promise<void>;
}

export const Vault = registerPlugin<HisokaVaultPlugin>('HisokaVault');
