// What kind of stamp a passport row is, for the renderers outside the booklet: Home's
// passport tile and shelf, the profile's passport folder, Mailbox envelopes and postcards
// (src/components/passport/StampThumb.jsx). Pure functions, no React.
//
// PassportBook.jsx keeps its own copy of isLandCrossing (~L83); the rule below is the same
// one, so the booklet and a thumbnail never disagree about what a stamp is.
import { countryCode } from '@/lib/countries';

// A border crossing prints the LandStamp (founder, 2026-10-05): a state or province line
// always; a country stamp only when it carries a direction, so legacy border stamps keep
// their old look. Copied from PassportBook.jsx ~L83.
export const isLandCrossing = (s) =>
  !!s && (s.kind === 'state' || (s.kind === 'country' && s.entity_type === 'border' && !!s.meta?.direction));

// An airport stamp keeps its IATA code as entity_id ('LAX'; AirportArrivalPrompt ~L81).
// Anything that isn't three letters gives null, and the stamp then prints typographic.
export function iataOf(s) {
  const code = String(s?.entity_id ?? '').split(':')[0].trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

// The code an airport stamp's name ends with: 'Los Angeles (LAX)' gives 'LAX'. Airport
// stamps are named `${city} (${IATA})` when they are minted, which is all the feed sends
// today. Upper case only, so a name like 'Café (Old)' never reads as a code.
export function airportCodeIn(name) {
  const m = /\(([A-Z]{3})\)\s*$/.exec(String(name ?? ''));
  return m ? m[1] : null;
}

// Airport and land stamps are drawn in a 340x224 box: 1.52 wide to 1 high. Every other
// stamp is square.
export const WIDE_STAMP_RATIO = 340 / 224;

// A stamp's country as a two-letter code for a mono place line ('LISBON · PT'). Airport
// stamps store the ISO code itself (AirportArrivalPrompt ~L82); other stamps store the
// name. A name we can't resolve gives null rather than a long name.
export function stampCountryCode(country) {
  const v = String(country ?? '').trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return countryCode(v) || null;
}

// A social/feed row in the stamp shape StampThumb reads. Today's feed sends a stamp row's
// name, city, country, kind, visited_on and film. Backend item B6 adds entity_id, region,
// entity_type, art and direction at the top level of the row; they map to the stamp's own
// fields here, so the art appears the day the worker sends them. A postcard row gives the
// stamp of its place (the postcard's stamp box). No usable name gives null.
export function feedStamp(row) {
  if (!row || typeof row !== 'object') return null;
  const postcard = row.type === 'postcard';
  const name = String((postcard ? row.place || row.city : row.name) ?? '').trim();
  if (!name) return null;
  return {
    name,
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    kind: postcard ? null : row.kind || null,
    entity_id: postcard ? null : row.entity_id ?? null,
    entity_type: postcard ? null : row.entity_type || null,
    visited_on: postcard ? null : row.visited_on || null,
    meta: {
      art: postcard ? null : row.art || null,
      direction: postcard ? null : row.direction || null,
      film: postcard ? null : row.film || null,
    },
  };
}
