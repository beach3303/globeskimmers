// FinderHeader: the world plate at the top of every finder (the bible's shared finder
// frame; Eat.dc.html L26-61 and the same plate on every finder board). Every finder is the
// same page printed on a different stock, so only WORLD tokens change from page to page.
//
// What it draws, inside the page's content column (phone: 16px gutters under a 12px mat;
// iPad: the 1024px column with 24px gutters):
//   the plate   radius 22, padding 12 16 18, min-height 164, overflow hidden, in the world's
//               plate colour (Weather's night plate with night). Sets --gs-focus for the
//               controls on it (plateTitle on dark plates, ink on light ones).
//     motif     the world's plate motif (plateMotif; none on Weather and Shopping).
//     row 1     44px back and refresh circles (plateCircle tokens), or a 44px spacer.
//     kicker    mono 10.5 .16em in plateKicker: 'COFFEE · 30 NEAR YOU · …'. The count
//               shows only when it is a number above 0; Eat joins name and count with its
//               menu leader.
//     h1        the page's only h1: Instrument Serif 32/1.05 in plateTitle, max-width
//               titleMax, one <em> in plateAccent.
//     location  min-height 44: MapPin (or location.icon / location.lead) in plateAccent, the
//               place 13/600 in plateMeta (truncating; mono with location.mono), 'Change'
//               underlined in plateLink with a 44px hit area, then the unit pill and any
//               trailing control at the right.
//     belowTitle  the plate's last row (Culture's section index, Culture.dc.html L45-52).
//   the note    one note under the plate (principle 7): `note` (FallbackDisclaimer or
//               AlsoServes), else CityNote when isCity, else `hint` (the page's own hint).
//   children    the page's band under the plate (search, chips, result line), 12px below.
//
// Props:
//   world        WORLD row or key ('eat'; a CAT key or page key also works). catKey is the
//                legacy alias ('food'). night: Weather's after-sunset plate.
//   kicker       the kicker's first words (default WORLD.kickerName, e.g. 'PLACES TO EAT').
//   count        number | null: shown as '{count} {countLabel}' only when above 0.
//   countLabel   default 'near you' (legacy alias countNoun).
//   kickerExtras more fragments after the count: strings or nodes, or { count, label }
//                objects shown only when count is above 0 ('27 OPEN NOW'). Falsy dropped.
//   title        { pre, italic, post } (one italic word), a string ('Places to *eat*' marks
//                the italic; a plain string is printed as is), or a node. Default: the
//                world's title.
//   plateTag     a node hung on the plate (Shopping's <SwingTag size="plate" .../>).
//   belowTitle   a node for the plate's last row.
//   onBack       default window.history.back(). onRefresh: shows the refresh circle;
//                refreshing spins it (not under reduced motion) and disables it
//                (aria-disabled, so focus stays on it); refreshTitle is its name.
//   location     { label, onChange, locating, lead, icon, mono, trailing }. locating
//                prints 'Finding you…'; an empty label prints 'Current location'. onChange
//                adds 'Change'. lead replaces the pin (a node, e.g. a GPS button); icon swaps
//                the pin's lucide icon; trailing goes at the right, after the unit pill.
//   unit         { value, onChange }: the MI/KM pill (DistanceUnitToggle variant 'plate').
//   unitControl  a node instead of the MI/KM pill (Weather's °F/°C).
//   isCity, cityName  the city-level CityNote.
//   note, hint   see 'the note' above. null, undefined and false mean none.
//   children, className, style (the outer column)
// Legacy props still work, so the finders not yet moved keep their kicker and count:
//   catKey, countNoun, a title string, icon (accepted, not drawn), locationKicker (ignored),
//   locationLabel and onChangeLocation (mapped to location).
//
// Also exported: finderColumnStyle(isTablet), the content column the plate sits in, for
// page bands that must line up with it.
import React, { useId } from 'react';
import { ChevronLeft, MapPin, RefreshCw } from 'lucide-react';
import { fs } from '@/components/redesign/constants';
import { plateMotifOf, MenuLeader } from '@/components/finder/motifs';
import DistanceUnitToggle from '@/components/location/DistanceUnitToggle';
import { useIsTablet } from '@/lib/useIsTablet';
import { CityNote, worldRow } from './FinderControls';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

/**
 * A style object that may carry CSS custom properties (--gs-focus).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

const given = (v) => v != null && v !== false;

/**
 * The finder content column: 16px gutters on a phone (448px max), the 1024px column with
 * 24px gutters on iPad. The plate and the page's bands share it.
 * @param {boolean} isTablet
 * @returns {CSS}
 */
export function finderColumnStyle(isTablet) {
  return {
    width: '100%',
    maxWidth: isTablet ? 1024 : 448,
    margin: '0 auto',
    padding: isTablet ? '0 24px' : '0 16px',
    boxSizing: 'border-box',
  };
}

