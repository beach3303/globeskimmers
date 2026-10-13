// Globeskimmers design tokens.
//
// The new look ("Papers & Inks, filed"), approved by the founder on 2026-10-13. The spec is
// pinned in docs/design/new-look/ (README.md there). Migrated code takes every colour from
// WORLD, ZONE, CLOTH, FOIL or NEUTRAL below, never from a hex literal of its own.
//
// The raw values live in ./worlds.json, which tailwind.config.js also reads (colors.world,
// zone, cloth, ink, cream, stamp, open). This file adds names, labels, derived values and
// the fs()/rgba() helpers. Weather is Bluebird and ATMs is Carbon Copy (the founder's picks,
// 2026-10-13).
//
// No React or lucide imports here: the motif and icon maps import this file, so importing
// them back would make a cycle. Icons and motifs are named by string (lucide names, motif
// component names); finder/motifs/index.js maps the names to components.
import T from './worlds.json';

// ── Legacy tokens (the 2025 redesign) ────────────────────────────────────

// Brand teal gradient: banner, primary brand surfaces, final CTA
export const TEAL_GRADIENT = 'linear-gradient(135deg, #0E8077 0%, #14B5A6 60%, #2DD4BF 100%)';
export const TEAL_DEEP = '#0E7C73';

// CAT is FROZEN: the old per-category colours, kept unchanged for the pages that still use
// them (Settings and SavedLocations, which keep today's look in this phase; each finder
// until its slice moves it to WORLD). Never add a CAT user, and never alias it to WORLD:
// the new worlds are different colours. CAT_TO_WORLD below maps a CAT key to its world.
export const CAT = {
  food:        { ink: '#E63946', bg: '#FFE4E0', soft: '#FFCFC5', label: 'Food' },
  money:       { ink: '#0F9A6B', bg: '#D8F4E5', soft: '#A8E5C4', label: 'Money' },
  coffee:      { ink: '#A85A2E', bg: '#F2DDC4', soft: '#E6BC96', label: 'Coffee' },
  transit:     { ink: '#3F49D4', bg: '#DFE2FA', soft: '#BBC2F4', label: 'Transit' },
  restroom:    { ink: '#0F8A82', bg: '#D2EFEC', soft: '#A7DDD7', label: 'Restroom' },
  atm:         { ink: '#1F5BD6', bg: '#DCE6FB', soft: '#B3C7F4', label: 'ATM' },
  weather:     { ink: '#D4861A', bg: '#FCEAC9', soft: '#F4D597', label: 'Weather' },
  todo:        { ink: '#C5197A', bg: '#FBDEEB', soft: '#F2B0D0', label: 'Things to do' },
  shopping:    { ink: '#7C3AED', bg: '#EAE0FA', soft: '#D0B6F4', label: 'Shopping' },
  culture:     { ink: '#8B5A1A', bg: '#F3E2C7', soft: '#E5CA98', label: 'Culture' },
  phrases:     { ink: '#A37013', bg: '#F8ECC4', soft: '#EED890', label: 'Phrases' },
  convenience: { ink: '#15803D', bg: '#D4F0DA', soft: '#A4DCB0', label: 'Convenience' },
};

// Shadows tuned to land between flat-ish and "card pops" without being heavy.
export const SHADOW_CARD_SOFT = '0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)';

// Editorial-ivory canvas: the global app background per redesign.
export const IVORY = '#FFFCF7';
export const IVORY_2 = '#F7F4EC';

// ── Helpers ──────────────────────────────────────────────────────────────

// A size that follows the text-size setting: fs(13) gives 'calc(13px * var(--fs, 1))'.
// The artboards are drawn in fixed px at --fs 1; build every font size with fs().
export const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// '#RRGGBB' or '#RGB' plus an alpha gives 'rgba(r,g,b,a)'. Any other value (a gradient, a
// colour that is already rgba, null) comes back unchanged.
export function rgba(hex, a) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(typeof hex === 'string' ? hex.trim() : '');
  if (!m) return hex;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Tokens are shared by every page, so they are frozen: a page that needs a variation makes
// its own copy ({ ...WORLD.eat, ... }) instead of changing the original.
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
}

// ── Neutrals ─────────────────────────────────────────────────────────────
// ink #16110D, ink2 #3A3128 and ink3 #736657 are the shared text inks (never ink3 on the
// mid zones, kraft and sage). stamp is also the 'Closed' red; open is the 'Open' green.
export const NEUTRAL = freeze({ ...T.neutral });

