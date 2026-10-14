// LocationModePicker: the location chooser, printed as the Kraft Folder (option B, the
// founder's pick on 2026-10-13; docs/design/new-look/Location-B.dc.html L192-245 and
// Location-B-Locating.dc.html L237-240).
//
// It is Home's cold-open "Where would you like to explore?" and the "Change" sheet every
// finder opens. A WHERE TO tab sits on a kraft folder (Home's services stock) that rises
// from the bottom on phones. The places are rows on one white sheet, then an OR rule, then
// "Explore where I am", the only solid button, under the thumb. Saved locations, search and
// the confirmation are pages of the same folder. On iPad the folder is centred at 1:1.
//
// Props (unchanged): isOpen, onClose, coldOpen (Home's cold open: the question title, the
// Continue row and "Don't ask again today"), lastLocation (the active place, for Continue),
// onSnoozeToday, onPicked (optional: a pick is handed to the caller instead of switching
// the app's location).
//
// Pages (mode): 'select', 'saved', 'search', 'info' (the 1.5 s "Now exploring" hold after
// a search pick). Only the search page tracks the on-screen keyboard.
//
// Fitting the screen. How much of the folder stays put is decided from measured room,
// never from a fixed screen size: the text size, a GPS note, a narrow phone, a landscape
// screen and the keyboard all change it.
//   pin     the title and the button stay put and only the sheet of rows scrolls, while it
//           keeps about one and a half rows in view (the search page: one result row);
//   foot    the button stays put and the title scrolls with the rows, while at least
//           half a row shows under the title;
//   scroll  the whole folder scrolls.
// A scrolling sheet or folder fades out at its bottom edge while more is below it. On
// phones the search page, and the confirmation that follows it, hang from the top of the
// screen, so the field never moves as the keyboard rises or results arrive; while the
// keyboard is up the folder reaches down to 16px above it.
//
// The sheet is a modal dialog: it is named by the page's title, focus moves into it on
// open and on each page change and back to the opener on close, Tab stays inside it, and
// Escape, a scrim tap, the global swipe-down or Android's back key close it. Closing is
// instant.
import React, { useState, useEffect, useLayoutEffect, useRef, useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BedDouble,
  Bookmark,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  History as HistoryIcon,
  Landmark,
  LoaderCircle,
  MapPin,
  Navigation as NavigationIcon,
  Plane,
  Search,
  SearchX,
  ShoppingBag,
  TrainFront,
  Trees,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { useLocation } from './LocationContext';
import { useIsTablet } from '@/lib/useIsTablet';
import { useKeyboardOffset } from '@/lib/useKeyboardOffset';
import { useDismissable } from '@/lib/dismissStack';
import { useFontScale } from '@/components/a11y/FontScaleContext';
import { NEUTRAL, ZONE, fs, rgba } from '@/components/redesign/constants';
import { Folder, FolderTab } from '@/components/redesign/Zone';

/** @typedef {import('react').CSSProperties} CSS */

// The kraft stock: Home's services folder (fill, line, tab, umber accent, meta, chip line).
const K = ZONE.services;

// The italic word in every serif title.
const EM = { fontStyle: 'italic', color: NEUTRAL.tealInk };

// One line icon per place type; current_location, location and anything unknown get the pin.
const PLACE_ICONS = {
  airport: Plane,
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  shopping: ShoppingBag,
  attraction: Landmark,
  park: Trees,
  transit: TrainFront,
};
const iconFor = (placeType) =>
  (typeof placeType === 'string' && Object.prototype.hasOwnProperty.call(PLACE_ICONS, placeType) ? PLACE_ICONS[placeType] : MapPin);

// Saved entries, search results and the last place come from storage and the network: read
// every field defensively, so one malformed entry can't blank the sheet.
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isEntry = (e) => e !== null && typeof e === 'object' && !Array.isArray(e);
const nameOf = (entry) => str(entry.nickname) || str(entry.placeName);

// "3 saved: Home, Hotel Avenida Palace, LAX", "5 saved: A, B, C and 2 more", or "2 saved"
// when no entry has a name. The row is hidden at 0, so "0 saved" never prints.
function savedLine(list) {
  const n = list.length;
  const shown = list.map(nameOf).filter(Boolean).slice(0, 3);
  if (!shown.length) return `${n} saved`;
  const more = n - shown.length;
  return `${n} saved: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

// Search runs on more than 2 typed characters (spaces count, nothing is trimmed), but a
// query of nothing but spaces is never sent.
const searchable = (q) => q.length > 2 && q.trim() !== '';

// What a failed "Explore where I am" says, by GeolocationPositionError code. The app has no
// browser settings, so a denial on iOS and Android points to Settings instead.
function gpsErrorText(error) {
  const code = error?.code;
  if (code === 1) {
    return Capacitor.isNativePlatform()
      ? 'Location access was denied. Turn on location for Globeskimmers in Settings, then try again.'
      : 'Location access was denied. Please enable location permissions in your browser settings, then try again.';
  }
  if (code === 2) return 'Unable to determine your location. Please check your GPS/location settings and try again.';
  if (code === 3) return 'Location request timed out. Please try again.';
  return 'Unable to get your current location. Please try again or choose a location manually.';
}

const NO_RESULTS = 'No locations found. Please search for a specific address, landmark, or place.';
const SEARCH_ERROR = 'Error searching. Please try again.';

// The room rules (see the top of the file); the row sizes grow with the text size.
const ROWS_MIN = 100; // about one and a half rows: the title and the button stay put
const ROWS_PEEK = 32; // half a row: the button stays put and the title scrolls away
const RESULT_MIN = 64; // one search result row under the pinned field
const LAYOUTS = ['pin', 'foot', 'scroll']; // most to least pinned
const FADE = 24; // the soft edge at the bottom of a scroller
const SPRING = { type: 'spring', damping: 28, stiffness: 320 }; // today's entrance spring
const NO_FADES = { sheet: false, region: false, box: false };

// 100dvh follows the browser's toolbars; WebViews older than Chrome 108 take 100vh.
const VH = typeof window !== 'undefined' && window.CSS && window.CSS.supports && window.CSS.supports('height', '100dvh') ? '100dvh' : '100vh';
const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The window's size while the sheet is open (rotation, split view), as one value.
function useViewportSize(active) {
  const [size, setSize] = useState(() => (typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : ''));
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const update = () => setSize(`${window.innerWidth}x${window.innerHeight}`);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active]);
  return size;
}

// Where the folder sits. Phone: at most today's 448px wide; the select and saved pages sit
// 16px above the home indicator, under the thumb (top: false), and the search page and the
// confirmation after it hang 12px below the top safe area (top: true), down to 16px above
// the home indicator or the keyboard. iPad: a centred folder, at most 480px wide and 720px
// tall, centred in the space above the keyboard. cap is the dialog's max height;
// searchHeight, when set, is the search page's height (iPad: at most 600px; phone: the
// whole space above the keyboard, so a tap under the results can't land on the scrim).
function frameFor(isTablet, keyboardOffset, top) {
  if (isTablet) {
    const cap = keyboardOffset
      ? `calc(${VH} - ${SAFE_TOP} - ${keyboardOffset + 48}px)`
      : `min(720px, calc(${VH} - ${SAFE_TOP} - ${SAFE_BOTTOM} - 48px))`;
    return {
      overlay: {
        alignItems: 'center',
        paddingTop: `calc(${SAFE_TOP} + 24px)`,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: keyboardOffset ? keyboardOffset + 24 : `calc(24px + ${SAFE_BOTTOM})`,
      },
      dialog: { width: 'min(480px, 100%)', margin: 'auto' },
      cap,
      searchHeight: `min(600px, ${cap})`,
      shadow: `0 24px 48px -24px ${rgba(NEUTRAL.ink, 0.5)}`,
      enter: { y: 24, opacity: 0 },
    };
  }
  const cap = keyboardOffset
    ? `calc(${VH} - ${SAFE_TOP} - ${keyboardOffset + (top ? 28 : 40)}px)`
    : `calc(${VH} - ${SAFE_TOP} - ${SAFE_BOTTOM} - ${top ? 28 : 48}px)`;
  return {
    overlay: {
      alignItems: 'stretch',
      paddingTop: `calc(${SAFE_TOP} + 12px)`,
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: keyboardOffset ? keyboardOffset + 16 : `calc(16px + ${SAFE_BOTTOM})`,
    },
    // margin-top auto puts the sheet at the bottom, margin-bottom auto at the top.
    dialog: { width: '100%', maxWidth: 448, alignSelf: 'center', ...(top ? { marginTop: 0, marginBottom: 'auto' } : { marginTop: 'auto' }) },
    cap,
    searchHeight: keyboardOffset ? cap : undefined,
    // A folder that hangs from the top casts its shadow downward, as the iPad folder does.
    shadow: top ? `0 24px 48px -24px ${rgba(NEUTRAL.ink, 0.5)}` : `0 -16px 36px -20px ${rgba(NEUTRAL.ink, 0.6)}`,
    enter: { y: '100%', opacity: 0 },
  };
}

function IconButton({ label, icon: Icon, onClick, margin }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="active:opacity-60"
      style={{
        flex: 'none',
        width: 44,
        height: 44,
        boxSizing: 'border-box',
        margin,
        padding: 0,
        borderRadius: 999,
        background: 'transparent',
        border: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <Icon size={18} color={K.accent} strokeWidth={2} aria-hidden="true" focusable="false" />
    </button>
  );
}

// The soft edge at the bottom of a scroller while more is below it. It lets taps through.
/** @param {{ color: string, inset?: number, radius?: number | string }} props */
function Fade({ color, inset = 0, radius = 0 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: inset,
        right: inset,
        bottom: inset,
        height: FADE,
        borderRadius: radius,
        background: `linear-gradient(${rgba(color, 0)}, ${color})`,
        pointerEvents: 'none',
      }}
    />
  );
}

// The white sheet that holds the rows (Location-B L204). When scroll is set the sheet
// itself scrolls, so its border and rounded edge always frame the list, and it fades out
// at the bottom while rows remain below (more). rowsRef measures the rows.
function Sheet({ children, scroll = false, more = false, rowsRef = undefined, onScroll = undefined, style = undefined }) {
  return (
    <div
      style={{
        position: 'relative',
        flex: scroll ? '0 1 auto' : 'none',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 16,
        background: NEUTRAL.white,
        border: `1px solid ${K.chipLine}`,
        ...style,
      }}
    >
      <div
        onScroll={onScroll}
        style={scroll ? { flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollPaddingBottom: FADE } : { flex: 'none' }}
      >
        <div ref={rowsRef}>{children}</div>
      </div>
      {more ? <Fade color={NEUTRAL.white} /> : null}
    </div>
  );
}

// One row on the sheet (Location-B L205-228): a kraft disc with a teal line icon, the
// words, and a trailing umber arrow (commits a place) or chevron (opens a page). Every
// line wraps. The focus ring sits inside the clipped sheet, rounded at its corners.
function Row({ icon: Icon, title, sub = '', kicker = '', kickerColor = NEUTRAL.ink3, extra = null, trail: Trail, onClick, first, last, top = false }) {
  const corner = first && last ? '15px' : first ? '15px 15px 0 0' : last ? '0 0 15px 15px' : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent active:!bg-zone-services-fill/50"
      style={{
        display: 'flex',
        alignItems: top ? 'flex-start' : 'center',
        gap: 12,
        width: '100%',
        minHeight: 64,
        boxSizing: 'border-box',
        margin: 0,
        padding: '10px 12px',
        borderStyle: 'solid',
        borderColor: NEUTRAL.creamRule,
        borderWidth: first ? 0 : '1px 0 0',
        borderRadius: corner,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: NEUTRAL.ink,
        outlineOffset: -3,
      }}
    >
      <span
        aria-hidden="true"
        style={{ flex: 'none', width: 36, height: 36, borderRadius: 999, background: K.fill, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={18} color={NEUTRAL.tealInk} strokeWidth={2} aria-hidden="true" focusable="false" />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        {kicker ? (
          <span
            className="font-mono"
            style={{ display: 'block', fontSize: fs(10), fontWeight: 500, lineHeight: 14 / 10, letterSpacing: '.12em', textTransform: 'uppercase', color: kickerColor, overflowWrap: 'anywhere' }}
          >
            {kicker}
          </span>
        ) : null}
        <span style={{ display: 'block', fontSize: fs(15), fontWeight: 600, lineHeight: 20 / 15, color: NEUTRAL.ink, overflowWrap: 'anywhere' }}>{title}</span>
        {sub ? (
          <span style={{ display: 'block', marginTop: 1, fontSize: fs(12.5), lineHeight: 16 / 12.5, color: NEUTRAL.ink3, overflowWrap: 'anywhere' }}>{sub}</span>
        ) : null}
        {extra}
      </span>
      <span aria-hidden="true" style={{ flex: 'none', display: 'flex', marginTop: top ? 9 : 0 }}>
        <Trail size={18} color={K.accent} strokeWidth={2} aria-hidden="true" focusable="false" />
      </span>
    </button>
  );
}

// A note on white (plan-authored; never red or orange): the icon in umber, the words in
// ink-2. kind 'error' (CircleAlert) reads its words out as it appears (role=alert); kind
// 'empty' (SearchX, no results) is read by the search page's status line instead. action,
// when given, is one quiet outline button under the words (the house error card's action:
// umber on white, never a solid fill), kept out of the alert so it isn't read twice.
function Note({ kind = 'error', text, action = null, style = undefined }) {
  const Icon = kind === 'error' ? CircleAlert : SearchX;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        background: NEUTRAL.white,
        border: `1px solid ${K.chipLine}`,
        ...style,
      }}
    >
      <Icon size={18} color={K.accent} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p role={kind === 'error' ? 'alert' : undefined} style={{ margin: 0, fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2, overflowWrap: 'anywhere' }}>
          {text}
        </p>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="active:opacity-60"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              maxWidth: '100%',
              boxSizing: 'border-box',
              margin: '10px 0 0',
              padding: '4px 18px',
              borderRadius: 14,
              background: 'transparent',
              border: `1px solid ${K.accent}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: fs(14),
              fontWeight: 600,
              lineHeight: 1.2,
              textAlign: 'center',
              color: K.accent,
              overflowWrap: 'anywhere',
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function LocationModePicker({ isOpen, onClose, coldOpen = false, lastLocation = null, onSnoozeToday, onPicked = null }) {
  const { switchToCurrentLocation, switchToNavigateMode, getSavedLocations } = useLocation();
  const isTablet = useIsTablet();
  const reduce = useReducedMotion();
  const { scale } = useFontScale();

  const [mode, setMode] = useState('select'); // 'select', 'search', 'saved', 'info'
  // Only the search page raises the keyboard; its height keeps the folder above it.
  const needsKeyboard = mode === 'search';
  const keyboardOffset = useKeyboardOffset(isOpen && needsKeyboard);
  const viewport = useViewportSize(isOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(''); // shown on the select page, above the button
  const [note, setNote] = useState(null); // the search page's { kind: 'empty'|'error', text }
  const [picked, setPicked] = useState(null); // the search result "Now exploring" names
  const [layout, setLayout] = useState('pin'); // 'pin' | 'foot' | 'scroll' (see the top)
  const [fades, setFades] = useState(NO_FADES);

  // Only the newest search may show its reply: a reply for a query that has since changed,
  // been cleared, or belongs to an earlier opening is dropped.
  const searchSeq = useRef(0);
  const dialogRef = useRef(null);
  const frameRef = useRef(null); // the dialog's positioning wrapper (its max height)
  // The folder's parts, measured to fit the screen.
  const tabRef = useRef(null);
  const regionRef = useRef(null); // the title and the body (its parent is the folder box)
  const scrollRef = useRef(null); // the region's scroller (layout 'foot')
  const headerRef = useRef(null);
  const bodyRef = useRef(null);
  const footerRef = useRef(null);
  const rowsRef = useRef(null); // the rows inside the sheet
  // The page and layout now, for the ResizeObserver, which outlives a render.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const titleId = useId();
  const subId = useId();
  const inputId = useId();
  const hintId = useId();

  useDismissable(isOpen, onClose);

  // Android's back key closes the chooser, instead of leaving the finder under it or, on a
  // cold open with no history, the app. Capacitor turns the key's own behaviour off only
  // while a listener is registered, so it is added on open and removed on close (as
  // SuggestPlaceSection's useOverlayClose does).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen || Capacitor.getPlatform() !== 'android') return undefined;
    let handle = null;
    let gone = false;
    Promise.resolve(App.addListener('backButton', () => closeRef.current?.()))
      .then((h) => { if (gone) h?.remove?.(); else handle = h; })
      .catch(() => { /* the key keeps its own behaviour */ });
    return () => {
      gone = true;
      handle?.remove?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadSavedLocations();
      searchSeq.current += 1;
      setMode('select');
      setSearchQuery('');
      setSearchResults([]);
      setSearching(false);
      setNote(null);
      setGpsError('');
      setPicked(null);
    } else {
      // Closed: the next opening starts on the select page from its first frame, so the
      // folder doesn't replay the last page's move.
      setMode('select');
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchable(searchQuery)) {
      const timer = setTimeout(() => {
        performSearch(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    }
    searchSeq.current += 1;
    setSearchResults([]);
    setSearching(false);
    setNote(null);
    return undefined;
  }, [searchQuery]);

  // Focus moves into the dialog when it opens and back to the opener when it closes
  // (FilterSheet's pattern).
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => {
      if (dialogRef.current) dialogRef.current.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (opener && opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Each page change moves focus to the dialog, so the new title is read out and focus
  // never falls to the page when the tapped row goes away. The keyboard is never raised
  // here: the field is focused only by the traveler's own tap.
  useEffect(() => {
    if (!isOpen) return undefined;
    const raf = requestAnimationFrame(() => {
      if (dialogRef.current) dialogRef.current.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [mode, isOpen]);

  // ── Fitting the screen (see the top of the file) ─────────────────────────
  // Every size is read from the page as drawn: the dialog's max height, the tab, the
  // folder's padding, the title band, the button band and the rows. upgrade false (a size
  // change seen by the ResizeObserver) may only pin less, so a layout whose own change
  // moves what it measured can't flip back and forth.
  const fit = (upgrade) => {
    const place = frameRef.current;
    const region = regionRef.current;
    const header = headerRef.current;
    const body = bodyRef.current;
    const box = region ? region.parentElement : null;
    if (!place || !box || !header || !body) return;
    const num = (v) => parseFloat(v) || 0;
    const bs = window.getComputedStyle(box);
    const cap = parseFloat(window.getComputedStyle(place).maxHeight);
    const avail = (Number.isFinite(cap) ? cap : Infinity)
      - (tabRef.current ? tabRef.current.offsetHeight : 0)
      - num(bs.paddingTop) - num(bs.paddingBottom) - num(bs.borderTopWidth) - num(bs.borderBottomWidth);
    const headerH = header.offsetHeight;
    const footerH = footerRef.current ? footerRef.current.offsetHeight : 0;
    const rows = rowsRef.current;
    const sheet = rows && rows.parentElement ? rows.parentElement.parentElement : null; // rows, scroller, sheet
    const rowsH = rows && sheet ? rows.offsetHeight + sheet.offsetHeight - sheet.clientHeight : 0;
    const otherH = body.scrollHeight - (sheet ? sheet.offsetHeight : 0); // the body around the sheet
    let next;
    if (modeRef.current === 'search') {
      // The field stays pinned while one result row fits under it (with the body's top
      // padding and the results kicker), and while a hint or a note fits.
      const room = avail - headerH + 1;
      next = room >= 12 + (14 * scale + 8) + RESULT_MIN && room >= (rows ? 0 : otherH) ? 'pin' : 'scroll';
    } else {
      // The rows' room under the title and above the button. Below half a row the title
      // and the rows would hide each other, so the whole folder scrolls instead.
      const room = avail - headerH - footerH - otherH + 1;
      if (room >= Math.min(rowsH, ROWS_MIN * scale)) next = 'pin';
      else if (footerH > 0 && room >= Math.min(rowsH, ROWS_PEEK * scale)) next = 'foot';
      else next = 'scroll';
    }
    const cur = layoutRef.current;
    if (next !== cur && (upgrade || LAYOUTS.indexOf(next) > LAYOUTS.indexOf(cur))) setLayout(next);
  };

  // Which scroller has more below it: only the one the layout uses.
  const showFades = () => {
    const cur = layoutRef.current;
    const more = (el) => !!el && el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    const rows = rowsRef.current;
    const region = regionRef.current;
    const next = {
      sheet: cur === 'pin' && more(rows ? rows.parentElement : null),
      region: cur === 'foot' && more(scrollRef.current),
      box: cur === 'scroll' && more(region ? region.parentElement : null),
    };
    setFades((prev) => (prev.sheet === next.sheet && prev.region === next.region && prev.box === next.box ? prev : next));
  };

  const fitRef = useRef(fit);
  fitRef.current = fit;
  const fadesRef = useRef(showFades);
  fadesRef.current = showFades;

  const lastName = coldOpen && lastLocation?.placeType !== 'current_location'
    ? str(lastLocation?.placeName) || str(lastLocation?.address?.city)
    : '';
  const hasRows = mode === 'select' || (mode === 'saved' && savedLocations.length > 0) || (mode === 'search' && searchResults.length > 0);

  // Anything that changes the room or what has to fit in it: decided before paint.
  useLayoutEffect(() => {
    if (isOpen) fitRef.current(true);
  }, [isOpen, mode, gpsError, keyboardOffset, viewport, scale, isTablet, coldOpen, lastName, savedLocations, searchResults, note, searchQuery, picked]);

  // After every render the fades follow the scroller in use.
  useLayoutEffect(() => {
    if (isOpen) fadesRef.current();
  });

  // Sizes that change on their own (a web font arriving late) can only pin less.
  useEffect(() => {
    if (!isOpen || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      fitRef.current(false);
      fadesRef.current();
    });
    [frameRef, tabRef, headerRef, bodyRef, footerRef, rowsRef].forEach((r) => {
      if (r.current) ro.observe(r.current);
    });
    return () => ro.disconnect();
  }, [isOpen, mode, hasRows]);

  // A GPS failure on a screen too short to pin anything: show the note and the button it
  // explains, which the whole-folder scroll may have left below the edge.
  useLayoutEffect(() => {
    if (!isOpen || !gpsError || layout !== 'scroll') return;
    const box = regionRef.current ? regionRef.current.parentElement : null;
    if (box) box.scrollTop = box.scrollHeight;
  }, [isOpen, gpsError, layout]);

  // Saved locations come from on-device storage (src/lib/savedLocations.js), so this is a
  // synchronous read. Entries that aren't objects are skipped.
  const loadSavedLocations = () => {
    const list = getSavedLocations();
    setSavedLocations(Array.isArray(list) ? list.filter(isEntry) : []);
  };

  // An outage is never shown as "no results": callWorker doesn't throw, it returns
  // { error } on a timeout, a network failure or a non-2xx reply (whose body may be HTML),
  // and the worker answers HTTP 200 { error, results: [] } when Google can't search. Only a
  // clean reply without results is "no results", in the worker's own words when it sends any.
  const performSearch = async (query) => {
    const seq = ++searchSeq.current;
    setSearching(true);
    setNote(null);

    try {
      const { data, error } = await callWorker(ROUTE.searchLocation, {
        query: query,
      });
      if (seq !== searchSeq.current) return;

      const rows = isEntry(data) && Array.isArray(data.results) ? data.results.filter(isEntry) : [];
      if (error || !isEntry(data) || data.error) {
        console.error('Error searching locations:', error || data?.error || data);
        setSearchResults([]);
        setNote({ kind: 'error', text: SEARCH_ERROR });
      } else if (rows.length > 0) {
        setSearchResults(rows);
        setNote(null);
      } else {
        setSearchResults([]);
        setNote({ kind: 'empty', text: str(data.message) || NO_RESULTS });
      }
    } catch (error) {
      if (seq !== searchSeq.current) return;
      console.error('Error searching locations:', error);
      setSearchResults([]);
      setNote({ kind: 'error', text: SEARCH_ERROR });
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  // The error note's "Try again": the same query, at once. The button goes away with the
  // note, so focus that was on it moves to the dialog instead of falling to the page.
  const retrySearch = (e) => {
    if (e && e.currentTarget === document.activeElement && dialogRef.current) dialogRef.current.focus({ preventScroll: true });
    if (searchable(searchQuery)) performSearch(searchQuery);
  };

  const handleUseCurrentLocation = async () => {
    if (gpsLoading) return; // busy: the button stays focusable, so it ignores taps instead of disabling
    setGpsLoading(true);
    setGpsError('');

    try {
      // Don't pre-check permission - just try to get location
      // The browser will prompt if needed
      await switchToCurrentLocation();
      onClose();
    } catch (error) {
      console.error('Error using current location:', error);
      // Shown beside the button it explains; the sheet stays open.
      setGpsError(gpsErrorText(error));
    }

    setGpsLoading(false);
  };

  const handleSelectNavigateLocation = (location) => {
    if (onPicked) { onPicked(location); onClose(); return; } // caller handles it (e.g. set-my-stay)
    setPicked(location);
    setMode('info');
    setTimeout(async () => {
      await switchToNavigateMode(location);
      onClose();
    }, 1500);
  };

  const handleSelectSavedLocation = async (location) => {
    if (onPicked) { onPicked(location); onClose(); return; }
    await switchToNavigateMode(location);
    onClose();
  };

  // Escape closes; Tab and Shift+Tab go round inside the dialog (focus on the dialog
  // itself counts as before the first control).
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const els = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    const at = els.indexOf(document.activeElement);
    if (!els.length || (e.shiftKey ? at <= 0 : at === -1 || at === els.length - 1)) {
      e.preventDefault();
      if (els.length) (e.shiftKey ? els[els.length - 1] : els[0]).focus();
    }
  };

  if (!isOpen) return null;

  // Phones: the search page and the confirmation after it hang from the top.
  const top = !isTablet && (mode === 'search' || mode === 'info');
  const frame = frameFor(isTablet, keyboardOffset, top);
  const pin = layout === 'pin';
  const foot = layout === 'foot';
  const whole = layout === 'scroll';
  /** @type {CSS} */
  const column = { display: 'flex', flexDirection: 'column' };
  /** @type {CSS} */
  const regionStyle = whole ? { position: 'relative', flex: 'none', ...column } : { position: 'relative', flex: '1 1 auto', minHeight: 0, ...column };
  /** @type {CSS} */
  const scrollStyle = foot
    ? { flex: '1 1 auto', minHeight: 0, ...column, overflowY: 'auto', overscrollBehavior: 'contain', scrollPaddingBottom: FADE }
    : whole ? { flex: 'none', ...column } : { flex: '1 1 auto', minHeight: 0, ...column };
  /** @type {CSS} */
  let bodyStyle = pin ? { flex: '1 1 auto', minHeight: 0, ...column } : { flex: 'none', ...column };
  const edge = `1px solid ${K.line}`;

  /** @type {(size: number, lineHeight: number) => CSS} */
  const titleStyle = (size, lineHeight) => ({
    flex: 1,
    minWidth: 0,
    margin: 0,
    fontWeight: 400,
    fontSize: fs(size),
    lineHeight,
    color: K.title,
    overflowWrap: 'break-word',
  });
  /** @type {CSS} */
  const subStyle = { margin: '6px 0 0', fontSize: fs(13), lineHeight: 18 / 13, color: K.meta, overflowWrap: 'anywhere' };
  const backAndClose = (title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <IconButton label="Back to location options" icon={ChevronLeft} onClick={() => setMode('select')} margin="-8px 0 -8px -8px" />
      <h2 id={titleId} className="font-serif" style={titleStyle(24, 1.1)}>
        {title}
      </h2>
      <IconButton label="Close" icon={X} onClick={onClose} margin="-8px -8px -8px 0" />
    </div>
  );

  let padding = '18px 16px 16px';
  let header = null;
  let body = null;
  let footer = null;
  let described = subId;

  if (mode === 'select') {
    const rows = [];
    // Cold-open only: one tap to resume a place you deliberately chose (a typed or searched
    // destination). Hidden when you left off on your own current location: then "Explore
    // where I am" is the same action. Consent-first: no early GPS.
    if (lastName) {
      rows.push({ key: 'continue', icon: HistoryIcon, title: `Continue exploring ${lastName}`, sub: 'Where you left off', trail: ArrowRight, onClick: onClose });
    }
    if (savedLocations.length > 0) {
      rows.push({ key: 'saved', icon: Bookmark, title: 'Saved locations', sub: savedLine(savedLocations), trail: ChevronRight, onClick: () => setMode('saved') });
    }
    rows.push({ key: 'search', icon: Search, title: 'Choose a destination', sub: 'A city, an address or a landmark', trail: ChevronRight, onClick: () => setMode('search') });

    padding = coldOpen ? '18px 16px 6px' : '18px 16px 16px';
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id={titleId} className="font-serif" style={titleStyle(28, 1.05)}>
            {coldOpen ? (
              <>Where would you like to <em style={EM}>explore</em>?</>
            ) : (
              <>Choose your <em style={EM}>starting point</em></>
            )}
          </h2>
          {/* -8px below as well as above: the X stays on the first line, and a one-line
              title keeps the board's 6px to the sub-line. */}
          <IconButton label="Close" icon={X} onClick={onClose} margin="-8px -8px -8px 0" />
        </div>
        <p id={subId} style={subStyle}>Globeskimmers finds places near your starting point.</p>
      </>
    );
    body = (
      <Sheet scroll={pin} more={fades.sheet} rowsRef={rowsRef} onScroll={showFades} style={{ marginTop: 14 }}>
        {rows.map(({ key, ...row }, i) => (
          <Row key={key} {...row} first={i === 0} last={i === rows.length - 1} />
        ))}
      </Sheet>
    );
    footer = (
      <>
        <div style={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: K.rule }} />
          <span className="font-mono" style={{ flex: 'none', fontSize: fs(10.5), fontWeight: 500, lineHeight: 14 / 10.5, letterSpacing: '.14em', color: K.kicker }}>
            OR
          </span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: K.rule }} />
        </div>
        {gpsError ? <Note text={gpsError} style={{ marginBottom: 10 }} /> : null}
        {/* The board's only solid fill. While locating it stays full strength and
            focusable (aria-disabled, the handler ignores taps); the rows stay tappable. */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          aria-busy={gpsLoading ? 'true' : undefined}
          aria-disabled={gpsLoading ? 'true' : undefined}
          className={gpsLoading ? undefined : 'active:opacity-90'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            minHeight: 56,
            boxSizing: 'border-box',
            margin: 0,
            padding: '8px 16px',
            borderRadius: 14,
            background: K.accent,
            border: 0,
            cursor: gpsLoading ? 'default' : 'pointer',
            fontFamily: 'inherit',
            fontSize: fs(16),
            fontWeight: 600,
            lineHeight: 20 / 16,
            textAlign: 'center',
            color: NEUTRAL.cream,
          }}
        >
          <span aria-hidden="true" style={{ flex: 'none', display: 'flex' }}>
            {gpsLoading ? (
              <LoaderCircle size={18} color={NEUTRAL.cream} strokeWidth={2} className="motion-safe:animate-spin" aria-hidden="true" focusable="false" />
            ) : (
              <NavigationIcon size={18} color={NEUTRAL.cream} strokeWidth={2} aria-hidden="true" focusable="false" />
            )}
          </span>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{gpsLoading ? 'Getting location…' : 'Explore where I am'}</span>
        </button>
        {/* Announced here, not inside the busy button (aria-busy holds back what is inside it). */}
        <p role="status" className="sr-only">{gpsLoading ? 'Getting location…' : ''}</p>
        {/* Cold-open only: let frequent users silence today's chooser. */}
        {coldOpen && (
          <button
            type="button"
            onClick={() => { onSnoozeToday?.(); onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 44,
              boxSizing: 'border-box',
              margin: '2px 0 0',
              padding: '4px 8px',
              borderRadius: 12,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: fs(13),
              fontWeight: 600,
              lineHeight: 18 / 13,
              textAlign: 'center',
              color: K.accent,
            }}
          >
            Don’t ask again today
          </button>
        )}
      </>
    );
  } else if (mode === 'saved') {
    header = (
      <>
        {backAndClose(<>Saved <em style={EM}>locations</em></>)}
        <p id={subId} style={subStyle}>Tap a place to navigate from it.</p>
      </>
    );
    body = savedLocations.length === 0 ? (
      <p style={{ flex: 'none', margin: 0, padding: '40px 0', textAlign: 'center', fontSize: fs(13), lineHeight: 18 / 13, color: K.meta }}>No saved locations yet.</p>
    ) : (
      <Sheet scroll={pin} more={fades.sheet} rowsRef={rowsRef} onScroll={showFades} style={{ marginTop: 14 }}>
        {savedLocations.map((location, index) => (
          <Row
            key={index}
            icon={iconFor(location.placeType)}
            title={nameOf(location) || 'Saved place'}
            sub={str(location.address?.formatted)}
            trail={ArrowRight}
            onClick={() => handleSelectSavedLocation(location)}
            first={index === 0}
            last={index === savedLocations.length - 1}
          />
        ))}
      </Sheet>
    );
  } else if (mode === 'search') {
    described = undefined;
    const showHint = !searchable(searchQuery);
    const n = searchResults.length;
    // The persistent status line reads the outcome: searching, the count, or the
    // no-results words (an error note is role=alert and reads itself).
    const status = searching ? 'Searching…' : n > 0 ? `${n} ${n === 1 ? 'result' : 'results'}` : note?.kind === 'empty' ? note.text : '';
    header = (
      <>
        {backAndClose(<>Choose a <em style={EM}>destination</em></>)}
        {/* The field is pinned above the results, so results and the keyboard can't push
            it off the screen. */}
        <div style={{ marginTop: 12 }}>
          <label htmlFor={inputId} style={{ display: 'block', marginBottom: 8, fontSize: fs(13), fontWeight: 600, lineHeight: 18 / 13, color: K.meta }}>
            Enter a specific location
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              color={NEUTRAL.tealInk}
              strokeWidth={2}
              aria-hidden="true"
              focusable="false"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              id={inputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Empire State Building, JFK Airport, hotel address..."
              aria-describedby={showHint ? hintId : undefined}
              className="placeholder:text-ink-3"
              style={{
                display: 'block',
                width: '100%',
                minHeight: 52,
                boxSizing: 'border-box',
                margin: 0,
                padding: '0 44px',
                borderRadius: 14,
                background: NEUTRAL.white,
                // Umber at 70%: the field's edge reaches 3:1 against the kraft.
                border: `1px solid ${rgba(K.accent, 0.7)}`,
                fontFamily: 'inherit',
                fontSize: fs(16),
                color: NEUTRAL.ink,
              }}
            />
            {searching ? (
              <LoaderCircle
                size={16}
                color={NEUTRAL.ink3}
                strokeWidth={2}
                className="motion-safe:animate-spin"
                aria-hidden="true"
                focusable="false"
                style={{ position: 'absolute', right: 14, top: '50%', marginTop: -8, pointerEvents: 'none' }}
              />
            ) : null}
          </div>
          <p role="status" className="sr-only">{status}</p>
        </div>
      </>
    );
    // The hint sits in the body, under the field: it goes when results can come, so the
    // pinned band above the results keeps one height while the traveler types.
    bodyStyle = { ...bodyStyle, paddingTop: showHint ? 8 : 12 };
    body = (
      <>
        {showHint ? (
          <p id={hintId} style={{ flex: 'none', margin: 0, fontSize: fs(12.5), lineHeight: 16 / 12.5, color: K.meta }}>
            Type at least 3 characters to search.
          </p>
        ) : null}
        {note ? (
          <Note
            kind={note.kind}
            text={note.text}
            action={note.kind === 'error' ? { label: 'Try again', onClick: retrySearch } : null}
            style={{ flex: 'none' }}
          />
        ) : null}
        {n > 0 ? (
          <>
            <h3
              className="font-mono"
              style={{ flex: 'none', margin: '0 0 8px 4px', fontSize: fs(10.5), fontWeight: 500, lineHeight: 14 / 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: K.kicker }}
            >
              Search results
            </h3>
            <Sheet scroll={pin} more={fades.sheet} rowsRef={rowsRef} onScroll={showFades}>
              {searchResults.map((result, index) => {
                const isCity = result.granularity === 'city';
                const type = str(result.placeType);
                const name = str(result.placeName);
                const address = str(result.address?.formatted);
                return (
                  <Row
                    key={index}
                    top
                    icon={isCity ? Building2 : iconFor(type)}
                    kicker={isCity ? 'City' : type && type !== 'location' ? type.replace('_', ' ') : ''}
                    kickerColor={isCity ? K.kicker : NEUTRAL.ink3}
                    title={name || address || 'Unnamed place'}
                    sub={name ? address : ''}
                    extra={
                      isCity ? (
                        <span style={{ display: 'block', marginTop: 2, fontSize: fs(12.5), fontWeight: 500, lineHeight: 16 / 12.5, color: NEUTRAL.tealInk }}>
                          Search across the city
                        </span>
                      ) : null
                    }
                    trail={ArrowRight}
                    onClick={() => handleSelectNavigateLocation(result)}
                    first={index === 0}
                    last={index === n - 1}
                  />
                );
              })}
            </Sheet>
          </>
        ) : null}
      </>
    );
  } else {
    // info: the 1.5 s hold after a search pick. No buttons: it closes itself, and the
    // scrim, Escape and the swipe still close it. Its body never scrolls by itself.
    padding = '24px 20px 24px';
    bodyStyle = { flex: 'none', display: 'block', textAlign: 'center' };
    const pickedName = str(picked?.placeName) || str(picked?.address?.city);
    body = (
      <>
        <motion.div
          aria-hidden="true"
          initial={reduce ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            width: 56,
            height: 56,
            boxSizing: 'border-box',
            margin: '0 auto',
            borderRadius: 999,
            background: NEUTRAL.white,
            border: `1px solid ${K.chipLine}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPin size={24} color={NEUTRAL.tealInk} strokeWidth={2} aria-hidden="true" focusable="false" />
        </motion.div>
        <h2 id={titleId} className="font-serif" style={{ ...titleStyle(28, 1.05), margin: '14px 0 0', textAlign: 'center' }}>
          Now exploring <em style={EM}>{pickedName || 'your destination'}</em>
        </h2>
        <p id={subId} style={{ margin: '8px 0 0', fontSize: fs(13), lineHeight: 1.4, color: K.meta }}>
          All features will now use your selected location for finding places and information.
        </p>
        <div role="status" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LoaderCircle size={16} color={NEUTRAL.tealInk} strokeWidth={2} className="motion-safe:animate-spin" aria-hidden="true" focusable="false" />
          <span style={{ fontSize: fs(13), fontWeight: 600, lineHeight: 18 / 13, color: NEUTRAL.tealInk }}>Updating…</span>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] overflow-y-auto flex flex-col font-sans" style={frame.overlay}>
      <motion.div
        aria-hidden="true"
        className="fixed inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ background: rgba(NEUTRAL.ink, 0.56), WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
      />

      {/* The folder's place on the screen. On phones it glides between the bottom (select,
          saved) and the top (search, the confirmation) instead of jumping; not on iPad, where
          it stays centred, and not with reduced motion. It is a wrapper so the glide and the
          dialog's own entrance never write the same transform. */}
      <motion.div
        ref={frameRef}
        layout={reduce || isTablet ? false : 'position'}
        layoutDependency={top}
        transition={SPRING}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          boxSizing: 'border-box',
          maxHeight: frame.cap,
          ...(mode === 'search' && frame.searchHeight ? { height: frame.searchHeight } : null),
          ...frame.dialog,
        }}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={described}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          initial={reduce ? { opacity: 0 } : frame.enter}
          animate={{ y: 0, opacity: 1 }}
          transition={reduce ? { duration: 0.15 } : SPRING}
          style={{
            position: 'relative',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        >
          <div ref={tabRef} aria-hidden="true" style={{ flex: 'none' }}>
            <FolderTab tone="services" size="home" as="p" style={{ borderTop: edge, borderLeft: edge, borderRight: edge }}>
              Where to
            </FolderTab>
          </div>
          <Folder
            stock="services"
            size="home"
            padding={padding}
            onScroll={showFades}
            style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
            boxStyle={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 22,
              boxShadow: frame.shadow,
              ...(whole ? { overflow: 'auto', overscrollBehavior: 'contain', scrollPaddingBottom: FADE } : null),
            }}
          >
            <div ref={regionRef} style={regionStyle}>
              <div ref={scrollRef} onScroll={showFades} style={scrollStyle}>
                <div ref={headerRef} style={{ flex: 'none' }}>
                  {header}
                </div>
                <div ref={bodyRef} style={bodyStyle}>
                  {body}
                </div>
              </div>
              {fades.region ? <Fade color={K.fill} /> : null}
            </div>
            {footer ? (
              <div ref={footerRef} style={{ flex: 'none' }}>
                {footer}
              </div>
            ) : null}
          </Folder>
          {fades.box ? <Fade color={K.fill} inset={1} radius="0 0 21px 21px" /> : null}
        </motion.div>
      </motion.div>
    </div>
  );
}
