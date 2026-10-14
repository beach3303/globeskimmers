// FinderControls: the controls every finder world shares, printed in that world's tokens
// (WORLD in redesign/constants; the bible's shared finder frame, Eat.dc.html L63-87,
// Coffee.dc.html L54-71, ThingsToDo.dc.html L46-73). Pages pass `world` as a WORLD row or
// any key worldOf() reads ('eat', the old CAT key 'food', the page key 'PlacesToEat'); an
// unknown world falls back to NEUTRAL_WORLD (ink on ivory). Sizes follow --fs; anything
// holding text has a min-height, so it grows instead of clipping.
//
//   worldRow(world, { night })  the WORLD row for a row or key (Weather's night plate with
//        night), else NEUTRAL_WORLD. For components that take a world prop.
//   NEUTRAL_WORLD               a world-shaped row in the shared neutrals.
//
//   <WorldSearch world value onChange onSubmit onClear placeholder label busy submitLabel
//        submitIcon id inputRef inputProps>  A <form role="search">: a 48px white field
//        (radius 14, 1px world line) with Search 18 in iconInk, the input (placeholder in
//        #736657), an in-field clear (a 24px paper disc in a 44x44 button, 'Clear search')
//        once there is text, and a 48px submit square in cta with a ctaInk icon (ArrowRight,
//        or submitIcon), Loader2 while busy. Enter submits; onSubmit(value) is not called
//        while busy. label names the field for screen readers (default: the placeholder).
//        The field rings in --gs-focus (teal ink by default) while the input has focus.
//   <WorldChip world active onClick icon count opensSheet chevron disabled hint clearable>
//        A 36px chip inside a 44px hit area, radius 10, white with the world line and a
//        13/600 #3A3128 label, icon 14 in iconInk. Active: the world's chip fill (chipOn,
//        chipOnInk; Coffee adds its 6px ember dot) and a 12px X (clearable, the default).
//        A toggle by default (aria-pressed); opensSheet makes it the button that opens a
//        sheet (aria-haspopup="dialog", no pressed state). count > 0 prints the label in mono
//        with the count, 'FILTERS · 2' (hidden at zero). chevron adds a ChevronDown (the ATM
//        Banks chip). disabled keeps it focusable (aria-disabled) at 45% and ignores taps;
//        hint is read out with it ('Open now works once café hours load'). Other props
//        (aria-*, id) go on the button. The chip's 44px button reaches 4px past each side
//        of the chip without changing the layout, and rings inside that box.
//   <ChipRow label wrap bleed>   A row of chips, 8px apart. Scrolls sideways by default (no
//        scrollbar); wrap lets the chips wrap instead (the utility row that must never
//        scroll out of reach); bleed lets a scrolling row run 16px past the column to the
//        screen edge (ThingsToDo L68). role="group" named by label when given.
//   <WorldSegmented world options value onChange label mode allowNone>  A 44px segmented
//        control (ThingsToDo L61-65): a white track with the world line and 28px segments,
//        the active one in the chip fill. mode 'tabs' (default): role=tablist of role=tab
//        buttons with aria-selected, arrow-key and Home/End navigation, and aria-controls
//        from option.controls. mode 'pressed': a role=group of aria-pressed buttons, where
//        allowNone lets a tap on the active segment clear it (onChange(null)).
//        options: [{ value, label, icon?, controls? }].
//   <ResultLine items live>     The mono result line under the chips (Coffee L69):
//        10.5px .12em #736657. items: strings, numbers or nodes, or { count, label }
//        fragments that print only when count > 0; renders nothing when no fragment is
//        left, so a zero never prints. children print as given (a sort line). live makes
//        it a polite live region.
//   <WorldNote world icon title action role>  The page's one note (principle 7), on the
//        world wash: a 16px lucide icon (Info by default) in washInk, an optional title in
//        the world ink, the body in washInk 13px, and an optional action (a node, or
//        { label, onClick }) as an underlined world-ink link with a 44px hit area. role
//        'note' by default (pass 'status' for a note that should be announced). Text wraps.
//   <CityNote world cityName>   The city-level line: 'Showing places across {city}:
//        {CITY_DISCLAIMER}', a WorldNote. FinderHeader renders it when isCity and no other
//        note is given; it replaces the old weather-yellow Lightbulb callout.
import React, { useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Info, Loader2, Search, X } from 'lucide-react';
import { NEUTRAL, worldOf, fs } from '@/components/redesign/constants';
import { CITY_DISCLAIMER } from '@/components/location/locationLabel';

