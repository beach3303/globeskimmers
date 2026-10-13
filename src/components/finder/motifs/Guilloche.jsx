// Guilloche: Money's motif, a banknote's engraved border (bible finders[money].motif).
// Three interlaced sine waves, 0.75px: two in the world ink at 30% and one in the plate
// accent (rose) at 35%, phase-shifted 120 degrees (Money.dc.html L29, L56).
//
//   variant 'plate'  a 14px band along the plate's bottom edge, 2px up (L29). Absolute:
//                    the plate must be positioned.
//   variant 'card'   the converter's 28px band (L55-57): an in-flow block on the plate
//                    colour, at the top of the converter card.
// The waves run the full width of the box at any width.
//
// Props: world (a WORLD row or key; Money by default), variant, style, className.
// aria-hidden, no pointer events.
import React from 'react';
import { WORLD, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.money);

// One wave: a 32px period of quadratic half-waves. mid: the centre line; amp: the
// height of a crest above it. Long enough for the widest content column; the SVG clips it.
const WAVE_LENGTH = 2400;
function wavePath(mid, amp) {
  let d = `M0 ${mid} Q8 ${mid - 2 * amp} 16 ${mid}`;
  for (let x = 32; x <= WAVE_LENGTH; x += 16) d += ` T${x} ${mid}`;
  return d;
}
const BANDS = {
  plate: { height: 14, d: wavePath(7, 4) }, // L29: M0 7 Q8 -1 16 7 T32 7 ...
  card: { height: 28, d: wavePath(14, 8) }, // L56: M0 14 Q8 -2 16 14 T32 14 ...
};

function Waves({ band, w }) {
  return (
    <>
      <path d={band.d} stroke={w.ink} strokeOpacity="0.3" strokeWidth="0.75" />
      <path d={band.d} transform="translate(-10.67 0)" stroke={w.ink} strokeOpacity="0.3" strokeWidth="0.75" />
      <path d={band.d} transform="translate(-21.33 0)" stroke={w.plateAccent} strokeOpacity="0.35" strokeWidth="0.75" />
    </>
  );
}

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', style?: CSS, className?: string }} props
 */
export default function Guilloche({ world, variant = 'plate', style, className }) {
  const w = worldFor(world);

  if (variant === 'plate') {
    const band = BANDS.plate;
    return (
      <svg
        aria-hidden="true"
        className={className}
        width="100%"
        height={band.height}
        fill="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 2, display: 'block', pointerEvents: 'none', ...style }}
      >
        <Waves band={band} w={w} />
      </svg>
    );
  }

  const band = BANDS.card;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'block', height: band.height, background: w.plate, overflow: 'hidden', pointerEvents: 'none', ...style }}
    >
      <svg width="100%" height={band.height} fill="none" style={{ display: 'block' }}>
        <Waves band={band} w={w} />
      </svg>
    </span>
  );
}
