import * as Dialog from '@radix-ui/react-dialog';
import { animate, AnimatePresence, m, useMotionValue } from 'framer-motion';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { useBackHandler } from '../../../lib/back/backStack';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}

const DISMISS_DISTANCE_PX = 96;
const DISMISS_VELOCITY = 0.6;
const TAP_SLOP_PX = 6;

/** Pull-down-to-dismiss on the grab zone, implemented by hand because LazyMotion(domAnimation) has no drag. */
function useSwipeDismiss(open: boolean, onDismiss: () => void) {
  const offset = useMotionValue(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (open) offset.set(0);
  }, [open, offset]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { y: e.clientY, t: performance.now() };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > TAP_SLOP_PX) moved.current = true;
    offset.set(Math.max(0, dy));
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const dy = e.clientY - origin.y;
    const velocity = dy / Math.max(1, performance.now() - origin.t);
    if (dy > DISMISS_DISTANCE_PX || (dy > TAP_SLOP_PX * 4 && velocity > DISMISS_VELOCITY)) onDismiss();
    else animate(offset, 0, { type: 'spring', stiffness: 420, damping: 38 });
  };

  return {
    offset,
    wasDragged: () => moved.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  };
}

export function Sheet({ open, onOpenChange, title, children, footer, tall }: SheetProps) {
  const close = () => onOpenChange(false);
  const swipe = useSwipeDismiss(open, close);
  useBackHandler(open, close);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-modal bg-ink-deep/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
              <m.div
                className={`fixed inset-x-0 bottom-0 z-modal flex flex-col outline-none ${tall ? 'h-[88%]' : 'max-h-[88%]'}`}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              >
                <m.div
                  style={{ y: swipe.offset }}
                  className="flex min-h-0 flex-1 flex-col rounded-t-[26px] border-t border-paper/[0.07] bg-ink-surface shadow-sheet"
                >
                  <div {...swipe.handlers} className="shrink-0 touch-none select-none">
                    <button
                      type="button"
                      aria-label="閉じる"
                      onClick={() => !swipe.wasDragged() && close()}
                      className="mx-auto flex h-7 w-20 items-center justify-center"
                    >
                      <span className="h-1 w-10 rounded-full bg-paper/[0.18]" />
                    </button>
                    <Dialog.Title className="label-jp px-5 pb-3">{title}</Dialog.Title>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
                  {footer && <div className="shrink-0 border-t border-paper/[0.04] px-5 pb-safe pt-3">{footer}</div>}
                  {!footer && <div className="pb-safe" />}
                </m.div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
