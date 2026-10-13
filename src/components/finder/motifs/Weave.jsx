// Weave: the Phrases plate's texture, a fine cloth weave like a pocket phrasebook's cover
// (Phrases.dc.html L27). 1px lines on a 3px pitch both ways at 4% in the world ink.
// The Phrases motif proper is the ThumbIndex on each situation row; this is what the
// plate carries (WORLD.phrases.plateMotif).
//
//   variant 'plate'  masked left to right (clear to 30%, full by 72%) so the title sits
//                    on clean mustard.
//   variant 'strip'  unmasked. 'card' is the same.
// Both fill the nearest positioned box (absolute, inset 0).
//
// Props: world (a WORLD row or key; Phrases by default), variant, opacity (the line
// alpha, overriding 4%), style, className. aria-hidden, no pointer events.
import React from 'react';
import { NEUTRAL, WORLD, worldOf, rgba } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.phrases);

const PLATE_MASK = `linear-gradient(90deg, transparent 0%, transparent 30%, ${NEUTRAL.black} 72%)`;

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', opacity?: number, style?: CSS, className?: string }} props
 */
export default function Weave({ world, variant = 'plate', opacity, style, className }) {
  const w = worldFor(world);
  const line = rgba(w.ink, opacity ?? 0.04);
  const threads = (deg) => `repeating-linear-gradient(${deg}deg, ${line} 0 1px, transparent 1px 3px)`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        pointerEvents: 'none',
        backgroundImage: `${threads(0)}, ${threads(90)}`,
        ...(variant === 'plate' ? { WebkitMaskImage: PLATE_MASK, maskImage: PLATE_MASK } : null),
        ...style,
      }}
    />
  );
}
