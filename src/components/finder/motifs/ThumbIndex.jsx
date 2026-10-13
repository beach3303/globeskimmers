// ThumbIndex: Phrases' motif, the half-round tab cut into a dictionary's fore-edge (bible
// finders[phrases].motif). One on every situation row: mustard (the plate colour) with an
// ink icon for everyday situations, stamp red with a white icon for allergies and
// emergencies (priority). 30 x 48, flush to the row's left edge, 12px down (Phrases.dc.html
// L60, L160). Absolute: the row must be positioned.
//
// Props: icon (a lucide icon component, drawn at 18px with a 2px stroke, or a ready
// element), priority, world (a WORLD row or key; Phrases by default), style, className.
// aria-hidden (the row's name says what the tab marks), no pointer events.
import React from 'react';
import { NEUTRAL, WORLD, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.phrases);

/**
 * @param {{ icon?: any, priority?: boolean, world?: any, variant?: 'plate'|'strip'|'inline'|'card', style?: CSS, className?: string }} props
 */
export default function ThumbIndex({ icon, priority = false, world, style, className }) {
  const w = worldFor(world);
  const ink = priority ? NEUTRAL.white : w.plateTitle;
  let glyph = null;
  if (React.isValidElement(icon)) glyph = icon;
  else if (icon) glyph = React.createElement(icon, { size: 18, color: ink, strokeWidth: 2, 'aria-hidden': true });
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        top: 12,
        width: 30,
        height: 48,
        boxSizing: 'border-box',
        paddingRight: 3,
        borderRadius: '0 24px 24px 0',
        background: priority ? NEUTRAL.stamp : w.plate,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {glyph}
    </span>
  );
}
