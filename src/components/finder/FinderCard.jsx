// FinderCard: the result-card kit every finder world shares (the bible's shared finder
// frame, part 5; Eat.dc.html L91-132, Coffee.dc.html L76-114, ATMs.dc.html L92-129,
// ThingsToDo.dc.html L192-205). Each piece takes `world` (a WORLD row or any key worldOf()
// reads) and reads every colour from it. Sizes follow --fs, and anything holding text has a
// min-height so it grows instead of clipping.
//
//   <WorldCard world as>       The card: white, radius 16, 1px world line, the world's card
//        shadow, overflow hidden. as: 'article' (default) or 'li' inside a list.
//   worldGrid(isTablet)        The list's style: one column 12px apart on a phone; two
//        columns 16px apart on iPad. Also clears list margins and bullets for an <ol>.
//   <NumberMark n world shape place>  The card's number, hidden from screen readers (the
//        list numbers the cards). shape (default WORLD.numberShape): 'circle', a serif
//        numeral in a 28px white circle; 'ring' (Coffee), a 30px white disc with a 2px
//        copper ring; 'chip' (ATMs), a 30x24 white card chip with two carbon contact lines;
//        'swingTag' (Shopping), the brass-strung tag. place: 'corner' (12px in from the top
//        left of the photo or strip, the default), 'middle' (centred down a short strip:
//        Eat, Restrooms, ATMs, Convenience) or 'inline' (in the flow, Money's rows).
//   <FactsLine world open place isLocal items>  The one facts line, 13px #3A3128,
//        fragments joined by a muted '·' and wrapping when they don't fit. The first
//        fragment is always the open-state word from openState (src/lib/openState.js):
//        'Open until 9 PM' in #2E6B4E, 'Closed · opens 7 AM' in #B0472F, 'Hours not
//        listed' muted, hours without a verdict ('9 AM–5 PM daily') in #3A3128. open: an
//        openState result; or pass place (a row; openStateFor reads its hours and
//        utcOffsetMinutes) and isLocal (current-location mode) and it is worked out here;
//        null prints 'Hours not listed'; false leaves the open word out (a row with no
//        hours to speak of). items: the other fragments (distance, <RatingFact/> or a
//        { rating, count, source } object, price). An item that would print nothing is
//        dropped with its '·': falsy, blank, a bare 0, or a rating with no value or no named
//        source (owned rows carry none), so a missing fact never leaves a gap.
//   ratingText({ rating, count, source })  '★ 4.5 (1,910) Google', or null when there is no
//        rating or no known source (source 'google' or 'globeskimmers'/'gs'). A rating with
//        no named source is never shown.
//   <RatingFact world rating count source>  The same, drawn: a 12px star in the world's
//        star colour, the rating 600, '(1,910)', the source muted. Nothing when ratingText
//        gives null.
//   <WorldTag world tone icon>  A 24px tag, radius 8, 12/600: 'outline' (white, 1px world
//        line, #3A3128; the default), 'wash' (the world wash with washInk) or 'solid' (the
//        world ink with white). icon: a lucide icon at 14px.
//   <TagRow max>               Up to `max` (3) tags, 6px apart, wrapping. Extra children are
//        dropped, so a card never shows more than three.
//   <CardKicker world>         The card's mono kicker, 10.5px .12em in the world's icon ink
//        (Bordeaux, Coffee's copper, lapis, ...): 'PIZZA RESTAURANT'.
//   <CardName world as leader trailing>  The name: Instrument Serif 24px in ink, two lines
//        at most. leader + trailing: Eat's menu line, the name, a saffron leader and the
//        distance in mono #736657 like a price (Eat L103-107).
//   <QuietRow world icon label onClick href expanded controls chevron>  A 44px quiet row:
//        an 18px lucide icon in iconInk and a 12.5/600 #3A3128 label ('AI details', 'Add a
//        photo of what you ordered'). A <button>, or an <a> with href. expanded and controls
//        set aria-expanded and aria-controls when it discloses something; chevron draws a
//        turning ChevronDown. Forwards its ref (TravelerDishes watches it to load lazily).
//   <QuietRows world>          One hairline row of quiet rows, justified apart: two sit side by
//        side and stack only when they don't fit (Eat L120-123, Coffee L98-101).
//   <QuietPanel world id order>  A disclosure's body that opens under the quiet rows: white,
//        1px world line, radius 14. Inside QuietRows it takes the full width after the rows
//        (flex-basis 100%, CSS order); anywhere else it simply follows its row.
//   <ActionRow world name onDirections onMap phone onCall website onMore moreIcon
//        moreExpanded moreControls extras>  The card's one action row: Directions solid in
//        cta/ctaInk at ctaWeight (radius 14, 44px, the only solid button on the card) with
//        Navigation 16; Map, Call (a tel: link, only when there is a phone), Website (only
//        with a link) and More as 44px white buttons with the world line and iconInk icons.
//        More is the word with a chevron, or with moreIcon a 44px '…' button named 'More
//        about {name}'. The row wraps rather than clip at large text sizes.
//   <WorldSkeleton world variant count label>  Loading shapes on the world wash, shimmering
//        (still with reduced motion): 'card' (a result card), 'strip' (Things to Do's 240px
//        strip card), 'row' (a 64px list row) and 'entry' (a Culture catalogue entry).
//        Hidden from screen readers; label adds a polite 'Loading…' status for them.
import React from 'react';
import { ChevronDown, Globe, Map as MapIcon, MoreHorizontal, Navigation, Phone, Star } from 'lucide-react';
import { NEUTRAL, fs, rgba } from '@/components/redesign/constants';
import { MenuLeader, SwingTag } from '@/components/finder/motifs';
import { openStateFor } from '@/lib/openState';
import { worldRow } from './FinderControls';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

