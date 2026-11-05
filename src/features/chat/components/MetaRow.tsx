import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { History, MoreHorizontal, Settings2, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { useBackHandler } from '../../../lib/back/backStack';
import type { EngineState } from '../../boot/useEngine';

interface MetaRowProps {
  engine: EngineState;
  tokensPerSecond: number | null;
  onNewChat: () => void;
  onHistory: () => void;
  onSettings: () => void;
}

function engineLabel(engine: EngineState): { text: string; busy: boolean } {
  switch (engine.phase) {
    case 'ready':
      return { text: engine.backend.toUpperCase(), busy: false };
    case 'loading':
    case 'checking':
      return { text: 'モデル読み込み中…', busy: true };
    case 'error':
      return { text: '読み込み失敗', busy: false };
    case 'setup':
      return { text: 'モデル未設定', busy: false };
  }
}

const ITEM =
  'flex h-11 cursor-default items-center gap-3 rounded-lg px-3 text-sm tracking-wide outline-none data-[highlighted]:bg-paper/[0.05]';

export function MetaRow({ engine, tokensPerSecond, onNewChat, onHistory, onSettings }: MetaRowProps) {
  const label = engineLabel(engine);
  const [menuOpen, setMenuOpen] = useState(false);
  useBackHandler(menuOpen, () => setMenuOpen(false));
  return (
    <div className="flex items-center gap-2 px-1.5 pb-2 font-mono text-xs text-paper-muted">
      <span className="flex items-center gap-1.5 tracking-[0.08em] text-sealed">
        <i className="h-1.5 w-1.5 rounded-full bg-sealed shadow-[0_0_8px_rgba(143,191,138,0.6)]" />
        SEALED
      </span>
      <span>·</span>
      <span className={label.busy ? 'animate-breathe' : ''}>{label.text}</span>
      {tokensPerSecond !== null && (
        <>
          <span>·</span>
          <span>
            <em className="not-italic text-lamp-hi">{tokensPerSecond.toFixed(1)}</em> tok/s
          </span>
        </>
      )}
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="メニュー" className="-mr-1 ml-auto flex h-8 w-10 items-center justify-center rounded-lg">
            <MoreHorizontal className="h-4 w-4 text-paper-muted" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={6}
            className="z-floating min-w-[200px] rounded-xl border border-paper/[0.07] bg-ink-raised p-1 font-sans text-paper shadow-sheet"
          >
            <DropdownMenu.Item className={ITEM} onSelect={onNewChat}>
              <SquarePen className="h-4 w-4 text-paper-muted" />
              新しい会話
            </DropdownMenu.Item>
            <DropdownMenu.Item className={ITEM} onSelect={onHistory}>
              <History className="h-4 w-4 text-paper-muted" />
              履歴
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-paper/[0.06]" />
            <DropdownMenu.Item className={ITEM} onSelect={onSettings}>
              <Settings2 className="h-4 w-4 text-paper-muted" />
              設定
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