// Gold foil: cloth covers (frame, kicker, italic) and the focus ring on them.
export const FOIL = T.foil;

// ── Finder worlds ────────────────────────────────────────────────────────
// One world per finder. Every finder is the same page printed on a different stock; only
// these tokens change.

export const FINDER_ORDER = Object.freeze([
  'eat', 'coffee', 'todo', 'restroom', 'atm', 'money', 'weather', 'phrases', 'culture', 'convenience', 'shopping',
]);

// Names and words. label: crests, tiles and chips. kickerName: the first fragment of the
// plate kicker. action: the label Home's handleQuickAction routes on. page: the page key
// in pages.config.js. icon: the lucide name. motif: the world's motif (bible). plateMotif:
// the one drawn on the plate, null when the plate carries none (Weather's plate is flat;
// Shopping's swing tag is the plate tag and carries the count). title: the default title,
// one italic word; pages may rewrite it (a search, the time of day, the language).
const META = {
  eat:         { label: 'Eat',            kickerName: 'PLACES TO EAT',  action: 'Places to Eat',       page: 'PlacesToEat',        icon: 'UtensilsCrossed', motif: 'MenuLeader',   plateMotif: 'MenuLeader',   title: { pre: 'Places to ', italic: 'eat', post: '' } },
  coffee:      { label: 'Coffee',         kickerName: 'COFFEE',         action: 'Coffee',              page: 'CoffeeFinder',       icon: 'Coffee',          motif: 'CupRing',      plateMotif: 'CupRing',      title: { pre: 'Your next ', italic: 'cup', post: '' } },
  todo:        { label: 'Things to do',   kickerName: 'THINGS TO DO',   action: 'Things to Do',        page: 'ThingsToDo',         icon: 'Compass',         motif: 'Contours',     plateMotif: 'Contours',     title: { pre: 'Things to ', italic: 'do', post: '' } },
  restroom:    { label: 'Restrooms',      kickerName: 'RESTROOMS',      action: 'Restroom',            page: 'RestroomFinder',     icon: 'Toilet',          motif: 'Tile',         plateMotif: 'Tile',         title: { pre: 'The nearest ', italic: 'restroom', post: '' } },
  atm:         { label: 'ATMs',           kickerName: 'ATMS',           action: 'ATM',                 page: 'ATMFinder',          icon: 'CreditCard',      motif: 'SecurityTint', plateMotif: 'SecurityTint', title: { pre: 'Cash, ', italic: 'nearby', post: '' } },
  money:       { label: 'Money exchange', kickerName: 'MONEY EXCHANGE', action: 'Money Exchange',      page: 'MoneyExchange',      icon: 'Banknote',        motif: 'Guilloche',    plateMotif: 'Guilloche',    title: { pre: 'What your money is ', italic: 'worth', post: '' } },
  weather:     { label: 'Weather',        kickerName: 'WEATHER',        action: 'Weather',             page: 'Weather',            icon: 'CloudSun',        motif: 'DayArc',       plateMotif: null,           title: { pre: 'The week ', italic: 'ahead', post: '' } },
  phrases:     { label: 'Phrases',        kickerName: 'PHRASEBOOK',     action: 'Basic Phrases',       page: 'BasicPhrases',       icon: 'Languages',       motif: 'ThumbIndex',   plateMotif: 'Weave',        title: { pre: 'Say it ', italic: 'like a local', post: '' } },
  culture:     { label: 'Culture',        kickerName: 'CULTURE GUIDE',  action: 'Culture Information', page: 'CultureInformation', icon: 'Landmark',        motif: 'AccessionTag', plateMotif: 'AccessionTag', title: { pre: 'Know before you ', italic: 'go', post: '' } },
  convenience: { label: 'Convenience',    kickerName: 'CONVENIENCE',    action: 'Convenience Store',   page: 'ConvenienceStore',   icon: 'Store',           motif: 'LitWindow',    plateMotif: 'LitWindow',    title: { pre: 'The corner ', italic: 'store', post: '' } },
  shopping:    { label: 'Shopping',       kickerName: 'SHOPPING',       action: 'Shopping',            page: 'Shopping',           icon: 'ShoppingBag',     motif: 'SwingTag',     plateMotif: null,           title: { pre: 'Shops & ', italic: 'markets', post: '' } },
};