/**
 * A style object that may carry CSS custom properties (--w-wash).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const given = (v) => v != null && v !== false && v !== '';

// ── Card and grid ────────────────────────────────────────────────────────

/**
 * @param {{ world?: any, as?: any, children?: import('react').ReactNode, className?: string, style?: CSS, [key: string]: any }} props
 * @param {any} ref
 */
function WorldCardWithRef(
  { world = undefined, as: As = 'article', children = undefined, className = undefined, style = undefined, ...rest },
  ref,
) {
  const w = worldRow(world);
  return (
    <As
      ref={ref}
      {...rest}
      className={className}
      style={{
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        background: NEUTRAL.white,
        border: `1px solid ${w.line}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: w.cardShadow,
        ...style,
      }}
    >
      {children}
    </As>
  );
}
export const WorldCard = React.forwardRef(WorldCardWithRef);
WorldCard.displayName = 'WorldCard';

/**
 * @param {boolean} isTablet
 * @returns {CSS}
 */
export function worldGrid(isTablet) {
  return isTablet
    ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start', margin: 0, padding: 0, listStyle: 'none' }
    : { display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' };
}

// ── Number ───────────────────────────────────────────────────────────────

/**
 * @param {{ n?: number|string, world?: any, shape?: string, place?: 'corner'|'middle'|'inline', className?: string, style?: CSS }} props
 */
export function NumberMark({ n = undefined, world = undefined, shape = undefined, place = 'corner', className = undefined, style = undefined }) {
  const w = worldRow(world);
  const kind = shape || w.numberShape || 'circle';
  if (kind === 'swingTag') return <SwingTag n={n} world={w} className={className} style={style} />;

  const size = kind === 'chip' ? { w: 30, h: 24 } : kind === 'ring' ? { w: 30, h: 30 } : { w: 28, h: 28 };
  /** @type {CSS} */
  const pos =
    place === 'inline'
      ? { position: 'relative', flexShrink: 0 }
      : place === 'middle'
        ? { position: 'absolute', top: '50%', left: kind === 'circle' ? 14 : 12, transform: 'translateY(-50%)' }
        : { position: 'absolute', top: 12, left: 12 };
  /** @type {CSS} */
  const face =
    kind === 'chip'
      ? {
          borderRadius: 5,
          border: `1px solid ${w.chipLine || w.ink}`,
          backgroundColor: w.chip || NEUTRAL.white,
          // The chip's two contact lines, 5px inside its sides (ATMs.dc.html L94).
          backgroundImage: `linear-gradient(${w.chipLine || w.ink}, ${w.chipLine || w.ink}), linear-gradient(${w.chipLine || w.ink}, ${w.chipLine || w.ink})`,
          backgroundSize: '1px 100%, 1px 100%',
          backgroundPosition: '5px 0, calc(100% - 5px) 0',
          backgroundRepeat: 'no-repeat',
          color: w.chipInk || w.ink,
          fontSize: fs(16),
        }
      : kind === 'ring'
        ? { borderRadius: 999, border: `2px solid ${w.iconInk}`, background: NEUTRAL.white, color: w.ink, fontSize: fs(17) }
        : {
            borderRadius: 999,
            border: `1px solid ${w.line}`,
            background: NEUTRAL.white,
            boxShadow: `0 1px 3px ${rgba(NEUTRAL.ink, 0.12)}`,
            color: w.ink,
            fontSize: fs(17),
          };
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        ...pos,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size.w,
        minHeight: size.h,
        boxSizing: 'border-box',
        padding: '0 4px',
        fontFamily: SERIF,
        lineHeight: 1,
        ...face,
        ...style,
      }}
    >
      {n}
    </span>
  );
}

// ── Facts ────────────────────────────────────────────────────────────────

const SOURCES = { google: 'Google', globeskimmers: 'Globeskimmers', gs: 'Globeskimmers' };

function ratingParts({ rating = undefined, value = undefined, count = undefined, source = undefined } = {}) {
  const r = Number(rating ?? value);
  if (!Number.isFinite(r) || r <= 0) return null;
  const src = SOURCES[String(source || '').trim().toLowerCase()];
  if (!src) return null;
  const c = Number(count);
  return { value: r.toFixed(1), count: Number.isFinite(c) && c > 0 ? Math.round(c).toLocaleString('en-US') : null, source: src };
}

/**
 * '★ 4.5 (1,910) Google', or null without a rating or a known source.
 * @param {{ rating?: number|string, value?: number|string, count?: number|string, source?: string }} [r]
 * @returns {string|null}
 */
export function ratingText(r) {
  const p = ratingParts(r || {});
  if (!p) return null;
  return `★ ${p.value}${p.count ? ` (${p.count})` : ''} ${p.source}`;
}

/**
 * @param {{ world?: any, rating?: number|string, value?: number|string, count?: number|string, source?: string }} props
 */
export function RatingFact({ world = undefined, rating = undefined, value = undefined, count = undefined, source = undefined }) {
  const w = worldRow(world);
  const p = ratingParts({ rating, value, count, source });
  if (!p) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <Star size={12} color={w.star} fill={w.star} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
      <span className="sr-only">Rated </span>
      <span style={{ fontWeight: 600 }}>{p.value}</span>
      {p.count ? <span style={{ color: NEUTRAL.ink3 }}>({p.count})</span> : null}
      <span style={{ color: NEUTRAL.ink3 }}>{p.source}</span>
    </span>
  );
}

const TONE = {
  open: { color: NEUTRAL.open, fontWeight: 600 },
  closed: { color: NEUTRAL.stamp, fontWeight: 600 },
  muted: { color: NEUTRAL.ink3, fontWeight: 500 },
  neutral: { color: NEUTRAL.ink2, fontWeight: 500 },
};

/**
 * One facts-line item as it will print, or null when it would print nothing: falsy, blank
 * or a bare 0 (never a zero fragment), a <RatingFact/> whose rating ratingText would hide,
 * and a { rating, count, source } object (drawn as a RatingFact when it has a rating and a
 * named source). Any other plain object prints nothing rather than throwing.
 * @param {any} x
 * @param {any} world
 */
function factOf(x, world) {
  if (!given(x)) return null;
  if (typeof x === 'string') return x.trim() ? x : null;
  if (typeof x === 'number') return Number.isFinite(x) && x !== 0 ? x : null;
  if (React.isValidElement(x)) return x.type === RatingFact && !ratingParts(/** @type {any} */ (x.props)) ? null : x;
  if (Array.isArray(x)) {
    const parts = x.map((y) => factOf(y, world)).filter((y) => y != null);
    return parts.length ? React.Children.toArray(parts) : null;
  }
  if (typeof x === 'object')
    return ratingParts(x) ? <RatingFact world={world} rating={x.rating} value={x.value} count={x.count} source={x.source} /> : null;
  return x;
}

/**
 * @param {{ world?: any, open?: any, place?: any, isLocal?: boolean, items?: any[], className?: string, style?: CSS }} props
 */
export function FactsLine({ world = undefined, open = undefined, place = undefined, isLocal = false, items = [], className = undefined, style = undefined }) {
  const frags = [];
  if (open !== false) {
    const state = open === undefined && place ? openStateFor(place, { isLocal }) : open;
    const o = state && typeof state === 'object' && state.word ? state : { word: 'Hours not listed', tone: 'muted' };
    frags.push(
      <span key="open" style={TONE[o.tone] || TONE.neutral}>
        {o.word}
      </span>,
    );
  }
  (Array.isArray(items) ? items : []).forEach((x, i) => {
    const fact = factOf(x, world);
    if (fact != null)
      frags.push(
        <span key={`f${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {fact}
        </span>,
      );
  });
  if (!frags.length) return null;
  return (
    <p
      className={className}
      style={{
        margin: '4px 0 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 6,
        rowGap: 0,
        fontSize: fs(13),
        lineHeight: 1.4,
        color: NEUTRAL.ink2,
        ...style,
      }}
    >
      {frags.map((f, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <>
              <span aria-hidden="true" style={{ color: NEUTRAL.ink3 }}>
                ·
              </span>
              {/* The dot is drawn; a screen reader hears a pause between the facts. */}
              <span className="sr-only">, </span>
            </>
          ) : null}
          {f}
        </React.Fragment>
      ))}
    </p>
  );
}

