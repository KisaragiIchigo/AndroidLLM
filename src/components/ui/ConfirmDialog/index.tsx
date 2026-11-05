import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AnimatePresence, m } from 'framer-motion';
import { useBackHandler } from '../../../lib/back/backStack';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive }: ConfirmDialogProps) {
  useBackHandler(open, () => onOpenChange(false));
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-modal bg-ink-deep/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild forceMount>
              <m.div
                className="fixed left-1/2 top-1/2 z-modal w-[min(340px,calc(100%-32px))] rounded-2xl border border-paper/[0.07] bg-ink-raised p-5 outline-none"
                initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
                transition={{ duration: 0.16 }}
              >
                <AlertDialog.Title className="text-base font-semibold tracking-wide">{title}</AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-paper-muted">{description}</AlertDialog.Description>
                <div className="mt-5 flex gap-2">
                  <AlertDialog.Cancel className="h-11 flex-1 rounded-xl border border-paper/[0.07] bg-ink-surface text-sm font-medium tracking-wider active:scale-[0.97]">
                    キャンセル
                  </AlertDialog.Cancel>
                  <AlertDialog.Action
                    onClick={onConfirm}
                    className={`h-11 flex-1 rounded-xl text-sm font-medium tracking-wider active:scale-[0.97] ${
                      destructive
                        ? 'border border-ember/25 bg-ember/10 text-ember-text'
                        : 'bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep text-lamp-ink shadow-lamp'
                    }`}
                  >
                    {confirmLabel}
                  </AlertDialog.Action>
                </div>
              </m.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
