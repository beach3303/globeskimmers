// Contours: Things to Do's motif, five nested irregular loops like a hilltop on a
// topographic map (bible finders[todo].motif). The five paths are verbatim from
// ThingsToDo.dc.html L27.
//
//   variant 'plate'  200px, 1px in the plate kicker colour at 22%, pinned to the plate's
//                    top right and cropped by its edge (L27). Absolute: the plate must be
//                    positioned and clip its overflow.
//   variant 'strip'  the photo-less top of a 240px chapter strip card, at 30% in the world
//                    ink (L109). `index` picks one of the board's three placements (L109,
//                    L126, L153; the last adds a fainter second set) so neighbouring cards
//                    don't repeat.
//   variant 'card'   a full card's 72px no-photo strip (L194): one loop set anchored to the
//                    right and a smaller pair at the left.
// 'strip' and 'card' fill the nearest positioned box (absolute, inset 0) and clip to it.
//
// Props: world (a WORLD row or key; Things to Do by default), variant, index (strip),
// opacity (overrides the variant's), style, className. aria-hidden, no pointer events.
import React from 'react';
import { WORLD, worldOf } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const worldFor = (world) => (world && typeof world === 'object' ? world : worldOf(world) || WORLD.todo);

// The five loops, outermost first, in a 200 x 200 box (ThingsToDo.dc.html L27).
export const CONTOUR_PATHS = [
  'M96 8C128 4 160 18 178 44C196 70 196 108 182 138C166 172 132 194 98 190C62 186 26 166 14 132C2 98 10 60 34 36C50 20 72 10 96 8Z',
  'M98 28C124 25 150 38 163 60C177 84 175 114 162 138C148 162 122 174 98 171C72 168 46 152 37 126C28 100 34 70 52 52C64 38 80 30 98 28Z',
  'M101 48C121 46 140 57 148 75C157 95 154 118 142 134C130 150 112 156 95 152C76 148 60 134 56 114C52 94 58 74 72 62C80 54 90 49 101 48Z',
  'M104 68C118 67 130 75 134 88C139 102 135 118 124 126C114 133 100 134 89 128C78 121 72 108 75 95C78 81 90 69 104 68Z',
  'M107 88C115 88 121 93 122 101C123 109 118 115 110 116C102 117 95 112 94 104C93 96 99 88 107 88Z',
];

// One loop set drawn at `size` px. strokeWidth is in the 200-unit box, so it scales with
// the set, as the board's scaled <g> does.
function Loops({ size, color, strokeWidth, opacity, count = 5, style, className = undefined }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ position: 'absolute', display: 'block', opacity, pointerEvents: 'none', ...style }}
    >
      {CONTOUR_PATHS.slice(0, count).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// The strip card's three placements on the 238px strip: each loop set is the board's
// <g transform="translate(x y) scale(s)"> as left/top/size (200 * s), with its stroke (in
// the 200-unit box), opacity and how many of the five loops it draws.
const STRIP_PLACEMENTS = [
  // L109: translate(62 -40) scale(1.12)
  [{ left: 62, top: -40, size: 224, strokeWidth: 0.9, opacity: 0.3, count: 5 }],
  // L126: translate(-30 -16) scale(1.2)
  [{ left: -30, top: -16, size: 240, strokeWidth: 0.9, opacity: 0.3, count: 5 }],
  // L153: translate(110 -10) scale(.95), plus three loops at translate(-92 -60) scale(.8)
  [
    { left: 110, top: -10, size: 190, strokeWidth: 0.9, opacity: 0.3, count: 5 },
    { left: -92, top: -60, size: 160, strokeWidth: 1.1, opacity: 0.22, count: 3 },
  ],
];

/**
 * @param {{ world?: any, variant?: 'plate'|'strip'|'inline'|'card', index?: number, opacity?: number, style?: CSS, className?: string }} props
 */
export default function Contours({ world, variant = 'plate', index = 0, opacity, style, className }) {
  const w = worldFor(world);

  if (variant === 'plate') {
    return (
      <Loops
        className={className}
        size={200}
        color={w.plateKicker}
        strokeWidth={1}
        opacity={opacity ?? 0.22}
        style={{ top: -38, right: -52, ...style }}
      />
    );
  }

  /** @type {CSS} */
  const box = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none', ...style };

  if (variant === 'card') {
    // L194: translate(196 -74) on a 356px strip = 40px past the right edge; the small
    // pair at translate(-40 -20) scale(.6), 1.5 units (0.9px).
    return (
      <span aria-hidden="true" className={className} style={box}>
        <Loops size={200} color={w.ink} strokeWidth={1} opacity={opacity ?? 0.3} style={{ top: -74, right: -40 }} />
        <Loops size={120} color={w.ink} strokeWidth={1.5} opacity={opacity ?? 0.22} count={2} style={{ top: -20, left: -40 }} />
      </span>
    );
  }

  const n = Number.isFinite(Number(index)) ? Math.abs(Math.trunc(Number(index))) : 0;
  const sets = STRIP_PLACEMENTS[n % STRIP_PLACEMENTS.length];
  return (
    <span aria-hidden="true" className={className} style={box}>
      {sets.map((p) => (
        <Loops
          key={`${p.left},${p.top}`}
          size={p.size}
          color={w.ink}
          strokeWidth={p.strokeWidth}
          opacity={opacity ?? p.opacity}
          count={p.count}
          style={{ top: p.top, left: p.left }}
        />
      ))}
    </span>
  );
}
