// Zone: Home's zones and the folders they share with the profile, visit and circle pages.
//
// The new look prints each part of Home on its own stock (ZONE in ./constants). Option B,
// boxed folders, ships for everyone (Home-Boxes.dc.html). Option A, full-width bands
// (Main.dc.html), is built behind the same switch as a preview only: an admin-only row in
// Settings stores a per-device choice, and ?zones=bands selects it on the web for the
// screenshot rig. Nothing else may select it (flags.js HOME_ZONE_STYLE).
//
//   useHomeZoneStyle()        'boxes' | 'bands'. Reads ?zones= (web only, never in the native
//                             app), then localStorage gs_home_zone_style, then
//                             HOME_ZONE_STYLE. Re-renders on 'gs:home-zone-style', 'storage'
//                             and 'popstate'.
//   setHomeZoneStyle(value)   Stores 'boxes' or 'bands' on this device (anything else clears
//                             the choice, back to HOME_ZONE_STYLE), then tells every mounted
//                             zone. For Settings' admin row.
//   useZone()                 Inside a HomeZone: { zone, variant, step, label }; else null.
//                             A zone's content can ask which variant it is printed in.
//
//   <HomeZone zone label onPress ariaLabel wide>   One Home zone, as a <section data-zone
//        data-zone-variant data-zone-step> named by its h2 (the tab, or the band's kicker).
//        label: the tab/kicker words (default: the zone's name below). onPress: the whole
//        box (or the whole band) becomes one <button aria-label={ariaLabel}>, with the h2
//        outside it, pressed in the zone's pressed colour (ZONE.passport.navyPressed; a
//        zone without one keeps its fill); its content must then be phrasing content
//        (spans, not divs or headings). wide: always use the 720px iPad column.
//        Renders nothing when it has no children; a zone component that has nothing honest
//        to show returns null itself. Zone components render their HomeZone as their root,
//        so the sections are direct siblings and the 6px seam between same-step bands
//        (index.css) applies. Zones set no text colour, as on the boards: the content
//        colours its own words (ZONE title, accent, meta), and light tiles inside a dark
//        zone keep the page's ink for anything they don't colour (an image's alt text).
//        Optional: variant (force 'boxes' or 'bands', e.g. in a test), kicker ('top', the
//        default: the band opens with its kicker row; 'inline': the content places
//        <ZoneKicker /> itself, as the passport band does beside its stamp tile, Main
//        L56-60), kickerGap (bands: the space under a top kicker row, default 8; the
//        services chip row wants 12), className, style (on the section).
//        Boxes: px-4 and a max-w-md column (720px from md), 16px above each box, the tab as
//          the h2, then the folder at size 'home' with ZONE.padBox. A zone whose box padding
//          has no right side (services) gets a 16px fade in its fill on the right edge.
//          Every tab is gold with navy caps (HOME_TAB, 2026-10-17). boxPadding replaces
//          ZONE.padBox and tabStyle restyles one box's tab (the passport: shorter, its name in
//          the serif).
//        Bands: a full-bleed fill with ZONE.padBand around the same column, opened by a
//          kicker row (the h2 and a hairline in ZONE.rule). Passport: gold double rule;
//          circle: 5px airmail chevron; stamps: perforated top edge pulled 4px over the band
//          above, so that band (the kraft) shows through the holes; shelf: brass hairlines.
//          Bands abut; the passport band, always first, keeps 16px of ground under the
//          lobby, so the lobby is the same in both variants. Every band's column lines up
//          with the lobby's; the services content runs past it to the right by 16px (the
//          screen edge on a phone). Bands clip sideways and never use 100vw. A band that is
//          one button rings inside its edge in ZONE.focus.
//   <ZoneKicker gap />        The band's kicker row where a kicker='inline' zone wants it;
//        nothing in boxes (the tab is the name there). gap: space under it, bands only
//        (default 0). Hidden from screen readers: HomeZone gives the band a visually hidden
//        h2 with the same words. A span row, so it is valid inside the band's button.
//
//   <FolderTab tone size as>  The tab on a folder: the caller's words in mono caps on the
//        zone's deep colour, 16px from the left, overlapping the box's top edge by 1px.
//        size 'home' (Home-Boxes: 28px, the passport and shelf tabs keep their border) or
//        'profile' (Profile, Visit: 24px). as: the element, 'h2' by default. Grows and
//        wraps with the text size instead of clipping.
//   <Folder stock tab size chevron padding as>  A folder: the optional tab above a box in
//        the stock's fill, 1px line and radius (no text colour, like HomeZone). size
//        'profile' (the default) or 'home'. passport: the gold border and the only shadow
//        at both sizes; the inner gold keyline only at 'home' (padding 22 18 18), none at
//        'profile' (16 12 12). circle: overflow hidden and a 4px airmail chevron inside the
//        top edge (chevron false to drop it). padding overrides the size's default. as: the
//        box element ('div'; 'button' or 'a' makes the whole box one control, pressed in
//        the zone's pressed colour). The box sets --gs-focus to ZONE.focus for the controls
//        inside it; a box that is itself the control rings in NEUTRAL.tealInk, outside
//        it on the page ground. Other props: tabAs, tabId, className and style (the
//        wrapper: margins), boxClassName and boxStyle (the box), and anything else
//        (onClick, aria-*, id) on the box.
import React, { createContext, useContext, useId, useMemo, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { HOME_ZONE_STYLE } from '@/lib/flags';
import { NEUTRAL, ZONE, fs, rgba } from './constants';
import { AirmailChevron, BrassHairlines, GoldDoubleRule, GoldKeyline } from './ornaments';

/** @typedef {import('react').CSSProperties} CSS */

/**
 * A style object that may carry CSS custom properties (--gs-focus, --gs-pressed), which
 * React's CSSProperties type doesn't list.
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const cx = (...names) => names.filter(Boolean).join(' ');

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const zoneOf = (key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(ZONE, key) ? ZONE[key] : null);

// ── The switch ───────────────────────────────────────────────────────────

export const HOME_ZONE_STYLES = Object.freeze(['boxes', 'bands']);
const STORE_KEY = 'gs_home_zone_style';
const CHANGE_EVENT = 'gs:home-zone-style';

const validStyle = (v) => (v === 'boxes' || v === 'bands' ? v : null);

// ?zones=boxes|bands, only on the web (the screenshot rig). The native app never reads it.
function styleFromUrl() {
  try {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return null;
    return validStyle(new URLSearchParams(window.location.search).get('zones'));
  } catch {
    return null;
  }
}

function styleFromStore() {
  try {
    return validStyle(window.localStorage.getItem(STORE_KEY));
  } catch {
    return null; // storage blocked (private mode) or no window
  }
}

const defaultStyle = () => validStyle(HOME_ZONE_STYLE) || 'boxes';
const currentStyle = () => styleFromUrl() || styleFromStore() || defaultStyle();

function subscribeStyle(onChange) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

/** @returns {'boxes'|'bands'} */
export function useHomeZoneStyle() {
  return useSyncExternalStore(subscribeStyle, currentStyle, defaultStyle);
}

/** @param {string|null} [value] 'boxes' or 'bands'; anything else clears the device's choice. */
export function setHomeZoneStyle(value) {
  const v = validStyle(value);
  try {
    if (v) window.localStorage.setItem(STORE_KEY, v);
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Storage blocked: the choice lasts until the page reloads, at most.
  }
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // No window.
  }
}

