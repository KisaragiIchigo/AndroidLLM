import { m } from 'framer-motion';
import { useId } from 'react';

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string | number>({ value, options, onChange, label, disabled }: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex rounded-[10px] border border-paper/[0.04] bg-black/40 p-0.5 shadow-inset ${disabled ? 'opacity-40' : ''}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative min-h-[32px] min-w-[46px] rounded-lg px-3 font-mono text-xs transition-colors ${
              active ? 'text-lamp-hi' : 'text-paper-muted'
            }`}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-paper/[0.07] bg-ink-raised"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
