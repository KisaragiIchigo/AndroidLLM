import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Backend, GenerationStats } from '../chat/types';

export interface ModelStatus {
  present: boolean;
  loaded: boolean;
  backend: Backend | null;
  externalDir: string;
  fileName?: string;
  sizeBytes?: number;
  /** Present only in the bundled build: size of the model packed inside the APK. */
  bundledSizeBytes?: number;
}

export interface LoadEngineResult {
  backend: Backend;
  loadMs: number;
  gpuError: string | null;
}

export interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export type LlmEvent =
  | { requestId: string; type: 'delta'; text: string; thought: string }
  | { requestId: string; type: 'done'; stats?: GenerationStats }
  | { requestId: string; type: 'cancelled' }
  | { requestId: string; type: 'error'; message: string };

export interface ImportProgress {
  copied: number;
  total: number;
}

interface HisokaLlmPlugin {
  getModelStatus(): Promise<ModelStatus>;
  importModel(): Promise<{ imported: boolean; sizeBytes?: number }>;
  extractBundledModel(): Promise<{ imported: boolean; sizeBytes?: number }>;
  deleteModel(): Promise<void>;
  loadEngine(options: { backend: Backend; maxTokens: number }): Promise<LoadEngineResult>;
  unloadEngine(): Promise<void>;
  resetConversation(options: { systemPrompt: string; history: HistoryTurn[] }): Promise<void>;
  send(options: {
    requestId: string;
    text: string;
    attachmentIds: string[];
    think: boolean;
    thinkBudget: number;
  }): Promise<void>;
  cancel(): Promise<void>;
  addListener(event: 'llmEvent', listener: (event: LlmEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: 'importProgress', listener: (event: ImportProgress) => void): Promise<PluginListenerHandle>;
}

export const Llm = registerPlugin<HisokaLlmPlugin>('HisokaLlm');