// How each world's shared parts are cut, read from the pinned artboards. Strings name a
// field of the world row (or a NEUTRAL), so no colour is written twice. Missing keys use
// LOOK_DEFAULT.
//   strip: [height px, field]  the no-photo strip on a card
//   pillTrack, glassBorder     dark plates: alphas of the unit-pill track and of the circle
//                              and pill borders, in the plate's 'glass' colour
//   pillOff                    light plates: the inactive unit label
//   circle: [fill, border]     light plates: the back and refresh circles
//   chipOnInk, chipDot         the active chip's label, and coffee's ember dot
const LOOK_DEFAULT = {
  strip: [72, 'wash'], numberShape: 'circle', photoAspect: '16 / 10', shadowAlpha: 0.35,
  pillTrack: 0.1, glassBorder: 0.3, pillOff: 'ink2', circle: ['white', 'line'],
  chipOnInk: 'white', chipDot: null,
};
const LOOK = {
  eat:         { strip: [72, 'plate'], pillTrack: 0.06 },
  coffee:      { strip: [96, 'plate'], numberShape: 'ring', shadowAlpha: 0.4, pillTrack: 0.06, chipOnInk: 'plateTitle', chipDot: 'cta' },
  restroom:    { strip: [72, 'plate'], photoAspect: '16 / 9' },
  atm:         { strip: [52, 'mist'], numberShape: 'chip', photoAspect: '16 / 9' },
  weather:     { glassBorder: 0.28 },
  phrases:     { circle: ['paper', 'ink'] },
  convenience: { strip: [60, 'plate'], pillTrack: 0, chipOnInk: 'plateAccent' },
  shopping:    { strip: [64, 'ink'], numberShape: 'swingTag', pillOff: 'ink' },
};

// A field of the row, or the neutral of that name when the row has none ('white', 'ink2').
const field = (row, name) => (own(row, name) ? row[name] : NEUTRAL[name]);

function finishWorld(key, row, variant) {
  const look = { ...LOOK_DEFAULT, ...(LOOK[key] || {}) };
  const dark = row.mode === 'dark';
  // A solid colour that stands for the plate where text sits on a plateTitle fill (the
  // active unit segment). The night plate is a gradient, so it names its own.
  const plateSolid = row.plateSolid || (isHex(row.plate) ? row.plate : row.ink);
  // The colour of the translucent circles and unit pill on a dark plate: plateTitle,
  // except on Weather's night plate, which keeps the day's 10% white.
  const glass = row.glass || row.plateTitle;
  const range = Array.isArray(row.range) ? row.range : null;
  return {
    key,
    variant,
    ...META[key],
    ...row,
    plateSolid,
    // --gs-focus on the plate: plateTitle on dark plates, ink on light ones.
    plateFocus: dark ? row.plateTitle : row.ink,
    // The back and refresh circles: { bg, border, icon }.
    plateCircle: dark
      ? { bg: rgba(glass, 0.1), border: rgba(glass, look.glassBorder), icon: row.plateTitle }
      : { bg: field(row, look.circle[0]), border: field(row, look.circle[1]), icon: row.ink },
    // The MI/KM (Weather: °F/°C) pill on the plate: the track and its border, the active
    // segment (on) and its label (onInk), and the inactive label (off).
    unitPill: dark
      ? {
          track: look.pillTrack ? rgba(glass, look.pillTrack) : 'transparent',
          border: rgba(glass, look.glassBorder),
          on: row.plateTitle,
          onInk: plateSolid,
          off: row.plateLink,
        }
      : { track: NEUTRAL.white, border: row.line, on: row.ink, onInk: NEUTRAL.white, off: field(row, look.pillOff) },
    // The active chip: fill, label and (coffee) the ember dot.
    chipOn: row.ink,
    chipOnInk: field(row, look.chipOnInk),
    chipDot: look.chipDot ? field(row, look.chipDot) : null,
    cardShadow: `0 10px 24px -18px ${rgba(row.ink, look.shadowAlpha)}`,
    // The number on a card: 'circle' | 'ring' (coffee) | 'chip' (atm) | 'swingTag' (shopping).
    numberShape: look.numberShape,
    // CSS aspect-ratio of a card photo.
    photoAspect: look.photoAspect,
    // The no-photo strip: { height (px), bg }.
    strip: { height: look.strip[0], bg: field(row, look.strip[1]) },
    // Weather's range bars, sky to sun on the week's scale (Weather.dc.html L99); else null.
    rangeGradient: range ? `linear-gradient(90deg, ${range[0]} 0%, ${range[1]} 42%, ${range[2]} 64%, ${range[3]} 100%)` : null,
  };
}

