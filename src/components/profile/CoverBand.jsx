// CoverBand: the cloth cover at the top of a world (bible.profile.header (1), .visiting,
// .circle_screen). Full-bleed under the 12px mat, in the owner's cloth with its weave, a
// gold-foil hairline frame 8px inside the edge and a foil mono kicker. The page's paper,
// the banner and the tab bar never take the cloth; only this band does.
//
//   <CoverBand cloth height kicker leading onLeading leadingLabel leadingPressed title
//              orbitMotif as className style />
//   cloth          a cloth key ('forest'), a CLOTH row, or nothing: Harbour.
//   height         132 (default): the profile and visit cover (Profile.dc.html L29-36,
//                  Profile-Visit L29-36). The trunk card rests on its lower 72px, so the kicker
//                  sits at the top: 24px in from the left, or at 80 when the back circle
//                  takes the left.
//                  112: the Circle screen's band (Circle.dc.html L28-50): the back circle, the
//                  kicker and an Instrument Serif 30 white h1 in one row, with the gold orbit
//                  motif at the right.
//   kicker         the owner-relative words, given by the caller: 'My world', 'Kenji’s world',
//                  'A virtual passport', 'Your circle'. Printed in capitals.
//   leading        'edit' (a 44px circle with a Pencil at the top right, 'Edit your world') or
//                  'back' (a ChevronLeft at the left, 'Back'). Drawn only with onLeading.
//   leadingLabel   overrides that accessible name. leadingPressed: aria-pressed on the pencil
//                  while the page is in edit mode (omit it otherwise).
//   title          the h1: { pre, italic, post } or a string marking its italic word with
//                  asterisks ('Your *circle*'). The italic is in foil. The 132 cover has none
//                  on the boards (the bookplate carries the page's h1).
//   orbitMotif     the three foil rings at the right; on by default at 112 only.
//   contentMaxWidth  the band stays full-bleed, but its circle, kicker and title can sit in
//                  the page's column on a wide screen (e.g. 672 for md:max-w-2xl); by default
//                  they follow the band's own edges, as on the 390px boards.
//
// Focus rings on the band are foil (principle 8: --gs-focus #E7C877 on cloth covers). Every
// colour comes from the tokens: the cloth, FOIL, NEUTRAL white and black for the weave and
// the glass circle.
//
// COVER_WEAVE and SWATCH_WEAVE are the cloth textures as background-image layers: the
// cover's 4px weave (Profile L29) and the cloth picker's finer 2px swatch weave (Palettes
// L503-510). Paint the cloth as the background colour under them.
import React from 'react';
import { ChevronLeft, Pencil } from 'lucide-react';
import { CLOTH, FOIL, NEUTRAL, clothOf, fs, rgba } from '@/components/redesign/constants';

/** @typedef {import('react').CSSProperties} CSS */

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

/**
 * A style object that may carry CSS custom properties (--gs-focus).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

export const COVER_WEAVE = `repeating-linear-gradient(0deg, ${rgba(NEUTRAL.white, 0.035)} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${rgba(NEUTRAL.black, 0.07)} 0 1px, transparent 1px 4px)`;
export const SWATCH_WEAVE = `repeating-linear-gradient(0deg, ${rgba(NEUTRAL.white, 0.06)} 0 1px, transparent 1px 2px), repeating-linear-gradient(90deg, ${rgba(NEUTRAL.black, 0.08)} 0 1px, transparent 1px 2px)`;

/**
 * A cloth from a stored key, a CLOTH row, or nothing (Harbour).
 * @param {any} c
 */
export function clothRow(c) {
  if (c && typeof c === 'object' && typeof c.key === 'string' && Object.prototype.hasOwnProperty.call(CLOTH, c.key)) {
    return CLOTH[c.key];
  }
  return clothOf(typeof c === 'string' ? c : null);
}

/**
 * A title as { pre, italic, post }: an object passes through; a string may mark its
 * italic word with asterisks ('Your *circle*'); anything else gives null.
 * @param {any} t
 * @returns {{ pre: string, italic: string, post: string } | null}
 */
export function titleParts(t) {
  if (t && typeof t === 'object' && !Array.isArray(t) && !React.isValidElement(t)) {
    const pre = String(t.pre ?? '');
    const italic = String(t.italic ?? '');
    const post = String(t.post ?? '');
    return pre || italic || post ? { pre, italic, post } : null;
  }
  if (typeof t !== 'string' || !t.trim()) return null;
  const m = /^(.*?)\*([^*]+)\*(.*)$/s.exec(t);
  return m ? { pre: m[1], italic: m[2], post: m[3] } : { pre: t, italic: '', post: '' };
}

// The glass circle on the cloth (Profile L33, Profile-Visit L32, Circle L42).
/** @type {CSS} */
const CIRCLE = {
  flex: 'none',
  width: 44,
  height: 44,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: rgba(NEUTRAL.white, 0.12),
  border: `1px solid ${rgba(NEUTRAL.white, 0.3)}`,
  color: NEUTRAL.white,
  cursor: 'pointer',
};

