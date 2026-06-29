// Dismiss stack — "close the thing in front."
//
// A LIFO registry of close handlers. Every open overlay (photo viewer, form,
// picker, splash) registers its onClose here WHILE it is open, via the
// useDismissable hook. The global swipe-down gesture (see src/lib/swipeDismiss.js,
// wired in Layout) pops + runs the topmost handler so a swipe-down always
// dismisses whatever is visually on top. When the stack is empty, the gesture
// falls through to page back-navigation.
//
// Why a stack (not per-component touch handlers): "anything in front" means the
// FRONTMOST layer must win, even when several overlays are mounted. LIFO order
// gives us that for free, and components opt in with one line.
import { useEffect, useRef } from 'react';

const _stack = [];

// Register `fn` as the current frontmost dismiss handler. Returns an unregister
// function (call on close/unmount).
export function pushDismiss(fn) {
  _stack.push(fn);
  return () => {
    const i = _stack.lastIndexOf(fn);
    if (i !== -1) _stack.splice(i, 1);
  };
}

// Run + remove the topmost dismiss handler. Returns true if one ran (caller
// then knows an overlay was closed and should NOT also navigate the page back).
export function runTopDismiss() {
  const fn = _stack[_stack.length - 1];
  if (!fn) return false;
  _stack.pop(); // remove first, so a re-render inside fn can't double-run it
  try { fn(); } catch { /* ignore */ }
  return true;
}

export function hasDismissable() {
  return _stack.length > 0;
}

// Register `onClose` on the dismiss stack while `isOpen` is true. `onClose` does
// NOT need to be stable — the latest one is always called via a ref, and the
// registered handle only changes when `isOpen` flips, so the stack order is
// stable for the lifetime of an open overlay.
export function useDismissable(isOpen, onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = () => { try { ref.current?.(); } catch { /* ignore */ } };
    return pushDismiss(handler);
  }, [isOpen]);
}
