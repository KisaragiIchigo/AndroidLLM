import { RotateCcw } from 'lucide-react';
import { PERSONALITY_PRESETS, THINKING_PRESETS, type PersonaPreset } from '../../lib/persona/presets';
import { DEFAULT_PERSONA, PERSONA_NAME_MAX, PERSONA_TEXT_MAX, type Persona } from '../../lib/settings';

interface PersonaSectionProps {
  persona: Persona;
  onChange: (persona: Persona) => void;
}

const FIELD =
  'w-full rounded-xl border border-paper/[0.07] bg-black/40 px-3 text-[15px] text-paper shadow-inset outline-none transition-colors placeholder:text-paper-muted focus:border-lamp/50';

function Presets({ presets, current, onPick }: { presets: PersonaPreset[]; current: string; onPick: (text: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {presets.map((preset) => {
        const active = current.trim() === preset.text;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPick(active ? '' : preset.text)}
            aria-pressed={active}
            className={`min-h-[34px] rounded-lg border px-2.5 text-[13px] tracking-wide active:scale-[0.97] ${
              active ? 'border-lamp/40 bg-lamp/10 text-lamp-hi shadow-lamp' : 'border-paper/[0.07] bg-ink-surface text-paper-muted'
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-paper-muted">
      {value.length}/{PERSONA_TEXT_MAX}
    </span>
  );
}

export function PersonaSection({ persona, onChange }: PersonaSectionProps) {
  const isDefault =
    persona.name === DEFAULT_PERSONA.name && persona.personality === DEFAULT_PERSONA.personality && persona.thinking === DEFAULT_PERSONA.thinking;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label-jp">アシスタント</h3>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_PERSONA)}
            className="-my-1 flex h-8 items-center gap-1.5 px-1 text-[13px] text-paper-muted active:scale-[0.97]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            既定に戻す
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-paper/[0.07] bg-ink-raised/60 p-3.5">
        <label className="block">
          <span className="text-[15px]">名前</span>
          <input
            value={persona.name}
            maxLength={PERSONA_NAME_MAX}
            onChange={(e) => onChange({ ...persona, name: e.target.value })}
            placeholder={DEFAULT_PERSONA.name}
            autoComplete="off"
            className={`${FIELD} mt-1.5 h-11`}
          />
          <span className="mt-1.5 block text-sm leading-relaxed text-paper-muted">
            有名なキャラクターと同じ名前にすると、そのキャラクターの口調を真似ることがあります。
          </span>
        </label>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="persona-personality" className="text-[15px]">
              性格・話し方
            </label>
            <Counter value={persona.personality} />
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-paper-muted">空欄の場合は、モデル本来の自然な話し方になります。</p>
          <textarea
            id="persona-personality"
            value={persona.personality}
            maxLength={PERSONA_TEXT_MAX}
            onChange={(e) => onChange({ ...persona, personality: e.target.value })}
            rows={3}
            placeholder="例: 落ち着いた丁寧語で、相手を急かさずに話します。"
            className={`${FIELD} mt-2 resize-none py-2.5 leading-relaxed`}
          />
          <Presets presets={PERSONALITY_PRESETS} current={persona.personality} onPick={(text) => onChange({ ...persona, personality: text })} />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="persona-thinking" className="text-[15px]">
              思考パターン
            </label>
            <Counter value={persona.thinking} />
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-paper-muted">回答を組み立てるときの考え方です。Think モードの思考にも反映されます。</p>
          <textarea
            id="persona-thinking"
            value={persona.thinking}
            maxLength={PERSONA_TEXT_MAX}
            onChange={(e) => onChange({ ...persona, thinking: e.target.value })}
            rows={3}
            placeholder="例: まず結論を決め、根拠を2〜3点に絞ってから答えます。"
            className={`${FIELD} mt-2 resize-none py-2.5 leading-relaxed`}
          />
          <Presets presets={THINKING_PRESETS} current={persona.thinking} onPick={(text) => onChange({ ...persona, thinking: text })} />
        </div>

        <p className="text-sm leading-relaxed text-paper-muted">変更は次に送信するメッセージから反映されます。</p>
      </div>
    </section>
  );
}
