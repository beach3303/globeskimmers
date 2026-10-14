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
// The sheet is a modal dialog: it is named by the page's title, focus moves into it on
// open and on each page change and back to the opener on close, Tab stays inside it, and
// Escape, a scrim tap or the global swipe-down close it. Closing is instant.
import React, { useState, useEffect, useRef, useId } from 'react';
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
  ShoppingBag,
  TrainFront,
  Trees,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { callWorker } from '@/lib/callWorker';
import { ROUTE } from '@/lib/workerRoutes';
import { useLocation } from './LocationContext';
import { useIsTablet } from '@/lib/useIsTablet';
import { useKeyboardOffset } from '@/lib/useKeyboardOffset';
import { useDismissable } from '@/lib/dismissStack';
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

// Below this visible height (a landscape phone, a small phone with the keyboard up) the
// folder scrolls as one piece instead of pinning its title and button around the rows.
const SHORT_VIEWPORT = 420;

// 100dvh follows the browser's toolbars; WebViews older than Chrome 108 take 100vh.
const VH = typeof window !== 'undefined' && window.CSS && window.CSS.supports && window.CSS.supports('height', '100dvh') ? '100dvh' : '100vh';
const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The window's height while the sheet is open (rotation, split view).
function useViewportHeight(active) {
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 0));
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const update = () => setH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active]);
  return h;
}

