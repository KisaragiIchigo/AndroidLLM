import type { Backend } from './chat/types';

export const CONTEXT_OPTIONS = [4096, 8192, 16384, 32768] as const;
export type ContextSize = (typeof CONTEXT_OPTIONS)[number];

export const THINK_BUDGET_MIN = 256;
export const THINK_BUDGET_MAX = 4096;
export const THINK_BUDGET_UNLIMITED = -1;

export const PERSONA_NAME_MAX = 24;
export const PERSONA_TEXT_MAX = 400;

export interface Persona {
  name: string;
  /** Free-form personality and tone. Empty means the built-in default. */
  personality: string;
  /** Free-form reasoning style. Empty means no extra instruction. */
  thinking: string;
}

export interface Settings {
  backend: Backend;
  maxTokens: ContextSize;
  think: boolean;
  thinkBudget: number;
  autoThinkBudget: boolean;
  ephemeral: boolean;
  persona: Persona;
}

export const DEFAULT_PERSONA: Persona = { name: 'Hisoka', personality: '', thinking: '' };

export const DEFAULT_SETTINGS: Settings = {
  backend: 'gpu',
  maxTokens: 8192,
  think: false,
  thinkBudget: 1024,
  autoThinkBudget: true,
  ephemeral: false,
  persona: DEFAULT_PERSONA,
};

const KEY = 'hisoka.settings.v1';

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const persona = (parsed.persona ?? {}) as Partial<Persona>;
    return {
      backend: parsed.backend === 'cpu' ? 'cpu' : 'gpu',
      maxTokens: CONTEXT_OPTIONS.includes(parsed.maxTokens as ContextSize) ? (parsed.maxTokens as ContextSize) : DEFAULT_SETTINGS.maxTokens,
      think: parsed.think === true,
      thinkBudget: typeof parsed.thinkBudget === 'number' ? parsed.thinkBudget : DEFAULT_SETTINGS.thinkBudget,
      autoThinkBudget: parsed.autoThinkBudget !== false,
      ephemeral: parsed.ephemeral === true,
      persona: {
        name: text(persona.name, PERSONA_NAME_MAX, DEFAULT_PERSONA.name),
        personality: text(persona.personality, PERSONA_TEXT_MAX, ''),
        thinking: text(persona.thinking, PERSONA_TEXT_MAX, ''),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; settings then simply reset on the next launch.
  }
}

export function displayName(persona: Persona): string {
  return persona.name.trim() || DEFAULT_PERSONA.name;
}

/** Rough share of the context window a single attached document may take (Japanese ≈ 1 char per token). */
export function documentCharLimit(maxTokens: number): number {
  return Math.floor(maxTokens * 0.55);
}

/** Character budget for replaying saved history into a fresh context. */
export function historyCharBudget(maxTokens: number): number {
  return Math.floor(maxTokens * 0.45);
}