// ── Shared pieces ────────────────────────────────────────────────────────

const ZoneFrame = createContext(null);

/** @returns {{ zone: string, variant: 'boxes'|'bands', step: string, label: any } | null} */
export function useZone() {
  return useContext(ZoneFrame);
}

// The tab and kicker words when the caller gives none.
const ZONE_LABEL = {
  passport: 'My Virtual Passport',
  circle: 'Your circle',
  services: 'Nearby services',
  stamps: 'Stamps near you',
  shelf: 'Stamp shelf',
  local: 'Local favorites',
  kit: 'My kit',
  rows: 'Around you',
};

// A CSS padding shorthand as its four sides.
function padSides(padding) {
  const [t = '0', r = t, b = t, l = r] = String(padding || '').trim().split(/\s+/).filter(Boolean);
  return { t, r, b, l };
}

// The right side of a padding is 0: the content bleeds to that edge (services: the chip
// row runs off the right edge, Home-Boxes L122, Main L121).
const bleedsRight = (padding) => /^0(px)?$/.test(padSides(padding).r);

// The iPad column: max-w-md on phones, 720px from md (or always, when wide).
const columnClass = (wide) => (wide ? 'mx-auto max-w-[720px]' : 'mx-auto max-w-md md:max-w-[720px]');

// Pressed fill on a box or band that is one control: the zone's pressed colour, carried
// in --gs-pressed. !important so it wins over the inline fill while pressed.
const PRESS_CLASS = 'active:![background:var(--gs-pressed)]';

