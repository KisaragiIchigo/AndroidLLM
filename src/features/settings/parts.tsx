import type { ReactNode } from 'react';

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="label-jp mb-2">{label}</h3>
      <div className="divide-y divide-paper/[0.04] rounded-2xl border border-paper/[0.07] bg-ink-raised/60">{children}</div>
    </section>
  );
}

export function Row({ title, description, control }: { title: string; description?: string; control?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
      <div className="min-w-[180px] flex-1">
        <p className="text-[15px]">{title}</p>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-paper-muted">{description}</p>}
      </div>
      {control}
    </div>
  );
}
