// AccessionTag: Culture's motif, the small brass-bordered tag a catalogue hangs on each
// object (bible finders[culture].motif).
//
//   variant 'inline'  the 'No. 01' tag that opens every guide section, numbered in reading
//                     order: mono 10.5px in accentText inside a 1px brass border, radius 4
//                     (Culture.dc.html L67). It grows with the text size (min-height 22).
//   variant 'plate'   the outline of a hanging tag with its eyelet and three lines, 96 x 56,
//                     at 32% in the plate accent, tilted -8deg in the plate's right third
//                     (L27). Absolute: the plate must be positioned. Takes no number.
//
// Props: n (a number, printed two-digit: 1 -> 'No. 01'; a string is printed as given),
// world (a WORLD row or key; Culture by default), variant, decorative (inline only; true
// hides the tag from screen readers because the section title follows it; false lets
// 'No. 01' be read), style, className. No pointer events.
import React from 'react';
import { WORLD, worldOf, fs } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.culture);

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/** 1 -> 'No. 01', 12 -> 'No. 12'; a string is kept as given ('No. 3a' stays '3a'). */
export function accessionLabel(n) {
  if (typeof n === 'number' && Number.isFinite(n)) return `No. ${String(Math.trunc(n)).padStart(2, '0')}`;
  if (typeof n === 'string' && n.trim()) return `No. ${n.trim()}`;
  return 'No.';
}

/**
 * @param {{ n?: number|string, world?: any, variant?: 'plate'|'strip'|'inline'|'card', decorative?: boolean, style?: CSS, className?: string }} props
 */
export default function AccessionTag({ n, world, variant = 'inline', decorative = true, style, className }) {
  const w = worldFor(world);

  if (variant === 'plate') {
    const c = w.plateAccent;
    return (
      <svg
        aria-hidden="true"
        className={className}
        width="96"
        height="56"
        viewBox="0 0 96 56"
        fill="none"
        style={{
          position: 'absolute',
          top: 66,
          right: 18,
          opacity: 0.32,
          transform: 'rotate(-8deg)',
          pointerEvents: 'none',
          ...style,
        }}
      >
        <path d="M14 1H91a4 4 0 0 1 4 4V51a4 4 0 0 1-4 4H14L1 28Z" stroke={c} strokeWidth="1" />
        <circle cx="15" cy="28" r="3.5" stroke={c} strokeWidth="1" />
        <path d="M30 20H82M30 28H74M30 36H64" stroke={c} strokeWidth="1" />
      </svg>
    );
  }

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        padding: '0 7px',
        flexShrink: 0,
        boxSizing: 'border-box',
        border: `1px solid ${w.brassLine || w.plateAccent}`,
        borderRadius: 4,
        fontFamily: MONO,
        fontSize: fs(10.5),
        fontWeight: 500,
        letterSpacing: '0.06em',
        lineHeight: 1.2,
        color: w.accentText || w.ink,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {accessionLabel(n)}
    </span>
  );
}