// ── Tags ─────────────────────────────────────────────────────────────────

/**
 * @param {{ world?: any, tone?: 'outline'|'wash'|'solid', icon?: any, children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function WorldTag({ world = undefined, tone = 'outline', icon: Icon = undefined, children = undefined, className = undefined, style = undefined }) {
  const w = worldRow(world);
  const t =
    tone === 'wash'
      ? { background: w.wash, border: '1px solid transparent', color: w.washInk, icon: w.washInk }
      : tone === 'solid'
        ? { background: w.ink, border: `1px solid ${w.ink}`, color: NEUTRAL.white, icon: NEUTRAL.white }
        : { background: NEUTRAL.white, border: `1px solid ${w.line}`, color: NEUTRAL.ink2, icon: w.iconInk };
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 24,
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '2px 9px',
        borderRadius: 8,
        background: t.background,
        border: t.border,
        color: t.color,
        fontSize: fs(12),
        lineHeight: 1.2,
        fontWeight: 600,
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      {Icon ? <Icon size={14} color={t.icon} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
      {children}
    </span>
  );
}

/**
 * @param {{ max?: number, children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function TagRow({ max = 3, children = undefined, className = undefined, style = undefined }) {
  const tags = React.Children.toArray(children).filter(Boolean).slice(0, Math.max(0, max));
  if (!tags.length) return null;
  return (
    <div className={className} style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {tags}
    </div>
  );
}

// ── Kicker and name ──────────────────────────────────────────────────────

/**
 * @param {{ world?: any, children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function CardKicker({ world = undefined, children = undefined, className = undefined, style = undefined }) {
  const w = worldRow(world);
  if (!given(children)) return null;
  return (
    <p
      className={className}
      style={{
        margin: 0,
        fontFamily: MONO,
        fontSize: fs(10.5),
        lineHeight: 1.34,
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: w.iconInk,
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

const clamp2 = /** @type {CSS} */ ({ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

/**
 * @param {{ world?: any, as?: any, children?: import('react').ReactNode, leader?: boolean, trailing?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function CardName({ world = undefined, as: As = 'h2', children = undefined, leader = false, trailing = undefined, className = undefined, style = undefined }) {
  const w = worldRow(world);
  /** @type {CSS} */
  const name = { margin: 0, fontFamily: SERIF, fontSize: fs(24), lineHeight: 1.12, fontWeight: 400, color: NEUTRAL.ink, overflowWrap: 'break-word' };
  if (!leader && !given(trailing)) {
    return (
      <As className={className} style={{ ...name, marginTop: 4, ...clamp2, ...style }}>
        {children}
      </As>
    );
  }
  // Eat's menu line: the leader and the distance sit on the name's last line.
  return (
    <div className={className} style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 8, ...style }}>
      <As style={{ ...name, flex: '0 1 auto', minWidth: 0, ...clamp2 }}>{children}</As>
      {leader ? <MenuLeader world={w} variant="card" style={{ marginBottom: 'calc(0.3em * var(--fs, 1) + 3px)' }} /> : <span style={{ flex: 1 }} />}
      {given(trailing) ? (
        <span
          style={{
            flexShrink: 0,
            marginBottom: 'calc(0.25em * var(--fs, 1) + 2px)',
            fontFamily: MONO,
            fontSize: fs(11),
            lineHeight: 1.27,
            fontWeight: 500,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: NEUTRAL.ink3,
            whiteSpace: 'nowrap',
          }}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

// ── Quiet rows ───────────────────────────────────────────────────────────

/**
 * @param {{
 *   world?: any, icon?: any, label?: import('react').ReactNode, children?: import('react').ReactNode,
 *   onClick?: (e: any) => void, href?: string, expanded?: boolean, controls?: string, chevron?: boolean,
 *   className?: string, style?: CSS, [key: string]: any,
 * }} props
 * @param {any} ref
 */
function QuietRowWithRef(
  {
    world = undefined,
    icon: Icon = undefined,
    label = undefined,
    children = undefined,
    onClick = undefined,
    href = undefined,
    expanded = undefined,
    controls = undefined,
    chevron = false,
    className = undefined,
    style = undefined,
    ...rest
  },
  ref,
) {
  const w = worldRow(world);
  const As = href ? 'a' : 'button';
  return (
    <As
      ref={ref}
      type={href ? undefined : 'button'}
      href={href}
      aria-expanded={typeof expanded === 'boolean' ? expanded : undefined}
      aria-controls={controls}
      {...rest}
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        padding: 0,
        background: 'transparent',
        border: 0,
        fontFamily: 'inherit',
        fontSize: fs(12.5),
        lineHeight: 1.2,
        fontWeight: 600,
        color: NEUTRAL.ink2,
        textAlign: 'left',
        textDecoration: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {Icon ? <Icon size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
      <span>{children ?? label}</span>
      {chevron ? (
        <ChevronDown
          size={14}
          color={NEUTRAL.ink3}
          strokeWidth={2}
          aria-hidden="true"
          focusable="false"
          style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}
        />
      ) : null}
    </As>
  );
}
export const QuietRow = React.forwardRef(QuietRowWithRef);
QuietRow.displayName = 'QuietRow';

/**
 * @param {{ world?: any, children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function QuietRows({ world = undefined, children = undefined, className = undefined, style = undefined }) {
  const w = worldRow(world);
  return (
    <div
      className={className}
      style={{
        marginTop: 12,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: 12,
        borderTop: `1px solid ${w.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * @param {{ world?: any, id?: string, order?: number, children?: import('react').ReactNode, className?: string, style?: CSS, [key: string]: any }} props
 */
export function QuietPanel({ world = undefined, id = undefined, order = 2, children = undefined, className = undefined, style = undefined, ...rest }) {
  const w = worldRow(world);
  return (
    <div
      id={id}
      {...rest}
      className={className}
      style={{
        flexBasis: '100%',
        order,
        minWidth: 0,
        boxSizing: 'border-box',
        margin: '4px 0 8px',
        padding: '12px 14px',
        background: NEUTRAL.white,
        border: `1px solid ${w.line}`,
        borderRadius: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

function IconAction({ w, label, icon: Icon, onClick = undefined, href = undefined, external = false, expanded = undefined, controls = undefined }) {
  const As = href ? 'a' : 'button';
  return (
    <As
      type={href ? undefined : 'button'}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      aria-label={label}
      aria-expanded={typeof expanded === 'boolean' ? expanded : undefined}
      aria-controls={controls}
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        boxSizing: 'border-box',
        padding: 0,
        borderRadius: 14,
        background: NEUTRAL.white,
        border: `1px solid ${w.line}`,
        cursor: 'pointer',
      }}
    >
      <Icon size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" />
    </As>
  );
}

/**
 * @param {{
 *   world?: any, name?: string, onDirections?: (e: any) => void, directionsLabel?: string,
 *   onMap?: (e: any) => void, phone?: string|null, onCall?: (e: any) => void, website?: string|null,
 *   onWebsite?: (e: any) => void, onMore?: (e: any) => void, moreLabel?: string, moreIcon?: boolean,
 *   moreExpanded?: boolean, moreControls?: string, extras?: import('react').ReactNode,
 *   className?: string, style?: CSS,
 * }} props
 */
export function ActionRow({
  world = undefined,
  name = '',
  onDirections = undefined,
  directionsLabel = 'Directions',
  onMap = undefined,
  phone = null,
  onCall = undefined,
  website = null,
  onWebsite = undefined,
  onMore = undefined,
  moreLabel = 'More',
  moreIcon = false,
  moreExpanded = undefined,
  moreControls = undefined,
  extras = undefined,
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world);
  const of = name ? ` ${name}` : '';
  const hasPhone = typeof phone === 'string' ? /\d/.test(phone) : phone != null && phone !== false;
  return (
    <div className={className} style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>
      {onDirections ? (
        <button
          type="button"
          onClick={onDirections}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            boxSizing: 'border-box',
            padding: '0 12px',
            borderRadius: 14,
            background: w.cta,
            border: 0,
            fontFamily: 'inherit',
            fontSize: fs(15),
            lineHeight: 1.15,
            fontWeight: w.ctaWeight || 600,
            color: w.ctaInk,
            cursor: 'pointer',
          }}
        >
          <Navigation size={16} color={w.ctaInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
          {directionsLabel}
        </button>
      ) : null}
      {onMap ? <IconAction w={w} label={name ? `Show${of} on the map` : 'Show on the map'} icon={MapIcon} onClick={onMap} /> : null}
      {hasPhone ? <IconAction w={w} label={`Call${of}`} icon={Phone} href={telHref(phone)} onClick={onCall} /> : null}
      {website ? <IconAction w={w} label={name ? `${name} website` : 'Website'} icon={Globe} href={website} external onClick={onWebsite} /> : null}
      {extras}
      {onMore ? (
        moreIcon ? (
          <IconAction w={w} label={`More about${of || ' this place'}`} icon={MoreHorizontal} onClick={onMore} expanded={moreExpanded} controls={moreControls} />
        ) : (
          <button
            type="button"
            onClick={onMore}
            aria-expanded={typeof moreExpanded === 'boolean' ? moreExpanded : undefined}
            aria-controls={moreControls}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              minHeight: 44,
              minWidth: 44,
              boxSizing: 'border-box',
              padding: '0 12px',
              borderRadius: 14,
              background: NEUTRAL.white,
              border: `1px solid ${w.line}`,
              fontFamily: 'inherit',
              fontSize: fs(13),
              lineHeight: 1.15,
              fontWeight: 600,
              color: NEUTRAL.ink2,
              cursor: 'pointer',
            }}
          >
            {moreLabel}
            <ChevronDown
              size={14}
              color={w.iconInk}
              strokeWidth={2}
              aria-hidden="true"
              focusable="false"
              style={{ flexShrink: 0, transform: moreExpanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}
            />
          </button>
        )
      ) : null}
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────

/** @param {{ w?: number|string, h?: number|string, r?: number, mt?: number, style?: CSS }} props */
const Bone = ({ w = '100%', h = 12, r = 6, mt = 0, style = undefined }) => (
  <span className="gs-shimmer" style={{ display: 'block', width: w, height: h, borderRadius: r, marginTop: mt, ...style }} />
);

function SkeletonShape({ variant, w }) {
  if (variant === 'strip') {
    return (
      <div style={{ width: 240, flexShrink: 0, boxSizing: 'border-box', background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16, overflow: 'hidden' }}>
        <Bone h={180} r={0} />
        <div style={{ padding: '10px 12px 12px' }}>
          <Bone w="80%" h={12} />
          <Bone w="50%" h={12} mt={8} />
        </div>
      </div>
    );
  }
  if (variant === 'row') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, boxSizing: 'border-box', padding: '10px 0', borderBottom: `1px solid ${w.line}` }}>
        <Bone w={28} h={28} r={999} />
        <div style={{ flex: 1 }}>
          <Bone w="45%" h={14} />
          <Bone w="70%" h={10} mt={8} />
        </div>
        <Bone w={48} h={14} />
      </div>
    );
  }
  if (variant === 'entry') {
    return (
      <div style={{ boxSizing: 'border-box', padding: 16, background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16 }}>
        <Bone w={56} h={22} r={4} />
        <Bone w="60%" h={22} mt={10} />
        <Bone w="95%" h={12} mt={12} />
        <Bone w="88%" h={12} mt={8} />
        <Bone w="70%" h={12} mt={8} />
      </div>
    );
  }
  return (
    <div style={{ boxSizing: 'border-box', background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 16, overflow: 'hidden' }}>
      <Bone h="auto" r={0} style={{ aspectRatio: w.photoAspect || '16 / 10' }} />
      <div style={{ padding: '12px 16px 16px' }}>
        <Bone w="30%" h={10} />
        <Bone w="70%" h={22} mt={10} />
        <Bone w="85%" h={12} mt={10} />
        <Bone w="55%" h={12} mt={8} />
        <Bone h={44} r={14} mt={14} />
      </div>
    </div>
  );
}

/**
 * @param {{ world?: any, variant?: 'card'|'strip'|'row'|'entry', count?: number, label?: string, className?: string, style?: CSS }} props
 */
export function WorldSkeleton({ world = undefined, variant = 'card', count = 1, label = undefined, className = undefined, style = undefined }) {
  const w = worldRow(world);
  const n = Math.max(1, Math.floor(Number(count) || 1));
  /** @type {CSS} */
  const layout =
    variant === 'strip'
      ? { display: 'flex', gap: 12, overflow: 'hidden' }
      : variant === 'row'
        ? { display: 'flex', flexDirection: 'column' }
        : { display: 'flex', flexDirection: 'column', gap: 12 };
  return (
    <div className={className} style={css({ '--w-wash': w.wash, ...style })}>
      {label ? (
        <span role="status" className="sr-only">
          {label}
        </span>
      ) : null}
      <div aria-hidden="true" style={layout}>
        {Array.from({ length: n }, (_, i) => (
          <SkeletonShape key={i} variant={variant} w={w} />
        ))}
      </div>
    </div>
  );
}
