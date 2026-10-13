// Tile: Restrooms' motif, porcelain tile (bible finders[restroom].motif). A 14px square
// grid of 1px lines in the world ink, drawn with two repeating gradients. It should read
// as clean tile, never graph paper.
//
//   variant 'plate'  7% lines across the plate, masked so they fade out under the title
//                    and the type sits on clean lavender (Restrooms.dc.html L29).
//   variant 'strip'  10% lines, unmasked, across a card's no-photo strip (L112). 'card'
//                    is the same.
// Both fill the nearest positioned box (absolute, inset 0).
//
// Props: world (a WORLD row or key; Restrooms by default), variant, opacity (the line
// alpha, overriding the variant's), style, className. aria-hidden, no pointer events.
import React from 'react';
import { NEUTRAL, WORLD, worldOf, rgba } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.restroom);

const PLATE_MASK = `linear-gradient(100deg, transparent 0%, transparent 44%, ${NEUTRAL.black} 82%)`;

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', opacity?: number, style?: CSS, className?: string }} props
 */
export default function Tile({ world, variant = 'plate', opacity, style, className }) {
  const w = worldFor(world);
  const plate = variant === 'plate';
  const line = rgba(w.ink, opacity ?? (plate ? 0.07 : 0.1));
  const grid = (deg) => `repeating-linear-gradient(${deg}deg, ${line} 0px, ${line} 1px, transparent 1px, transparent 14px)`;
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
        backgroundImage: `${grid(0)}, ${grid(90)}`,
        ...(plate ? { WebkitMaskImage: PLATE_MASK, maskImage: PLATE_MASK } : null),
        ...style,
      }}
    />
  );
}
