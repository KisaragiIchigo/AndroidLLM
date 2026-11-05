import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { AttachmentMeta } from '../chat/types';

export type PickKind = 'image' | 'audio' | 'video' | 'document';

export interface RecordLevel {
  level: number;
  elapsedMs: number;
}

interface HisokaMediaPlugin {
  pick(options: { kind: PickKind; maxChars: number }): Promise<{ attachments: AttachmentMeta[] }>;
  capturePhoto(): Promise<{ attachments: AttachmentMeta[] }>;
  startRecording(): Promise<{ maxSeconds: number }>;
  stopRecording(): Promise<{ attachments: AttachmentMeta[] }>;
  cancelRecording(): Promise<void>;
  discard(options: { ids: string[] }): Promise<void>;
  addListener(event: 'recordLevel', listener: (event: RecordLevel) => void): Promise<PluginListenerHandle>;
}

export const Media = registerPlugin<HisokaMediaPlugin>('HisokaMedia');
