// CupRing: Coffee's motif, the ring a mug leaves on the page (bible finders[coffee].motif).
// An open circle with a 50-degree gap at two o'clock and one thicker arc. Static: no steam.
//
//   variant 'plate'  150px, 2px stroke in the plate accent (ember) at 30%, behind the
//                    plate's right third and cropped by its edge (Coffee.dc.html L29).
//                    Absolute: the plate must be positioned (and clip its overflow).
//   variant 'card'   68px at 85% (L80-83), the emblem on a card's no-photo strip; pass
//                    the café's initial as children and it sits in the middle.
//                    'strip' is the same.
//
// Props: world (a WORLD row or key; Coffee by default), variant, opacity (overrides the
// stroke opacity), children (card only), style, className. aria-hidden, no pointer events.
import React from 'react';
import { WORLD, worldOf, fs } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.coffee);

// The ring at a given radius: a thin stroke with a 50-degree gap, then a 50-degree arc
// 3px thicker. The dash lengths are fractions of the circumference, as on the board
// (r 72: 389.6 + 62.8; r 31.5: 170.4 + 27.5).
function Ring({ size, r, color, strokeOpacity = undefined }) {
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = +((circumference * 50) / 360).toFixed(1);
  const rest = +(circumference - arc).toFixed(1);
  return (
    <>
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth="2"
        strokeOpacity={strokeOpacity}
        strokeDasharray={`${rest} ${arc}`}
        transform={`rotate(-5 ${c} ${c})`}
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth="5"
        strokeOpacity={strokeOpacity}
        strokeDasharray={`${arc} ${rest}`}
        transform={`rotate(150 ${c} ${c})`}
      />
    </>
  );
}

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', opacity?: number, children?: import('react').ReactNode, style?: CSS, className?: string }} props
 */
export default function CupRing({ world, variant = 'plate', opacity, children, style, className }) {
  const w = worldFor(world);

  if (variant === 'plate') {
    return (
      <svg
        aria-hidden="true"
        className={className}
        width="150"
        height="150"
        viewBox="0 0 150 150"
        fill="none"
        style={{ position: 'absolute', top: -25, right: -67, opacity: opacity ?? 0.3, pointerEvents: 'none', ...style }}
      >
        <Ring size={150} r={72} color={w.plateAccent} />
      </svg>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 68,
        height: 68,
        flexShrink: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <svg width="68" height="68" viewBox="0 0 68 68" fill="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Ring size={68} r={31.5} color={w.plateAccent} strokeOpacity={opacity ?? 0.85} />
      </svg>
      {children != null && (
        <span
          style={{
            position: 'relative',
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontSize: fs(44),
            lineHeight: 1,
            color: w.plateTitle,
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
