// Ornaments: the few printed edges and marks the new look uses outside the finders.
// Pure decoration: every piece is aria-hidden, takes no pointer events, and takes its
// colours from the tokens in ./constants (NEUTRAL, ZONE), never a hex of its own. Each
// is drawn from the pinned artboards in docs/design/new-look/.
//
//   <AirmailChevron height={5|4|3} absolute />  The red/cream/blue airmail edge. In flow
//        by default (Mailbox L39, Circle L52); `absolute` pins it inside the top edge of
//        the nearest positioned box (the circle folder, Home-Boxes L73; the circle band,
//        Main L71; an envelope, Home-Boxes L81). 5 = page and band, 4 = folder, 3 = envelope.
//   perforationStyle()                         The stamp-sheet perforation along a top edge,
//        as a style object ({ mask, WebkitMask }) for the band that has it (Main L159).
//        Same mask as the .gs-perf class in index.css.
//   <GoldKeyline />                            The passport folder's inner gold line: inset
//        6, radius 16 (Home-Boxes L57). The folder must be position: relative.
//   <GoldDoubleRule />                         The passport band's two gold rules, 6px inside
//        its top and bottom edges (Main L53-54).
//   <BrassHairlines />                         The shelf band's brass hairlines on its top
//        and bottom edges (Main L196-197).
//   <BrassDiamondRule />                       The 40px brass rule with a 5px diamond over
//        the closing quote (Home-Boxes L360-364). In flow, centred.
//   <PostmarkLines variant="envelope|postcard" />  Three 1px wavy cancellation lines
//        (Mailbox L91, L193). Position them with `style`.
//   <TwoRingMark color />                      Two interlocking rings, 20x12 (Circle L164):
//        the inner circle (you follow each other). Stroke defaults to currentColor.
//
// Every component also takes `style` (merged last, so a caller can move it) and `className`.
import React from 'react';
import { NEUTRAL, ZONE } from './constants';

/** @typedef {import('react').CSSProperties} CSS */

const NONE = 'none';

// ── Airmail chevron ──────────────────────────────────────────────────────

// The airmail edge: 10px red, 4px cream, 10px blue, 4px cream, repeating at 135deg.
export const AIRMAIL_STRIPES = `repeating-linear-gradient(135deg, ${NEUTRAL.stamp} 0 10px, ${NEUTRAL.cream} 10px 14px, ${NEUTRAL.airmailBlue} 14px 24px, ${NEUTRAL.cream} 24px 28px)`;

const CHEVRON_HEIGHTS = [3, 4, 5];

/**
 * @param {{ height?: 3|4|5, absolute?: boolean, style?: CSS, className?: string }} props
 */
export function AirmailChevron({ height = 5, absolute = false, style, className }) {
  const h = CHEVRON_HEIGHTS.includes(Number(height)) ? Number(height) : 5;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        height: h,
        background: AIRMAIL_STRIPES,
        pointerEvents: NONE,
        ...(absolute ? { position: 'absolute', top: 0, left: 0, right: 0 } : null),
        ...style,
      }}
    />
  );
}

// ── Perforation ──────────────────────────────────────────────────────────

// 4px holes on a 12px pitch along the top edge. Whatever sits behind the band shows
// through the holes (Main L159: the kraft of the zone above).
const PERFORATION = `radial-gradient(circle 4px at 6px 0, transparent 98%, ${NEUTRAL.black}) 0 0 / 12px 100% repeat-x`;

/** @returns {CSS} */
export function perforationStyle() {
  return { WebkitMask: PERFORATION, mask: PERFORATION };
}

// ── Gold (the passport) ──────────────────────────────────────────────────

/**
 * @param {{ inset?: number, radius?: number, color?: string, style?: CSS, className?: string }} props
 */
