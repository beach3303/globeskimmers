// FinderControls: the controls every finder world shares, printed in that world's tokens
// (WORLD in redesign/constants; the bible's shared finder frame). Pages pass `world` as a
// WORLD row or any key worldOf() reads ('eat', the old CAT key 'food', the page key
// 'PlacesToEat'); an unknown world falls back to NEUTRAL_WORLD (ink on ivory).
//
//   worldRow(world, { night })  the WORLD row for a row or key (Weather's night plate with
//        night), else NEUTRAL_WORLD. For components that take a world prop.
//   NEUTRAL_WORLD               a world-shaped row in the shared neutrals.
//
//   <WorldNote world icon title action role>  The page's one note (principle 7), on the
//        world wash: a 16px lucide icon (Info by default) in washInk, an optional title in
//        the world ink, the body in washInk 13px, and an optional action (a node, or
//        { label, onClick }) as an underlined world-ink link with a 44px hit area. role
//        'note' by default (pass 'status' for a note that should be announced). Text wraps.
//   <CityNote world cityName>   The city-level line: 'Showing places across {city}:
//        {CITY_DISCLAIMER}', a WorldNote. FinderHeader renders it when isCity and no other
//        note is given; it replaces the old weather-yellow Lightbulb callout.
import React from 'react';
import { Info } from 'lucide-react';
import { NEUTRAL, worldOf, fs } from '@/components/redesign/constants';
import { CITY_DISCLAIMER } from '@/components/location/locationLabel';

/** @typedef {import('react').CSSProperties} CSS */

// A world-shaped row in the shared neutrals, for a world nobody recognises.
export const NEUTRAL_WORLD = Object.freeze({
  key: null,
  variant: 'day',
  label: '',
  kickerName: '',
  title: Object.freeze({ pre: '', italic: '', post: '' }),
  mode: 'light',
  paper: NEUTRAL.ivory,
  plate: NEUTRAL.ivory2,
  plateSolid: NEUTRAL.ivory2,
  plateTitle: NEUTRAL.ink,
  plateKicker: NEUTRAL.ink2,
  plateAccent: NEUTRAL.tealInk,
  plateMeta: NEUTRAL.ink,
  plateLink: NEUTRAL.ink,
  plateFocus: NEUTRAL.tealInk,
  plateMotif: null,
  ink: NEUTRAL.ink,
  accentText: null,
  iconInk: NEUTRAL.tealInk,
  star: NEUTRAL.ink,
  cta: NEUTRAL.tealInk,
  ctaInk: NEUTRAL.white,
  ctaWeight: 600,
  wash: NEUTRAL.ivory2,
  washInk: NEUTRAL.ink,
  line: NEUTRAL.rule,
  titleMax: '72%',
  plateCircle: Object.freeze({ bg: NEUTRAL.white, border: NEUTRAL.rule, icon: NEUTRAL.ink }),
  unitPill: Object.freeze({ track: NEUTRAL.white, border: NEUTRAL.rule, on: NEUTRAL.ink, onInk: NEUTRAL.white, off: NEUTRAL.ink2 }),
  chipOn: NEUTRAL.ink,
  chipOnInk: NEUTRAL.white,
  chipDot: null,
  cardShadow: 'none',
  numberShape: 'circle',
  photoAspect: '16 / 10',
  strip: Object.freeze({ height: 72, bg: NEUTRAL.ivory2 }),
  rangeGradient: null,
});

/**
 * The WORLD row for a row or a key; Weather's night plate with { night: true }.
 * @param {any} world
 * @param {{ night?: boolean }} [opts]
 */
export function worldRow(world, opts) {
  const night = !!(opts && opts.night);
  if (world && typeof world === 'object') {
    if (night && world.night && typeof world.night === 'object') return world.night;
    return world;
  }
  return worldOf(world, { night }) || NEUTRAL_WORLD;
}

// ── Notes ────────────────────────────────────────────────────────────────

function NoteAction({ action, color }) {
  if (!action) return null;
  if (React.isValidElement(action)) return action;
  if (typeof action !== 'object' || !action.label) return null;
  return (
    <button
      type="button"
      onClick={action.onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
        // The 44px hit area reaches past the note's padding instead of padding the note.
        margin: '-6px 0 -12px',
        padding: 0,
        background: 'transparent',
        border: 0,
        fontFamily: 'inherit',
        fontSize: fs(13),
        fontWeight: 600,
        color,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {action.label}
    </button>
  );
}

/**
 * @param {{
 *   world?: any, icon?: any, title?: import('react').ReactNode, action?: any,
 *   children?: import('react').ReactNode, role?: string, id?: string,
 *   className?: string, style?: CSS,
 * }} props
 */
export function WorldNote({
  world = undefined,
  icon: Icon = Info,
  title = undefined,
  action = undefined,
  children = undefined,
  role = 'note',
  id = undefined,
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world);
  const hasBody = children != null && children !== false && children !== '';
  return (
    <div
      id={id}
      role={role}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxSizing: 'border-box',
        padding: '10px 14px',
        borderRadius: 14,
        background: w.wash,
        color: w.washInk,
        fontSize: fs(13),
        lineHeight: 1.5,
        fontWeight: 500,
        overflowWrap: 'break-word',
        ...style,
      }}
    >
      {Icon ? <Icon size={16} color={w.washInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title != null && title !== false && <div style={{ fontWeight: 600, color: w.ink }}>{title}</div>}
        {hasBody && <div style={{ marginTop: title ? 2 : 0 }}>{children}</div>}
        {action ? (
          <div style={{ marginTop: 2 }}>
            <NoteAction action={action} color={w.ink} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{ world?: any, cityName?: string, className?: string, style?: CSS }} props
 */
export function CityNote({ world = undefined, cityName = undefined, className = undefined, style = undefined }) {
  return (
    <WorldNote world={world} className={className} style={style}>
      Showing places across {cityName || 'this city'}: {CITY_DISCLAIMER}
    </WorldNote>
  );
}