// 'Places to *eat*' -> { pre: 'Places to ', italic: 'eat', post: '' }.
function titleParts(title, w) {
  if (title && typeof title === 'object' && !React.isValidElement(title)) {
    return { pre: title.pre || '', italic: title.italic || '', post: title.post || '' };
  }
  if (typeof title === 'string') {
    const m = /^([^*]*)\*([^*]+)\*([^*]*)$/.exec(title);
    return m ? { pre: m[1], italic: m[2], post: m[3] } : { pre: title, italic: '', post: '' };
  }
  return w.title || { pre: '', italic: '', post: '' };
}

const fmtCount = (n) => n.toLocaleString('en-US');

function countFragment(count, label) {
  const n = Number(count);
  if (count == null || count === '' || !Number.isFinite(n) || n <= 0) return null;
  return `${fmtCount(n)} ${label}`.trim();
}

function extraFragments(extras) {
  const list = Array.isArray(extras) ? extras : given(extras) ? [extras] : [];
  return list
    .map((x) => {
      if (!given(x) || x === '') return null;
      if (typeof x === 'object' && !React.isValidElement(x) && 'count' in x) return countFragment(x.count, x.label || '');
      return x;
    })
    .filter(Boolean);
}

// A 44px plate circle. While busy (refreshing) it stays focusable but inert: aria-disabled
// and no click, so a keyboard user's focus isn't dropped mid-refresh.
function Circle({ label, onClick, busy = false, plate, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={busy ? undefined : onClick}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 44,
        height: 44,
        boxSizing: 'border-box',
        padding: 0,
        borderRadius: 999,
        background: plate.bg,
        border: `1px solid ${plate.border}`,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/**
 * @param {{
 *   world?: any, catKey?: string, night?: boolean,
 *   kicker?: import('react').ReactNode, count?: number|null, countLabel?: string, countNoun?: string,
 *   kickerExtras?: any, title?: any, plateTag?: import('react').ReactNode, belowTitle?: import('react').ReactNode,
 *   onBack?: () => void, onRefresh?: () => void, refreshing?: boolean, refreshTitle?: string,
 *   location?: { label?: string|null, onChange?: () => void, locating?: boolean, lead?: import('react').ReactNode, icon?: any, mono?: boolean, trailing?: import('react').ReactNode },
 *   unit?: { value?: string|null, onChange?: (u: string) => void }, unitControl?: import('react').ReactNode,
 *   locationLabel?: string|null, onChangeLocation?: () => void, locationKicker?: string, icon?: any,
 *   isCity?: boolean, cityName?: string, note?: import('react').ReactNode, hint?: import('react').ReactNode,
 *   children?: import('react').ReactNode, className?: string, style?: CSS,
 * }} props
 */
export default function FinderHeader({
  world = undefined,
  catKey = undefined,
  night = false,
  kicker = undefined,
  count = null,
  countLabel = undefined,
  countNoun = undefined,
  kickerExtras = undefined,
  title = undefined,
  plateTag = undefined,
  belowTitle = undefined,
  onBack = undefined,
  onRefresh = undefined,
  refreshing = false,
  refreshTitle = 'Refresh',
  location = undefined,
  unit = undefined,
  unitControl = undefined,
  locationLabel = undefined,
  onChangeLocation = undefined,
  locationKicker: _locationKicker = undefined, // legacy, ignored: the plate has no location kicker
  icon: _icon = undefined, // legacy, accepted and unused: the plate's motif is the world's own
  isCity = false,
  cityName = undefined,
  note = undefined,
  hint = undefined,
  children = undefined,
  className = undefined,
  style = undefined,
}) {
  const isTablet = useIsTablet();
  const titleId = useId();
  const w = worldRow(given(world) ? world : catKey, { night });
  const Motif = plateMotifOf(w);

  // Kicker: name, then the count (only when real), then the extras.
  const name = given(kicker) ? kicker : w.kickerName;
  const hasName = given(name) && name !== '';
  const countText = countFragment(count, countLabel ?? countNoun ?? 'near you');
  const extras = extraFragments(kickerExtras);
  const leader = w.key === 'eat' && !!countText;
  const after = leader ? extras : [countText, ...extras].filter(Boolean);
  // A long kicker sets tighter (.12em), as the Convenience board does for its three
  // fragments (Convenience.dc.html L32); it still wraps rather than clip.
  const kickerChars = [hasName ? name : '', ...(leader ? [countText] : []), ...after]
    .map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : ''))
    .join(' · ').length;
  const kickerSpacing = kickerChars > 38 ? '.12em' : '.16em';

  const t = titleParts(title, w);
  const titleNode = React.isValidElement(title) ? title : (
    <>
      {t.pre}
      {t.italic ? <em style={{ fontStyle: 'italic', color: w.plateAccent }}>{t.italic}</em> : null}
      {t.post}
    </>
  );

  // Location: the new prop, else the legacy pair.
  const loc = location || (locationLabel !== undefined || onChangeLocation ? { label: locationLabel, onChange: onChangeLocation } : null);
  const PinIcon = loc && loc.icon ? loc.icon : MapPin;
  const unitNode = given(unitControl)
    ? unitControl
    : unit && typeof unit.onChange === 'function'
      ? <DistanceUnitToggle variant="plate" world={w} unit={unit.value ?? null} setUnit={unit.onChange} />
      : null;
  const trailing = loc && given(loc.trailing) ? loc.trailing : null;
  const placeText = loc ? (loc.locating ? 'Finding you…' : loc.label || 'Current location') : null;

  // One note at a time: the page's note, else the city line, else the page's hint.
  let noteNode = null;
  if (given(note)) noteNode = note;
  else if (isCity) noteNode = <CityNote world={w} cityName={cityName} />;
  else if (given(hint)) noteNode = hint;

  const back = onBack || (() => window.history.back());

  return (
    <div className={className} style={{ ...finderColumnStyle(isTablet), paddingTop: 12, ...style }}>
      <section
        aria-labelledby={titleId}
        style={css({
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          minHeight: 164,
          padding: given(belowTitle) ? '12px 16px 8px' : '12px 16px 18px',
          borderRadius: 22,
          background: w.plate,
          '--gs-focus': w.plateFocus,
        })}
      >
        {Motif ? <Motif world={w} variant="plate" /> : null}
        {given(plateTag) ? plateTag : null}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Circle label="Back" onClick={back} plate={w.plateCircle}>
            <ChevronLeft size={20} color={w.plateCircle.icon} strokeWidth={2} aria-hidden="true" focusable="false" />
          </Circle>
          {onRefresh ? (
            <Circle label={refreshTitle} onClick={onRefresh} busy={refreshing} plate={w.plateCircle}>
              <RefreshCw
                size={18}
                color={w.plateCircle.icon}
                strokeWidth={2}
                aria-hidden="true"
                focusable="false"
                className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
              />
            </Circle>
          ) : (
            <span aria-hidden="true" style={{ display: 'block', width: 44, height: 44, flexShrink: 0 }} />
          )}
        </div>

        {hasName || after.length || leader ? (
          <p
            style={{
              position: 'relative',
              margin: '6px 0 0',
              display: leader ? 'flex' : 'block',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 10,
              fontFamily: MONO,
              fontSize: fs(10.5),
              lineHeight: 1.34,
              fontWeight: 500,
              letterSpacing: kickerSpacing,
              textTransform: 'uppercase',
              color: w.plateKicker,
              overflowWrap: 'break-word',
            }}
          >
            {hasName ? <span>{name}</span> : null}
            {leader ? (
              <>
                <MenuLeader world={w} variant="inline" />
                <span className="sr-only">, </span>
                <span>{countText}</span>
              </>
            ) : null}
            {after.map((frag, i) => (
              <React.Fragment key={i}>
                {i > 0 || hasName || leader ? (
                  <>
                    {' '}
                    <span aria-hidden="true">·</span>{' '}
                  </>
                ) : null}
                <span>{frag}</span>
              </React.Fragment>
            ))}
          </p>
        ) : null}

        <h1
          id={titleId}
          style={{
            position: 'relative',
            margin: '4px 0 0',
            maxWidth: w.titleMax || '72%',
            fontFamily: SERIF,
            fontSize: fs(32),
            lineHeight: 1.05,
            fontWeight: 400,
            color: w.plateTitle,
            overflowWrap: 'break-word',
          }}
        >
          {titleNode}
        </h1>

        {loc || unitNode || trailing ? (
          <div style={{ position: 'relative', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
            {loc ? (
              <>
                {given(loc.lead) ? (
                  loc.lead
                ) : (
                  <PinIcon size={14} color={w.plateAccent} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    color: w.plateMeta,
                    ...(loc.mono
                      ? { fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', lineHeight: 1.34 }
                      : { fontSize: fs(13), fontWeight: 600, lineHeight: 1.4 }),
                  }}
                >
                  {placeText}
                </span>
                {loc.onChange ? (
                  <button
                    type="button"
                    onClick={loc.onChange}
                    aria-label="Change location"
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 44,
                      minHeight: 44,
                      padding: 0,
                      background: 'transparent',
                      border: 0,
                      fontFamily: 'inherit',
                      fontSize: fs(13),
                      fontWeight: 500,
                      color: w.plateLink,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                ) : null}
              </>
            ) : null}
            {unitNode || trailing ? (
              <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {unitNode}
                {trailing}
              </div>
            ) : null}
          </div>
        ) : null}

        {given(belowTitle) ? <div style={{ position: 'relative' }}>{belowTitle}</div> : null}
      </section>

      {noteNode ? <div style={{ marginTop: 8 }}>{noteNode}</div> : null}
      {given(children) ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}
