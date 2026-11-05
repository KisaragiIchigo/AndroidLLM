import { useEffect, useRef } from 'react';

type Handler = () => void;

const stack: { id: number; handler: { current: Handler } }[] = [];
let sequence = 0;

/** Runs the handler of the most recently opened layer. Returns false when nothing is open. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.handler.current();
  return true;
}

/** Registers a dismissible layer (sheet, dialog, menu) so the Android back gesture closes it first. */
export function useBackHandler(active: boolean, onBack: Handler): void {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    if (!active) return;
    const id = ++sequence;
    stack.push({ id, handler });
    return () => {
      const index = stack.findIndex((entry) => entry.id === id);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [active]);
}