/** @typedef {import('react').CSSProperties} CSS */

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

const given = (v) => v != null && v !== false && v !== '';

/**
 * A style object that may carry CSS custom properties (--gs-ph).
 * @param {Record<string, any>} o
 * @returns {CSS}
 */
const css = (o) => o;

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

// ── Search ───────────────────────────────────────────────────────────────

/**
 * @param {{
 *   world?: any, value?: string, onChange?: (v: string) => void, onSubmit?: (v: string) => void,
 *   onClear?: () => void, placeholder?: string, label?: string, busy?: boolean,
 *   submitLabel?: string, submitIcon?: any, id?: string, inputRef?: any,
 *   inputProps?: Record<string, any>, className?: string, style?: CSS,
 * }} props
 */
export function WorldSearch({
  world = undefined,
  value = '',
  onChange = undefined,
  onSubmit = undefined,
  onClear = undefined,
  placeholder = 'Search',
  label = undefined,
  busy = false,
  submitLabel = 'Search',
  submitIcon: SubmitIcon = ArrowRight,
  id = undefined,
  inputRef = undefined,
  inputProps = {},
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world);
  const autoId = useId();
  const inputId = id || `${autoId}-search`;
  const ownRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const text = value == null ? '' : String(value);
  const name = label || placeholder.replace(/[….]+$/, '');

  const setRefs = (el) => {
    ownRef.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef && typeof inputRef === 'object') inputRef.current = el;
  };
  const clear = () => {
    if (onClear) onClear();
    else if (onChange) onChange('');
    if (ownRef.current) ownRef.current.focus();
  };
  const submit = (e) => {
    e.preventDefault();
    if (!busy && onSubmit) onSubmit(text);
  };

  return (
    <form role="search" onSubmit={submit} className={className} style={{ display: 'flex', gap: 8, margin: 0, ...style }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 2px 0 14px',
          background: NEUTRAL.white,
          border: `1px solid ${w.line}`,
          borderRadius: 14,
          outline: focused ? `2px solid var(--gs-focus, ${NEUTRAL.tealInk})` : 'none',
          outlineOffset: 2,
        }}
      >
        <Search size={18} color={w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
        <label htmlFor={inputId} className="sr-only">
          {name}
        </label>
        <input
          id={inputId}
          ref={setRefs}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          {...inputProps}
          onChange={(e) => {
            if (onChange) onChange(e.target.value);
            if (inputProps.onChange) inputProps.onChange(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            if (inputProps.onFocus) inputProps.onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            if (inputProps.onBlur) inputProps.onBlur(e);
          }}
          className={`placeholder:text-[color:var(--gs-ph)] ${inputProps.className || ''}`.trim()}
          style={css({
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            padding: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: fs(15),
            fontWeight: 500,
            color: NEUTRAL.ink,
            '--gs-ph': NEUTRAL.ink3,
            ...(inputProps.style || {}),
          })}
        />
        {text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              padding: 0,
              background: 'transparent',
              border: 0,
              outlineOffset: -2,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 999, background: w.paper }}>
              <X size={14} color={NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" />
            </span>
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        aria-label={submitLabel}
        aria-busy={busy || undefined}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          padding: 0,
          borderRadius: 14,
          background: w.cta,
          border: 0,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? (
          <Loader2 size={20} color={w.ctaInk} strokeWidth={2} aria-hidden="true" focusable="false" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <SubmitIcon size={20} color={w.ctaInk} strokeWidth={2} aria-hidden="true" focusable="false" />
        )}
      </button>
    </form>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   world?: any, active?: boolean, onClick?: (e: any) => void, icon?: any, label?: import('react').ReactNode,
 *   children?: import('react').ReactNode, count?: number|null, opensSheet?: boolean, chevron?: boolean,
 *   disabled?: boolean, hint?: string, clearable?: boolean, className?: string, style?: CSS,
 *   [key: string]: any,
 * }} props
 */