// The gold orbit at the right of the 112 band (Circle.dc.html L30-39).
function OrbitMotif() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="190"
      height="112"
      viewBox="0 0 190 112"
      fill="none"
      style={{ position: 'absolute', right: 0, top: 0, pointerEvents: 'none' }}
    >
      <circle cx="160" cy="56" r="24" stroke={FOIL} strokeOpacity=".34" strokeWidth="1" />
      <circle cx="160" cy="56" r="46" stroke={FOIL} strokeOpacity=".24" strokeWidth="1" />
      <circle cx="160" cy="56" r="68" stroke={FOIL} strokeOpacity=".16" strokeWidth="1" />
      <circle cx="160" cy="56" r="4" fill={FOIL} fillOpacity=".34" />
      <circle cx="139.2" cy="44" r="2.5" fill={FOIL} fillOpacity=".4" />
      <circle cx="175.7" cy="12.8" r="2.5" fill={FOIL} fillOpacity=".3" />
      <circle cx="130.4" cy="91.2" r="2.5" fill={FOIL} fillOpacity=".3" />
      <circle cx="96.1" cy="32.7" r="2.5" fill={FOIL} fillOpacity=".22" />
    </svg>
  );
}

/**
 * @param {{
 *   cloth?: any, height?: 132|112, kicker?: import('react').ReactNode,
 *   leading?: 'edit'|'back'|null, onLeading?: (e: any) => void, leadingLabel?: string,
 *   leadingPressed?: boolean, title?: any, orbitMotif?: boolean, contentMaxWidth?: number|string,
 *   as?: any, className?: string, style?: CSS, children?: import('react').ReactNode,
 * }} props
 */
export default function CoverBand({
  cloth = undefined,
  height = 132,
  kicker = null,
  leading = null,
  onLeading = undefined,
  leadingLabel = undefined,
  leadingPressed = undefined,
  title = null,
  orbitMotif = undefined,
  contentMaxWidth = undefined,
  as: Tag = 'div',
  className = undefined,
  style = undefined,
  children = null,
}) {
  const c = clothRow(cloth);
  const band = Number(height) === 112 ? 112 : 132;
  const motif = orbitMotif ?? band === 112;
  const parts = titleParts(title);
  const hasKicker = kicker !== null && kicker !== undefined && kicker !== false && kicker !== '';
  const kind = leading === 'edit' || leading === 'back' ? leading : null;
  const showLeading = !!kind && typeof onLeading === 'function';
  const name = leadingLabel || (kind === 'edit' ? 'Edit your world' : 'Back');

  const button = showLeading ? (
    <button
      type="button"
      onClick={onLeading}
      aria-label={name}
      aria-pressed={kind === 'edit' && typeof leadingPressed === 'boolean' ? leadingPressed : undefined}
      style={CIRCLE}
    >
      {kind === 'edit'
        ? <Pencil size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
        : <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" focusable="false" />}
    </button>
  ) : null;

  /** @type {CSS} */
  const kickerStyle = {
    fontFamily: MONO,
    fontSize: fs(10),
    lineHeight: band === 112 ? 1.4 : 1.2,
    fontWeight: 500,
    letterSpacing: '.2em',
    textTransform: 'uppercase',
    overflowWrap: 'anywhere',
    color: FOIL,
  };
  const h1 = parts ? (
    <h1
      style={{
        margin: band === 112 ? '2px 0 0' : '6px 0 0',
        fontFamily: SERIF,
        fontSize: fs(30),
        fontWeight: 400,
        lineHeight: 1.05,
        overflowWrap: 'anywhere',
        color: NEUTRAL.white,
      }}
    >
      {parts.pre}
      {parts.italic ? <em style={{ fontStyle: 'italic', color: FOIL }}>{parts.italic}</em> : null}
      {parts.post}
    </h1>
  ) : null;

  return (
    <Tag
      className={className}
      style={css({
        position: 'relative',
        overflow: 'hidden',
        minHeight: band,
        boxSizing: 'border-box',
        backgroundColor: c.cloth,
        backgroundImage: COVER_WEAVE,
        '--gs-focus': FOIL,
        ...style,
      })}
    >
      {motif ? <OrbitMotif /> : null}
      {/* The foil frame: Profile L31 (.8, radius 3) on the 132 cover, Circle L40 (.7) on the 112 band. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 8,
          border: `1px solid ${rgba(FOIL, band === 112 ? 0.7 : 0.8)}`,
          borderRadius: band === 112 ? 0 : 3,
          pointerEvents: 'none',
        }}
      />
      {band === 112 ? (
        <div style={{ position: 'relative', minHeight: 112, maxWidth: contentMaxWidth, margin: '0 auto', boxSizing: 'border-box', padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {button}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            {hasKicker ? <div style={kickerStyle}>{kicker}</div> : null}
            {h1}
            {children}
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', minHeight: 132, maxWidth: contentMaxWidth, margin: '0 auto', boxSizing: 'border-box' }}>
          {showLeading ? (
            <span style={{ position: 'absolute', top: 12, ...(kind === 'edit' ? { right: 24 } : { left: 24 }) }}>{button}</span>
          ) : null}
          {hasKicker || h1 || children ? (
            <div
              style={{
                position: 'relative',
                boxSizing: 'border-box',
                padding: `28px ${showLeading && kind === 'edit' ? 80 : 24}px 12px ${showLeading && kind === 'back' ? 80 : 24}px`,
              }}
            >
              {hasKicker ? <div style={kickerStyle}>{kicker}</div> : null}
              {h1}
              {children}
            </div>
          ) : null}
        </div>
      )}
    </Tag>
  );
}