// Where the folder sits. Phone: a bottom sheet 16px above the home indicator (or the
// keyboard), at most today's 448px wide. iPad: a centred folder, at most 480px wide and
// 720px tall, centred in the space above the keyboard. cap is the dialog's max height;
// the search page is that tall (iPad: at most 600px) so its pinned field never jumps.
function frameFor(isTablet, keyboardOffset) {
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
    ? `calc(${VH} - ${SAFE_TOP} - ${keyboardOffset + 40}px)`
    : `calc(${VH} - ${SAFE_TOP} - ${SAFE_BOTTOM} - 48px)`;
  return {
    overlay: {
      alignItems: 'stretch',
      paddingTop: `calc(${SAFE_TOP} + 12px)`,
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: keyboardOffset ? keyboardOffset + 16 : `calc(16px + ${SAFE_BOTTOM})`,
    },
    // margin-top auto puts the sheet at the bottom; if it ever outgrows the screen it
    // overflows downward, where the overlay can still scroll to it.
    dialog: { width: '100%', maxWidth: 448, alignSelf: 'center', marginTop: 'auto' },
    cap,
    searchHeight: cap,
    shadow: `0 -16px 36px -20px ${rgba(NEUTRAL.ink, 0.6)}`,
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

// The white sheet that holds the rows (Location-B L204).
function Sheet({ children, style = undefined }) {
  return (
    <div
      style={{
        overflow: 'hidden',
        borderRadius: 16,
        background: NEUTRAL.white,
        border: `1px solid ${K.chipLine}`,
        ...style,
      }}
    >
      {children}
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
// ink-2. role=alert, so it is read out as it appears.
function Note({ text, style = undefined }) {
  return (
    <div
      role="alert"
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
      <CircleAlert size={18} color={K.accent} strokeWidth={2} aria-hidden="true" focusable="false" style={{ flex: 'none' }} />
      <p style={{ margin: 0, minWidth: 0, fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2, overflowWrap: 'anywhere' }}>{text}</p>
    </div>
  );
}

export default function LocationModePicker({ isOpen, onClose, coldOpen = false, lastLocation = null, onSnoozeToday, onPicked = null }) {
  const { switchToCurrentLocation, switchToNavigateMode, getSavedLocations } = useLocation();
  const isTablet = useIsTablet();
  const reduce = useReducedMotion();

  const [mode, setMode] = useState('select'); // 'select', 'search', 'saved', 'info'
  // Only the search page raises the keyboard; its height keeps the folder above it.
  const needsKeyboard = mode === 'search';
  const keyboardOffset = useKeyboardOffset(isOpen && needsKeyboard);
  const viewportHeight = useViewportHeight(isOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(''); // shown on the select page, above the button
  const [errorMessage, setErrorMessage] = useState('');
  const [picked, setPicked] = useState(null); // the search result "Now exploring" names

  // Only the newest search may show its reply: a reply for a query that has since changed,
  // been cleared, or belongs to an earlier opening is dropped.
  const searchSeq = useRef(0);
  const dialogRef = useRef(null);

  const titleId = useId();
  const subId = useId();
  const inputId = useId();
  const hintId = useId();

  useDismissable(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      loadSavedLocations();
      searchSeq.current += 1;
      setMode('select');
      setSearchQuery('');
      setSearchResults([]);
      setSearching(false);
      setErrorMessage('');
      setGpsError('');
      setPicked(null);
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
    setErrorMessage('');
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

  // Saved locations come from on-device storage (src/lib/savedLocations.js), so this is a
  // synchronous read. Entries that aren't objects are skipped.
  const loadSavedLocations = () => {
    const list = getSavedLocations();
    setSavedLocations(Array.isArray(list) ? list.filter(isEntry) : []);
  };

  const performSearch = async (query) => {
    const seq = ++searchSeq.current;
    setSearching(true);
    setErrorMessage('');

    try {
      const { data } = await callWorker(ROUTE.searchLocation, {
        query: query,
      });
      if (seq !== searchSeq.current) return;

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results.filter(isEntry));
        setErrorMessage('');
      } else {
        setSearchResults([]);
        setErrorMessage(data.message || NO_RESULTS);
      }
    } catch (error) {
      if (seq !== searchSeq.current) return;
      console.error('Error searching locations:', error);
      setSearchResults([]);
      setErrorMessage(SEARCH_ERROR);
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
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

  const frame = frameFor(isTablet, keyboardOffset);
  // Pinned: the title and the buttons stay put and only the middle scrolls. Short screens
  // scroll the whole folder instead, so nothing is cut off.
  const pinned = viewportHeight - keyboardOffset >= SHORT_VIEWPORT;
  /** @type {CSS} */
  const bodyStyle = pinned ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' } : { flex: 'none' };
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
    const lastName = coldOpen && lastLocation?.placeType !== 'current_location'
      ? str(lastLocation?.placeName) || str(lastLocation?.address?.city)
      : '';
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
      <div style={{ flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id={titleId} className="font-serif" style={titleStyle(28, 1.05)}>
            {coldOpen ? (
              <>Where would you like to <em style={EM}>explore</em>?</>
            ) : (
              <>Choose your <em style={EM}>starting point</em></>
            )}
          </h2>
          <IconButton label="Close" icon={X} onClick={onClose} margin="-8px -8px 0 0" />
        </div>
        <p id={subId} style={subStyle}>Globeskimmers finds places near your starting point.</p>
      </div>
    );
    body = (
      <div style={bodyStyle}>
        <Sheet style={{ marginTop: 14 }}>
          {rows.map(({ key, ...row }, i) => (
            <Row key={key} {...row} first={i === 0} last={i === rows.length - 1} />
          ))}
        </Sheet>
      </div>
    );
    footer = (
      <div style={{ flex: 'none' }}>
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
      </div>
    );
  } else if (mode === 'saved') {
    header = (
      <div style={{ flex: 'none' }}>
        {backAndClose(<>Saved <em style={EM}>locations</em></>)}
        <p id={subId} style={subStyle}>Tap a place to navigate from it.</p>
      </div>
    );
    body = (
      <div style={bodyStyle}>
        {savedLocations.length === 0 ? (
          <p style={{ margin: 0, padding: '40px 0', textAlign: 'center', fontSize: fs(13), lineHeight: 18 / 13, color: K.meta }}>No saved locations yet.</p>
        ) : (
          <Sheet style={{ marginTop: 14 }}>
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
        )}
      </div>
    );
  } else if (mode === 'search') {
    described = undefined;
    const showHint = !searchable(searchQuery);
    const n = searchResults.length;
    const status = searching ? 'Searching…' : n > 0 ? `${n} ${n === 1 ? 'result' : 'results'}` : '';
    header = (
      <div style={{ flex: 'none' }}>
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
          {showHint ? (
            <p id={hintId} style={{ margin: '8px 0 0', fontSize: fs(12.5), lineHeight: 16 / 12.5, color: K.meta }}>
              Type at least 3 characters to search.
            </p>
          ) : null}
          <p role="status" className="sr-only">{status}</p>
        </div>
      </div>
    );
    body = (
      <div style={{ ...bodyStyle, paddingTop: 12 }}>
        {errorMessage ? <Note text={errorMessage} style={{ marginBottom: n > 0 ? 12 : 0 }} /> : null}
        {n > 0 ? (
          <>
            <h3
              className="font-mono"
              style={{ margin: '0 0 8px 4px', fontSize: fs(10.5), fontWeight: 500, lineHeight: 14 / 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: K.kicker }}
            >
              Search results
            </h3>
            <Sheet>
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
      </div>
    );
  } else {
    // info: the 1.5 s hold after a search pick. No buttons: it closes itself, and the
    // scrim, Escape and the swipe still close it.
    padding = '24px 20px 24px';
    const pickedName = str(picked?.placeName) || str(picked?.address?.city);
    body = (
      <div style={{ ...bodyStyle, textAlign: 'center' }}>
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
      </div>
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
        transition={reduce ? { duration: 0.15 } : { type: 'spring', damping: 28, stiffness: 320 }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          boxSizing: 'border-box',
          outline: 'none',
          maxHeight: frame.cap,
          ...(mode === 'search' && pinned ? { height: frame.searchHeight } : null),
          ...frame.dialog,
        }}
      >
        <div aria-hidden="true" style={{ flex: 'none' }}>
          <FolderTab tone="services" size="home" as="p" style={{ borderTop: edge, borderLeft: edge, borderRight: edge }}>
            Where to
          </FolderTab>
        </div>
        <Folder
          stock="services"
          size="home"
          padding={padding}
          style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
          boxStyle={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 22,
            boxShadow: frame.shadow,
            ...(pinned ? null : { overflow: 'auto', overscrollBehavior: 'contain' }),
          }}
        >
          {header}
          {body}
          {footer}
        </Folder>
      </motion.div>
    </div>
  );
}
