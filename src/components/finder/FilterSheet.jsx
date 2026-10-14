// FilterSheet — the shared finder filter bottom sheet (Passport Standard).
//
// Mechanics mirror AllServicesSheet exactly: AnimatePresence spring slide-up,
// backdrop at z-[9995] + sheet at z-[9996] (BELOW the 9997+ location sheets so
// a location prompt can still cover this), rounded-t-[24px] surface, sticky serif
// header with a 44px close, home-indicator safe-area clearance, and useDismissable so
// the global swipe-down closes whatever is frontmost. Opening moves focus into the
// sheet; closing returns it to where it was.
//
// Pages put their filter groups inside as children; an optional Clear action
// sits in the sticky header when `onClear` is provided.
//
// Props:
//   open       — sheet visibility.
//   onClose    — close handler (backdrop tap, X, global swipe-down).
//   title      — sticky-header serif title ("Filters").
//   children   — the page's filter groups.
//   onClear    — optional; renders a quiet clear button in the header.
//   clearLabel — clear button label; default 'Clear all'.
//   world      — optional WORLD row or key: the sheet is printed on the world's paper
//                with its line (without it: ivory, as before).
//
// Also exported, for the groups inside:
//   <FilterGroupLabel>  a group's mono label, 10.5px .14em #736657 (an h4).
//   <FilterToggleRow world label description checked onChange icon disabled>  one on/off
//        row: a full-width role="switch" with the label (15/600), an optional description
//        (12.5 #736657) and a 44x26 switch in the world ink when on. At least 52px tall.
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDismissable } from '@/lib/dismissStack';
import { IVORY, NEUTRAL, fs, rgba, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const rowOf = (world) => (world && typeof world === 'object' ? world : worldOf(world));

/**
 * @param {{
 *   open?: boolean, onClose?: () => void, title?: string, children?: import('react').ReactNode,
 *   onClear?: () => void, clearLabel?: string, world?: any,
 * }} props
 */
export default function FilterSheet({
  open = false,
  onClose = undefined,
  title = 'Filters',
  children = undefined,
  onClear = undefined,
  clearLabel = 'Clear all',
  world = undefined,
}) {
  useDismissable(open, onClose);
  const w = rowOf(world);
  const surface = w ? w.paper : IVORY;
  const line = w ? w.line : NEUTRAL.lobbyLine;
  const sheetRef = useRef(null);

  // Focus moves into the sheet when it opens and back to the opener when it closes.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (opener && opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9995]"
          />
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[24px] shadow-2xl max-w-[600px] mx-auto max-h-[85vh] overflow-y-auto"
            style={{ background: surface, outline: 'none' }}
          >
            {/* Sticky header */}
            <div className="sticky top-0 flex items-center justify-between z-[1]" style={{ background: surface, borderBottom: `1px solid ${line}`, padding: '8px 12px 8px 20px', minHeight: 60, boxSizing: 'border-box' }}>
              <h3 className="font-serif tracking-tight" style={{ margin: 0, fontSize: fs(20), lineHeight: 1.2, fontWeight: 400, color: NEUTRAL.ink }}>{title}</h3>
              <div className="flex items-center gap-1">
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="font-mono uppercase font-semibold"
                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 8px', background: 'transparent', border: 'none', fontSize: fs(10.5), letterSpacing: '0.08em', color: NEUTRAL.ink3, cursor: 'pointer' }}
                  >
                    {clearLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0, borderRadius: 999, background: 'transparent', border: 0, cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 999, background: w ? w.wash : NEUTRAL.ivory2 }}>
                    <X size={18} color={NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" />
                  </span>
                </button>
              </div>
            </div>

            {/* Page-owned filter groups */}
            <div className="px-5 pt-3 pb-4">{children}</div>

            {/* Home-indicator clearance */}
            <div aria-hidden style={{ height: 'calc(8px + env(safe-area-inset-bottom))' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * @param {{ children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function FilterGroupLabel({ children = undefined, className = undefined, style = undefined }) {
  return (
    <h4
      className={className}
      style={{
        margin: '16px 0 8px',
        fontFamily: MONO,
        fontSize: fs(10.5),
        lineHeight: 1.34,
        fontWeight: 500,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: NEUTRAL.ink3,
        ...style,
      }}
    >
      {children}
    </h4>
  );
}

/**
 * @param {{
 *   world?: any, label?: import('react').ReactNode, description?: import('react').ReactNode,
 *   checked?: boolean, onChange?: (next: boolean) => void, icon?: any, disabled?: boolean,
 *   className?: string, style?: CSS,
 * }} props
 */
export function FilterToggleRow({
  world = undefined,
  label = undefined,
  description = undefined,
  checked = false,
  onChange = undefined,
  icon: Icon = undefined,
  disabled = false,
  className = undefined,
  style = undefined,
}) {
  const w = rowOf(world);
  const on = !!checked;
  const ink = w ? w.ink : NEUTRAL.tealInk;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : () => onChange && onChange(!on)}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 52,
        boxSizing: 'border-box',
        padding: '10px 0',
        background: 'transparent',
        border: 0,
        borderBottom: `1px solid ${w ? w.line : NEUTRAL.rule}`,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {Icon ? <Icon size={18} color={w ? w.iconInk : NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: fs(15), lineHeight: 1.3, fontWeight: 600, color: NEUTRAL.ink }}>{label}</span>
        {description ? <span style={{ display: 'block', marginTop: 2, fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          flexShrink: 0,
          width: 44,
          height: 26,
          borderRadius: 999,
          background: on ? ink : rgba(NEUTRAL.ink, 0.45),
          transition: 'background .2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 20 : 2,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: NEUTRAL.white,
            boxShadow: `0 1px 3px ${rgba(NEUTRAL.ink, 0.25)}`,
            transition: 'left .2s',
          }}
        />
      </span>
    </button>
  );
}