export function WorldChip({
  world = undefined,
  active = false,
  onClick = undefined,
  icon: Icon = undefined,
  label = undefined,
  children = undefined,
  count = null,
  opensSheet = false,
  chevron = false,
  disabled = false,
  hint = undefined,
  clearable = true,
  className = undefined,
  style = undefined,
  ...rest
}) {
  const w = worldRow(world);
  const hintId = useId();
  const on = !!active && !opensSheet;
  const n = Number(count);
  const counted = count != null && Number.isFinite(n) && n > 0;
  const text = children ?? label;
  const ink = on ? w.chipOnInk : NEUTRAL.ink2;
  const showX = on && clearable;
  const lead = on && w.chipDot ? (
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: w.chipDot, flexShrink: 0 }} />
  ) : null;
  return (
    <button
      type="button"
      aria-pressed={opensSheet ? undefined : on}
      aria-haspopup={opensSheet ? 'dialog' : undefined}
      aria-disabled={disabled || undefined}
      aria-describedby={disabled && hint ? hintId : undefined}
      title={disabled && hint ? hint : undefined}
      {...rest}
      onClick={disabled ? undefined : onClick}
      className={className}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        minHeight: 44,
        // The hit area reaches 4px past each side of the chip; the margins keep the layout.
        margin: '0 -4px',
        padding: '0 4px',
        background: 'transparent',
        border: 0,
        outlineOffset: -2,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 36,
          boxSizing: 'border-box',
          padding: `0 ${showX || chevron ? 10 : 14}px 0 ${Icon || lead ? 12 : 14}px`,
          borderRadius: 10,
          background: on ? w.chipOn : NEUTRAL.white,
          border: `1px solid ${on ? w.chipOn : w.line}`,
          color: ink,
          fontSize: fs(13),
          lineHeight: 1.15,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {lead}
        {Icon ? <Icon size={14} color={on ? w.chipOnInk : w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
        {counted ? (
          <span style={{ fontFamily: MONO, fontSize: fs(11.5), fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: on ? ink : w.ink }}>
            {text} · {n.toLocaleString('en-US')}
          </span>
        ) : (
          text
        )}
        {chevron ? <ChevronDown size={14} color={on ? w.chipOnInk : NEUTRAL.ink2} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
        {showX ? <X size={12} color={w.chipOnInk} strokeWidth={2.4} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} /> : null}
        {disabled && hint ? (
          <span id={hintId} className="sr-only">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * @param {{ label?: string, wrap?: boolean, bleed?: boolean, children?: import('react').ReactNode, className?: string, style?: CSS }} props
 */
export function ChipRow({ label = undefined, wrap = false, bleed = false, children = undefined, className = undefined, style = undefined }) {
  /** @type {CSS} */
  const box = wrap
    ? { display: 'flex', flexWrap: 'wrap', columnGap: 8, rowGap: 0, alignItems: 'center' }
    : {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        overflowX: 'auto',
        overscrollBehaviorX: 'contain',
        WebkitOverflowScrolling: 'touch',
        // The chips' 4px hit-area margins sit inside the scroller's own 4px.
        margin: bleed ? '0 -20px 0 -4px' : '0 -4px',
        padding: bleed ? '0 12px 0 4px' : '0 4px',
      };
  return (
    <div role={label ? 'group' : undefined} aria-label={label} className={`${wrap ? '' : 'gs-noscroll '}${className || ''}`.trim() || undefined} style={{ ...box, ...style }}>
      {children}
    </div>
  );
}

// ── Segmented control ────────────────────────────────────────────────────

/**
 * @param {{
 *   world?: any, options?: { value: any, label: import('react').ReactNode, icon?: any, controls?: string }[],
 *   value?: any, onChange?: (v: any) => void, label?: string, mode?: 'tabs'|'pressed',
 *   allowNone?: boolean, className?: string, style?: CSS,
 * }} props
 */
export function WorldSegmented({
  world = undefined,
  options = [],
  value = undefined,
  onChange = undefined,
  label = undefined,
  mode = 'tabs',
  allowNone = false,
  className = undefined,
  style = undefined,
}) {
  const w = worldRow(world);
  const tabs = mode !== 'pressed';
  const refs = useRef([]);
  const pick = (i, focus) => {
    const o = options[i];
    if (!o) return;
    if (onChange && o.value !== value) onChange(o.value);
    if (focus && refs.current[i]) refs.current[i].focus();
  };
  const onKeyDown = (e, i) => {
    if (!tabs) return;
    const last = options.length - 1;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next == null) return;
    e.preventDefault();
    pick(next, true);
  };
  const anySelected = options.some((o) => o.value === value);
  return (
    <div
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      className={className}
      style={{ position: 'relative', display: 'flex', flexShrink: 0, minHeight: 44, ...style }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, right: 0, top: 4, bottom: 4, background: NEUTRAL.white, border: `1px solid ${w.line}`, borderRadius: 10, boxSizing: 'border-box' }}
      />
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            aria-controls={tabs ? o.controls : undefined}
            tabIndex={tabs ? (on || (!anySelected && i === 0) ? 0 : -1) : undefined}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => {
              if (!tabs && on && allowNone) {
                if (onChange) onChange(null);
                return;
              }
              pick(i, false);
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              padding: `0 ${i === options.length - 1 ? 4 : 2}px 0 ${i === 0 ? 4 : 0}px`,
              background: 'transparent',
              border: 0,
              outlineOffset: -2,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 28,
                boxSizing: 'border-box',
                padding: '0 10px',
                borderRadius: 7,
                background: on ? w.chipOn : 'transparent',
                color: on ? w.chipOnInk : NEUTRAL.ink2,
                fontSize: fs(13),
                lineHeight: 1.15,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {Icon ? <Icon size={14} color={on ? w.chipOnInk : w.iconInk} strokeWidth={2} aria-hidden="true" focusable="false" /> : null}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Result line ──────────────────────────────────────────────────────────

function fragment(x) {
  if (!given(x)) return null;
  if (typeof x === 'object' && !React.isValidElement(x) && 'count' in x) {
    const n = Number(x.count);
    if (x.count == null || !Number.isFinite(n) || n <= 0) return null;
    return `${n.toLocaleString('en-US')} ${x.label || ''}`.trim();
  }
  if (typeof x === 'number') return x > 0 ? x.toLocaleString('en-US') : null;
  return x;
}

/**
 * @param {{ items?: any[], children?: import('react').ReactNode, live?: boolean, world?: any, className?: string, style?: CSS }} props
 */
export function ResultLine({ items = undefined, children = undefined, live = false, world: _world = undefined, className = undefined, style = undefined }) {
  const frags = (Array.isArray(items) ? items : []).map(fragment).filter(Boolean);
  const body = given(children) ? children : frags.length ? frags.map((f, i) => (
    <React.Fragment key={i}>
      {i > 0 ? ' · ' : null}
      {f}
    </React.Fragment>
  )) : null;
  if (!body) return null;
  return (
    <p
      aria-live={live ? 'polite' : undefined}
      className={className}
      style={{
        margin: '6px 0 0',
        fontFamily: MONO,
        fontSize: fs(10.5),
        lineHeight: 1.34,
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: NEUTRAL.ink3,
        ...style,
      }}
    >
      {body}
    </p>
  );
}