// WORLD.<key>: the raw row from worlds.json, the names above and the derived parts.
// Raw fields: paper, plate, mode ('dark'|'light'), plateTitle, plateKicker, plateAccent,
// plateMeta (the place on the location row), plateLink ('Change' and the plate's other
// secondary words), ink (text-safe on white and paper), accentText (null: use ink),
// iconInk, star, cta, ctaInk, ctaWeight, wash, washInk, line, crest, crestIcon, titleMax,
// and each world's extras (eat tiers, restroom plaques and confidence words, atm chip and
// receipt, weather sun and range, ...). WORLD.weather.night is the after-sunset plate, built
// the same way; worldOf('weather', { night: true }) returns it.
export const WORLD = freeze(Object.fromEntries(FINDER_ORDER.map((key) => {
  const { night, ...row } = T.world[key];
  const day = finishWorld(key, row, 'day');
  return [key, night ? { ...day, night: finishWorld(key, { ...row, ...night }, 'night') } : day];
})));

// Page key (pages.config.js) to world key: PlacesToEat gives 'eat'.
export const WORLD_BY_PAGE = freeze(Object.fromEntries(FINDER_ORDER.map((key) => [WORLD[key].page, key])));

// Legacy CAT key to world key: 'food' gives 'eat'. CAT.transit has no world.
export const CAT_TO_WORLD = freeze({
  food: 'eat', coffee: 'coffee', todo: 'todo', restroom: 'restroom', atm: 'atm', money: 'money',
  weather: 'weather', phrases: 'phrases', culture: 'culture', convenience: 'convenience', shopping: 'shopping',
});

// The world for a world key ('eat'), a legacy CAT key ('food') or a page key ('PlacesToEat').
// { night: true } gives the night variant where a world has one (Weather), else the day.
// An unknown key gives null.
export function worldOf(key, opts) {
  let k = null;
  if (own(WORLD, key)) k = key;
  else if (own(CAT_TO_WORLD, key)) k = CAT_TO_WORLD[key];
  else if (own(WORLD_BY_PAGE, key)) k = WORLD_BY_PAGE[key];
  if (!k) return null;
  const w = WORLD[k];
  return opts && opts.night && w.night ? w.night : w;
}

// ── Home zones ───────────────────────────────────────────────────────────
// ZONE.<passport|circle|services|stamps|shelf|local>: Home's six stocks, plus kit (the
// profile's MY KIT folder) and rows (the iPad-only 'Around you' folder, plan-authored).
// Fields: fill, line (the box border), tab, tabBorder (or null), tabLabel, kicker (the
// band's kicker), rule (the band kicker's hairline), title, accent (the italic word), meta
// (secondary text), radius, step ('dark'|'light'|'mid'), padBand (option A), padBox
// (option B), focus (--gs-focus), and a few extras: passport navyPressed, keyline,
// doubleRule, shadow, tile, coverNight; services chipLine; shelf hairline, rowRule, tile;
// local rowLine, track, heartLine.
export const ZONE = freeze(Object.fromEntries(Object.keys(T.zone).map((key) => [key, { key, ...T.zone[key] }])));

// ── Cloths ───────────────────────────────────────────────────────────────
// CLOTH.<key>: { key, name, cloth, paper, line (about 11% cloth on its paper), fieldLine
// (about 18%) }, in the picker's order. Harbour is the default, and the cloth of anyone
// whose profile has none.
export const CLOTH_ORDER = Object.freeze(Object.keys(T.cloth));
export const DEFAULT_CLOTH = 'harbour';
export const CLOTH = freeze(Object.fromEntries(CLOTH_ORDER.map((key) => [key, { key, ...T.cloth[key] }])));

// The cloth for a stored key; an unknown, empty or missing key gives Harbour.
export function clothOf(key) {
  const k = typeof key === 'string' ? key.trim().toLowerCase() : '';
  return own(CLOTH, k) ? CLOTH[k] : CLOTH[DEFAULT_CLOTH];
}
