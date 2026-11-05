import { DEFAULT_PERSONA, displayName, type Persona } from '../settings';

/** Identifies the persona-dependent part of the prompt; the native context is rebuilt when it changes. */
export function personaKey(persona: Persona): string {
  return JSON.stringify([displayName(persona), persona.personality.trim(), persona.thinking.trim()]);
}

/**
 * Empty unless the user customised the persona. Gemma 4 E2B answers best with no system prompt
 * (Google AI Edge Gallery sends none), and a 2B model latches onto any extra fact it is given.
 * The default name is never sent: "Hisoka" makes the model role-play the HUNTER×HUNTER magician.
 */
export function buildSystemPrompt(persona: Persona): string {
  const name = displayName(persona);
  const customName = name !== DEFAULT_PERSONA.name;
  const personality = persona.personality.trim();
  const thinking = persona.thinking.trim();
  if (!customName && !personality && !thinking) return '';

  return [
    ...(customName ? [`あなたの名前は「${name}」です。`] : []),
    ...(personality ? [`性格と話し方: ${personality}`] : []),
    ...(thinking ? [`考え方: ${thinking}`] : []),
  ].join('\n');
}
