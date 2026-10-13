// SwingTag: Shopping's motif, the price tag that hangs on a brass string (bible
// finders[shopping].motif). A tag with a pointed left end (clip-path), a 1px brass border,
// a punched eyelet and a brass string curving up to the corner.
//
//   size 'card'   each card's number (Shopping.dc.html L89-94): 34 x 22, blush, a plum serif
//                 numeral, tilted 6deg, 12px from the photo or strip corner. Hidden from
//                 screen readers by default, like every card number.
//   size 'plate'  the plate's one larger tag carrying the count, '30 NEARBY' (L27-34):
//                 88 x 30, white, mono plum, tilted -6deg, hung 82px down with its right
//                 end 18px in from the plate's right edge. The words are read out.
// Absolute: the photo, strip or plate must be positioned. Both sizes grow with the text
// (min-width and min-height), so a long count or a large text size never clips.
// `variant` is accepted as an alias of size ('plate' or 'card').
//
// Props: n (the number, card) or label (the words, plate; n is used when no label),
// size, world (a WORLD row or key; Shopping by default), decorative (override the
// default above), style, className. No pointer events.
import React from 'react';
import { NEUTRAL, WORLD, worldOf, fs } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.shopping);

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// Board geometry per size, measured from the tag's top-left corner. box: where the tag
// hangs in its photo, strip or plate; string: the brass string's SVG box (relative to the
// tag) and path, ending at the eyelet; tag: minimum size, tilt and pivot (the eyelet);
// point: the depth of the pointed end; eyelet: diameter and left inset; padding: the
// board's text box inside the 1px border (the words are centred in it, and the tag grows
// past its minimum width when they need more room).
const SIZES = {
  card: {
    box: { left: 12, top: 12 },
    string: { left: -12, top: -12, width: 40, height: 40, d: 'M6 0C8 9 12 17 19 23' },
    tag: { minWidth: 34, minHeight: 22, rotate: 6, origin: '7px 11px' },
    point: 8,
    eyelet: { size: 4, left: 5 },
    padding: '0 1px 0 10px',
  },
  plate: {
    box: { right: 18, top: 82 },
    string: { left: -14, top: -22, width: 104, height: 64, d: 'M3 1C6 14 11 26 21 37' },
    tag: { minWidth: 88, minHeight: 30, rotate: -6, origin: '7px 15px' },
    point: 12,
    eyelet: { size: 6, left: 5 },
    padding: '0 1px 0 13px',
  },
};

/**
 * @param {{ n?: number|string, label?: string, size?: 'card'|'plate', world?: any, variant?: 'plate'|'strip'|'inline'|'card', decorative?: boolean, style?: CSS, className?: string }} props
 */
export default function SwingTag({ n, label, size, world, variant, decorative, style, className }) {
  const w = worldFor(world);
  const kind = size === 'plate' || (!size && variant === 'plate') ? 'plate' : 'card';
  const g = SIZES[kind];
  const plate = kind === 'plate';
  const brass = w.brass || w.plateAccent;
  const number = n != null ? String(n) : null;
  // The plate tag shows its words (or the bare number); a card tag shows its number.
  const text = (plate ? label ?? number : number ?? label) ?? '';
  const hidden = decorative ?? !plate;
  const inner = plate ? NEUTRAL.white : w.plate;

  return (
    <span
      aria-hidden={hidden ? 'true' : undefined}
      className={className}
      style={{ position: 'absolute', ...g.box, pointerEvents: 'none', ...style }}
    >
      {/* The brass string, from the corner down to the eyelet. */}
      <svg
        aria-hidden="true"
        width={g.string.width}
        height={g.string.height}
        viewBox={`0 0 ${g.string.width} ${g.string.height}`}
        fill="none"
        style={{ position: 'absolute', left: g.string.left, top: g.string.top, display: 'block', overflow: 'visible' }}
      >
        <path d={g.string.d} stroke={brass} strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span
        style={{
          position: 'relative',
          display: 'flex',
          minWidth: g.tag.minWidth,
          minHeight: g.tag.minHeight,
          transform: `rotate(${g.tag.rotate}deg)`,
          transformOrigin: g.tag.origin,
        }}
      >
        {/* The brass border: the tag shape in brass, with the paper inset 1px. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: brass,
            WebkitClipPath: `polygon(${g.point}px 0, 100% 0, 100% 100%, ${g.point}px 100%, 0 50%)`,
            clipPath: `polygon(${g.point}px 0, 100% 0, 100% 100%, ${g.point}px 100%, 0 50%)`,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            bottom: 1,
            left: 1,
            background: inner,
            WebkitClipPath: `polygon(${g.point - 0.5}px 0, 100% 0, 100% 100%, ${g.point - 0.5}px 100%, 0 50%)`,
            clipPath: `polygon(${g.point - 0.5}px 0, 100% 0, 100% 100%, ${g.point - 0.5}px 100%, 0 50%)`,
          }}
        />
        <span
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: g.padding,
            whiteSpace: 'nowrap',
            color: w.ink,
            ...(plate
              ? { fontFamily: MONO, fontSize: fs(10), fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1 }
              : { fontFamily: SERIF, fontSize: fs(15), lineHeight: 1 }),
          }}
        >
          {text}
        </span>
        {/* The punched eyelet: the plate shows through it on the plate tag; on a card it is
            plum with a brass rim, as the strip behind it. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: g.eyelet.left,
            top: '50%',
            width: g.eyelet.size,
            height: g.eyelet.size,
            marginTop: -g.eyelet.size / 2,
            boxSizing: 'border-box',
            borderRadius: 999,
            ...(plate
              ? { background: w.plate, border: `1px solid ${brass}` }
              : { background: w.ink, boxShadow: `0 0 0 1px ${brass}` }),
          }}
        />
      </span>
    </span>
  );
}
