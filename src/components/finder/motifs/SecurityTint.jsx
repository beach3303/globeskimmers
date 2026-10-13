// SecurityTint: the ATMs motif, the faint crossed pattern on a carbon copy (bible
// finders[atm].motif, Carbon Copy). 1px lines on a 5px pitch at 45 and -45 degrees in
// the world's tint (carbon).
//
//   variant 'plate'  the crossed lines on a layer at 10%, masked left to right (clear to
//                    38%, full by 84%) so the title sits on clean or barely tinted
//                    cornflower (ATMs.dc.html L29). The bible measured carbon type at
//                    4.58:1 over the full-strength tint at 10%; at 12% it falls under 4.5,
//                    so keep it at 10%.
//   variant 'strip'  the same lines at 8%, unmasked, across the mist no-photo strip (L93).
//                    'card' is the same.
// Both fill the nearest positioned box (absolute, inset 0).
//
// Props: world (a WORLD row or key; ATMs by default), variant, opacity (overrides the
// variant's), style, className. aria-hidden, no pointer events.
import React from 'react';
import { NEUTRAL, WORLD, worldOf, rgba } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.atm);

const PLATE_MASK = `linear-gradient(90deg, transparent 0%, transparent 38%, ${NEUTRAL.black} 84%)`;

const hatch = (color) =>
  `repeating-linear-gradient(45deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 5px), ` +
  `repeating-linear-gradient(-45deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 5px)`;

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', opacity?: number, style?: CSS, className?: string }} props
 */
export default function SecurityTint({ world, variant = 'plate', opacity, style, className }) {
  const w = worldFor(world);
  const tint = w.tint || w.ink;
  /** @type {CSS} */
  const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' };
  if (variant === 'plate') {
    // Solid lines on a 10% layer: crossings stay at 10%, as on the board.
    Object.assign(fill, {
      opacity: opacity ?? 0.1,
      backgroundImage: hatch(tint),
      WebkitMaskImage: PLATE_MASK,
      maskImage: PLATE_MASK,
    });
  } else {
    // 8% lines (crossings darken a little), as on the board's strip.
    fill.backgroundImage = hatch(rgba(tint, opacity ?? 0.08));
  }
  return <span aria-hidden="true" className={className} style={{ ...fill, ...style }} />;
}
