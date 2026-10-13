// MenuLeader: Eat's motif, the dotted line that joins a dish to its price on a printed
// menu (bible finders[eat].motif). A row of 2px dots on a 6px pitch, drawn with a CSS
// radial gradient, so it stretches to whatever space it is given.
//
//   variant 'plate'   three faint 120px leaders in the plate's right third, at 20%
//                     (Eat.dc.html L29-33). Absolute: the plate must be positioned.
//   variant 'inline'  the leader in the plate kicker, 'PLACES TO EAT ····· 40 NEAR YOU'
//                     (L47): a flex spacer (min 24px) in plateAccent.
//   variant 'card'    the leader in a card's name line, 'Sonoratown ····· 0.6 MI' (L107):
//                     a flex spacer (min 20px) in saffron, on white.
//   variant 'strip'   the two leaders either side of the icon on the no-photo strip, at
//                     60% (L93, L95): a flex spacer in plateAccent.
//
// Props: world (a WORLD row or key; Eat by default), variant, opacity (overrides the
// variant's), style, className. aria-hidden, no pointer events.
import React from 'react';
import { WORLD, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.eat);

/** The dotted leader as a CSS background, in one colour. */
export const leaderBackground = (color) => `radial-gradient(circle, ${color} 1px, transparent 1.3px) 0 50% / 6px 4px repeat-x`;

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', opacity?: number, style?: CSS, className?: string }} props
 */
export default function MenuLeader({ world, variant = 'inline', opacity, style, className }) {
  const w = worldFor(world);

  if (variant === 'plate') {
    const line = leaderBackground(w.plateAccent);
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{
          position: 'absolute',
          top: 86,
          right: -12,
          width: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          opacity: opacity ?? 0.2,
          pointerEvents: 'none',
          ...style,
        }}
      >
        <span style={{ display: 'block', height: 4, background: line }} />
        <span style={{ display: 'block', height: 4, marginLeft: 28, background: line }} />
        <span style={{ display: 'block', height: 4, marginLeft: 14, background: line }} />
      </span>
    );
  }

  // Saffron on a card (white ground); the plate accent on the plate and the strip.
  const color = variant === 'card' ? w.saffron || w.star : w.plateAccent;
  /** @type {CSS} */
  const spacer = {
    display: 'block',
    flex: 1,
    minWidth: variant === 'card' ? 20 : variant === 'strip' ? 0 : 24,
    height: 4,
    background: leaderBackground(color),
    pointerEvents: 'none',
  };
  const alpha = opacity ?? (variant === 'strip' ? 0.6 : null);
  if (alpha != null) spacer.opacity = alpha;
  return <span aria-hidden="true" className={className} style={{ ...spacer, ...style }} />;
}