// Profile and Visit folders are cut tighter than Home's (Profile.dc.html L80, L130, L169,
// L188; Profile-Visit L135).
const PROFILE_PAD = { passport: '16px 12px 12px', circle: '20px 16px 16px' };
// Home boxes that clip their content at the rounded edge (Home-Boxes L72, L122, L151,
// L192): rows bleed to the box edge, and the circle's chevron runs inside the top edge.
// rows (the iPad folder, plan-authored) holds bleeding rows too.
const HOME_CLIP = { circle: true, services: true, stamps: true, shelf: true, rows: true };

// ── Folder ───────────────────────────────────────────────────────────────

/**
 * @param {{ tone: string, size?: 'home'|'profile', as?: any, id?: string, className?: string, style?: CSS, children?: import('react').ReactNode }} props
 */
export function FolderTab({ tone, size = 'profile', as: Tag = 'h2', id = undefined, className = undefined, style = undefined, children = null }) {
  const z = zoneOf(tone);
  if (!z) return null;
  const home = size === 'home';
  // Home-Boxes L55: 29px with the 1px that covers the box's top border (28 visible);
  // Profile L79: 24px. The vertical padding keeps the board's text centre and gives a
  // wrapped second line room.
  const edge = home && z.tabBorder ? `1px solid ${z.tabBorder}` : null;
  return (
    <Tag
      id={id}
      className={className}
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        width: 'fit-content',
        maxWidth: 'calc(100% - 32px)',
        minHeight: home ? 29 : 24,
        boxSizing: 'border-box',
        margin: '0 0 -1px 16px',
        padding: home ? '4px 12px 5px 14px' : '4px 12px',
        borderRadius: '10px 10px 0 0',
        background: z.tab,
        ...(edge ? { borderTop: edge, borderLeft: edge, borderRight: edge } : null),
        fontFamily: MONO,
        fontSize: fs(9.5),
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        overflowWrap: 'anywhere',
        color: z.tabLabel,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * @param {{ stock: string, tab?: import('react').ReactNode, size?: 'home'|'profile', chevron?: boolean, padding?: string, as?: any, tabAs?: any, tabId?: string, className?: string, style?: CSS, boxClassName?: string, boxStyle?: CSS, children?: import('react').ReactNode, [key: string]: any }} props
 */
export function Folder({
  stock,
  tab = null,
  size = 'profile',
  chevron = undefined,
  padding = undefined,
  as: Box = 'div',
  tabAs = 'h2',
  tabStyle = undefined,
  tabId = undefined,
  className = undefined,
  style = undefined,
  boxClassName = undefined,
  boxStyle = undefined,
  children = null,
  ...rest
}) {
  const z = zoneOf(stock);
  if (!z) return null;
  const home = size === 'home';
  const passport = z.key === 'passport';
  const withChevron = chevron ?? z.key === 'circle';
  const clip = withChevron || (home && HOME_CLIP[z.key] === true);
  const control = Box === 'button' || Box === 'a' || typeof rest.onClick === 'function';
  const hasTab = tab !== null && tab !== undefined && tab !== false && tab !== '';

  return (
    // No stacking context on the wrapper (as on the boards): the tab's z-index only has to
    // beat its own box, and a menu that opens inside a folder can still overlap the next.
    <div className={className} style={style}>
      {hasTab ? (
        <FolderTab tone={z.key} size={size} as={tabAs} id={tabId} style={tabStyle}>
          {tab}
        </FolderTab>
      ) : null}
      <Box
        {...(Box === 'button' ? { type: 'button' } : null)}
        {...rest}
        className={cx(control && PRESS_CLASS, boxClassName)}
        style={css({
          position: 'relative',
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          margin: 0,
          padding: padding ?? (home ? z.padBox : PROFILE_PAD[z.key] || '16px'),
          borderRadius: z.radius,
          background: z.fill,
          border: `1px solid ${z.line}`,
          ...(passport ? { boxShadow: z.shadow } : null),
          ...(clip ? { overflow: 'hidden' } : null),
          ...(control
            ? { textAlign: 'left', color: 'inherit', cursor: 'pointer', '--gs-pressed': z.navyPressed || z.fill }
            : null),
          '--gs-focus': control ? NEUTRAL.tealInk : z.focus,
          ...boxStyle,
        })}
      >
        {passport && home ? <GoldKeyline /> : null}
        {withChevron ? <AirmailChevron height={4} absolute /> : null}
        {children}
      </Box>
    </div>
  );
}

// ── Home zones ───────────────────────────────────────────────────────────

// A band whose padding has no right side (services) is padded like the others, so its
// column lines up with theirs at every width, and its content then reaches past the
// column's right edge by the left padding: to the screen edge on a phone, as on the board.
// The kicker row keeps that inset, so its hairline ends where the other bands' do.
function bandBleed(z) {
  const p = padSides(z.padBand);
  if (!bleedsRight(z.padBand)) return { padding: z.padBand, inset: undefined, reach: undefined };
  return { padding: `${p.t} ${p.l} ${p.b} ${p.l}`, inset: p.l, reach: `calc(-1 * ${p.l})` };
}

// The band's opening row: the zone's name in mono caps and a hairline to the edge
// (Main.dc.html L57-60, L72-75, L122-125, L160-163, L198-201, L279-282). Hidden (a span
// row, valid inside a button, and aria-hidden) when the band is one button or the
// content places it: a visually hidden h2 then carries the words.
function KickerRow({ z, label, id = undefined, hidden = false, inset = undefined, gap = 8 }) {
  const passport = z.key === 'passport';
  const size = passport ? 10 : 10.5;
  const Row = hidden ? 'span' : 'div';
  const Name = hidden ? 'span' : 'h2';
  return (
    <Row
      aria-hidden={hidden ? 'true' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: gap, paddingRight: inset }}
    >
      <Name
        id={id}
        style={{
          display: 'block',
          minWidth: 0,
          margin: 0,
          fontFamily: MONO,
          fontSize: fs(size),
          fontWeight: 500,
          lineHeight: 14 / size,
          letterSpacing: passport ? '.2em' : '.14em',
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
          color: z.kicker,
        }}
      >
        {label}
      </Name>
      <span aria-hidden="true" style={{ flex: '1 1 0%', minWidth: 24, height: 1, background: z.rule }} />
    </Row>
  );
}

/**
 * @param {{ gap?: number }} props
 */
export function ZoneKicker({ gap = 0 }) {
  const frame = useZone();
  const z = frame && frame.variant === 'bands' ? zoneOf(frame.zone) : null;
  if (!z) return null;
  return <KickerRow z={z} label={frame.label} hidden inset={bandBleed(z).inset} gap={gap} />;
}

// The board's one ornament per band (bible.home.separation).
function BandOrnament({ zone }) {
  if (zone === 'passport') return <GoldDoubleRule />;
  if (zone === 'circle') return <AirmailChevron height={5} absolute />;
  if (zone === 'shelf') return <BrassHairlines />;
  return null;
}

/**
 * @param {{ zone: string, label?: import('react').ReactNode, onPress?: (e: any) => void, ariaLabel?: string, wide?: boolean, variant?: 'boxes'|'bands', kicker?: 'top'|'inline', kickerGap?: number, className?: string, style?: CSS, children?: import('react').ReactNode }} props
 */
// Every Home tab in one gold with navy caps (founder, 2026-10-17: "for consistency let's make all
// tab with same background color as my virtual passport"). A zone's tabStyle still goes on top.
export const HOME_TAB = {
  background: 'linear-gradient(180deg, #F7D37C, #E3AE45)',
  color: NEUTRAL.navy,
  fontWeight: 700,
  borderTop: '1px solid rgba(178,128,38,.55)',
  borderLeft: '1px solid rgba(178,128,38,.55)',
  borderRight: '1px solid rgba(178,128,38,.55)',
  boxShadow: '0 2px 6px -2px rgba(227,174,69,.7)',
};

export function HomeZone({
  zone,
  label = undefined,
  onPress = undefined,
  ariaLabel = undefined,
  wide = false,
  variant = undefined,
  kicker = 'top',
  kickerGap = 8,
  boxPadding = undefined,
  tabStyle = undefined,
  className = undefined,
  style = undefined,
  children = null,
}) {
  const chosen = useHomeZoneStyle();
  const headId = useId();
  const z = zoneOf(zone);
  const kind = validStyle(variant) || chosen;
  const key = z ? z.key : null;
  const step = z ? z.step : null;
  const text = label ?? (key ? ZONE_LABEL[key] : null) ?? '';
  const frame = useMemo(() => (key ? { zone: key, variant: kind, step, label: text } : null), [key, kind, step, text]);

  if (!z || React.Children.toArray(children).length === 0) return null;

  const pressable = typeof onPress === 'function';
  const topKicker = kicker !== 'inline';
  const name = ariaLabel || (typeof text === 'string' ? text : undefined);
  const data = { 'data-zone': z.key, 'data-zone-variant': kind, 'data-zone-step': z.step };

  if (kind === 'boxes') {
    return (
      <ZoneFrame.Provider value={frame}>
        <section {...data} aria-labelledby={headId} className={cx('px-4', className)} style={{ marginTop: 16, ...style }}>
          <div className={columnClass(wide)}>
            <Folder
              stock={z.key}
              size="home"
              tab={text}
              tabId={headId}
              tabStyle={tabStyle ? { ...HOME_TAB, ...tabStyle } : HOME_TAB}
              padding={boxPadding}
              as={pressable ? 'button' : 'div'}
              onClick={pressable ? onPress : undefined}
              aria-label={pressable ? name : undefined}
            >
              {children}
              {bleedsRight(z.padBox) ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 16,
                    background: `linear-gradient(90deg, ${rgba(z.fill, 0)}, ${z.fill})`,
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </Folder>
          </div>
        </section>
      </ZoneFrame.Provider>
    );
  }

  // Bands. No inline margin-top except the passport's: the seam rule in index.css must be
  // able to set 6px between same-step neighbours (the stamps band's -4px is a class for
  // the same reason). The h2 is the visible kicker, unless the kicker sits inside the
  // band's button or inside the content (kicker 'inline'): then a visually hidden h2
  // carries the words and the kicker row is hidden from screen readers.
  const bleed = bandBleed(z);
  const perforated = z.key === 'stamps';
  const hiddenHead = pressable || !topKicker;
  const kickerRow = topKicker ? (
    <KickerRow z={z} label={text} id={hiddenHead ? undefined : headId} hidden={hiddenHead} inset={bleed.inset} gap={kickerGap} />
  ) : null;
  const Reach = pressable ? 'span' : 'div';
  const content = bleed.reach ? (
    <Reach style={{ display: 'block', marginRight: bleed.reach }}>
      {kickerRow}
      {children}
    </Reach>
  ) : (
    <>
      {kickerRow}
      {children}
    </>
  );
  return (
    <ZoneFrame.Provider value={frame}>
      <section
        {...data}
        aria-labelledby={headId}
        className={cx('overflow-x-clip', perforated && 'gs-perf -mt-[4px]', className)}
        style={css({
          position: 'relative',
          background: z.fill,
          '--gs-focus': z.focus,
          ...(z.key === 'passport' ? { marginTop: 16 } : null),
          ...(pressable ? null : { padding: bleed.padding }),
          ...style,
        })}
      >
        <BandOrnament zone={z.key} />
        {hiddenHead ? (
          <h2 id={headId} className="sr-only">
            {text}
          </h2>
        ) : null}
        {pressable ? (
          <button
            type="button"
            aria-label={name}
            onClick={onPress}
            className={PRESS_CLASS}
            style={css({
              display: 'block',
              width: '100%',
              margin: 0,
              padding: bleed.padding,
              textAlign: 'left',
              background: 'transparent',
              border: 0,
              color: 'inherit',
              cursor: 'pointer',
              // The band is the whole width: ring inside it, in the zone's focus colour.
              outlineOffset: -4,
              '--gs-pressed': z.navyPressed || 'transparent',
            })}
          >
            <span className={columnClass(wide)} style={{ display: 'block' }}>
              {content}
            </span>
          </button>
        ) : (
          <div className={columnClass(wide)}>{content}</div>
        )}
      </section>
    </ZoneFrame.Provider>
  );
}

export default HomeZone;