export function GoldKeyline({ inset = 6, radius = 16, color = ZONE.passport.keyline, style, className }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        top: inset,
        right: inset,
        bottom: inset,
        left: inset,
        border: `1px solid ${color}`,
        borderRadius: radius,
        pointerEvents: NONE,
        ...style,
      }}
    />
  );
}

/**
 * @param {{ inset?: number, color?: string, style?: CSS, className?: string }} props
 */
export function GoldDoubleRule({ inset = 6, color = ZONE.passport.doubleRule, style, className }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: inset,
        bottom: inset,
        borderTop: `1px solid ${color}`,
        borderBottom: `1px solid ${color}`,
        pointerEvents: NONE,
        ...style,
      }}
    />
  );
}

// ── Brass (the shelf and the quote) ──────────────────────────────────────

/**
 * @param {{ color?: string, style?: CSS, className?: string }} props
 */
export function BrassHairlines({ color = ZONE.shelf.hairline, style, className }) {
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
        borderTop: `1px solid ${color}`,
        borderBottom: `1px solid ${color}`,
        pointerEvents: NONE,
        ...style,
      }}
    />
  );
}

/**
 * @param {{ color?: string, style?: CSS, className?: string }} props
 */
export function BrassDiamondRule({ color = NEUTRAL.brassRule, style, className }) {
  /** @type {CSS} */
  const rule = { position: 'absolute', top: 4, width: 15, height: 1, background: color };
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ position: 'relative', display: 'block', width: 40, height: 8, margin: '0 auto', pointerEvents: NONE, ...style }}
    >
      <span style={{ ...rule, left: 0 }} />
      <span
        style={{ position: 'absolute', left: 17.5, top: 2, width: 5, height: 5, background: color, transform: 'rotate(45deg)' }}
      />
      <span style={{ ...rule, right: 0 }} />
    </span>
  );
}

// ── Postmark lines ───────────────────────────────────────────────────────

// Three quadratic waves. step: half a wave; dip: how far the first control point rises.
// envelope: Mailbox L91 (48x20, airmail blue at 40%); postcard: L193 (44x14, ink-3 at 55%).
const POSTMARK = {
  envelope: { width: 48, height: 20, step: 6, dip: 3, ys: [4, 10, 16], color: NEUTRAL.airmailBlue, opacity: 0.4 },
  postcard: { width: 44, height: 14, step: 5.5, dip: 2, ys: [3, 7, 11], color: NEUTRAL.ink3, opacity: 0.55 },
};

function wave(y, step, dip, width) {
  let d = `M0 ${y}Q${step / 2} ${y - dip} ${step} ${y}`;
  for (let x = step * 2; x <= width + 0.001; x += step) d += `T${+x.toFixed(2)} ${y}`;
  return d;
}

/**
 * @param {{ variant?: 'envelope'|'postcard', color?: string, opacity?: number, style?: CSS, className?: string }} props
 */
export function PostmarkLines({ variant = 'envelope', color, opacity, style, className }) {
  const p = POSTMARK[variant] || POSTMARK.envelope;
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={p.width}
      height={p.height}
      viewBox={`0 0 ${p.width} ${p.height}`}
      fill="none"
      stroke={color || p.color}
      strokeOpacity={opacity ?? p.opacity}
      strokeWidth="1"
      style={{ display: 'block', pointerEvents: NONE, ...style }}
    >
      {p.ys.map((y) => (
        <path key={y} d={wave(y, p.step, p.dip, p.width)} />
      ))}
    </svg>
  );
}

// ── Two rings ────────────────────────────────────────────────────────────

/**
 * @param {{ color?: string, strokeWidth?: number, style?: CSS, className?: string }} props
 */
export function TwoRingMark({ color = 'currentColor', strokeWidth = 1.2, style, className }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="12"
      viewBox="0 0 20 12"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ display: 'block', flexShrink: 0, pointerEvents: NONE, ...style }}
    >
      <circle cx="6.6" cy="6" r="5.4" />
      <circle cx="13.4" cy="6" r="5.4" />
    </svg>
  );
}
