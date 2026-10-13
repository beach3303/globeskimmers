// LitWindow: Convenience's motif, one 3px line in the plate accent (lime), like a shop
// window lit all night (bible finders[convenience].motif). It runs along the bottom edge
// of the plate, and along the photo or strip edge of every store that is open 24 hours
// (Convenience.dc.html L42, L75). No glow, no neon, no flicker, no dots. The one motif
// drawn at full strength. Every variant is the same line; it fills the bottom edge of the
// nearest positioned box.
//
// Props: world (a WORLD row or key; Convenience by default), variant, style, className.
// aria-hidden, no pointer events. The plate always carries it. On a card the line is the
// claim, so render it only for a store whose seven weekday lines all read 'Open 24 hours'.
import React from 'react';
import { WORLD, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.convenience);

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', style?: CSS, className?: string }} props
 */
export default function LitWindow({ world, style, className }) {
  const w = worldFor(world);
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 3,
        background: w.plateAccent,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
