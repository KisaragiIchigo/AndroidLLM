import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface NoticeProps {
  tone: 'danger' | 'warning' | 'sealed';
  children: ReactNode;
  onDismiss?: () => void;
}

const TONES = {
  danger: 'border-ember/25 bg-ember/10 text-ember-text',
  warning: 'border-lamp/25 bg-lamp/10 text-lamp-hi',
  sealed: 'border-sealed/20 bg-sealed/[0.06] text-sealed-text',
} as const;

export function Notice({ tone, children, onDismiss }: NoticeProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${TONES[tone]}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" aria-label="閉じる" onClick={onDismiss} className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
