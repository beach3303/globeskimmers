// StampThumb: one passport stamp at thumbnail size, for the surfaces outside the booklet
// (Home's passport tile, stamps-near-you discs and the shelf, the profile's passport folder,
// Mailbox envelopes and postcards). It follows PassportBook's StampToken, so a stamp looks
// the same here as in the booklet, minus the booklet's captions, photos and the emoji flag
// badge:
//
//   1. a Local favorite (entity_id lf:<n>)    LocalFavoriteStamp, its round teal stamp
//   2. an airport                             AirportStamp (IATA from entity_id), else
//                                             the typographic stamp
//   3. a land crossing (stampKind.js)         LandStamp, state or country template
//   4. anything else                          the bespoke art from stampArtUrl, unless the
//                                             stamp is a country or its owner chose text
//                                             only (isPlainArt); when the art is missing or
//                                             fails to load, TypographicStamp (strength 2,
//                                             dated visited_on)
//
//   <StampThumb stamp size tilt feedSafe strength label className style />
//   stamp      a passport row ({ name, city, region, country, kind, entity_id, entity_type,
//              visited_on, meta }). An attraction row is a stamp not yet collected: pass
//              { ...row, entity_id: row.id } so its art is found by id. A social/feed row
//              goes through feedStamp() in src/lib/stampKind.js first.
//   size       the width in px (default 64). Square kinds are size x size. Airport and
//              land stamps are wide, 1.52:1 (size x size/1.52).
//   tilt       degrees (-3), or true for the booklet's own -4..+4 tilt from the stamp's id.
//   feedSafe   for someone else's stamp in a feed (Mailbox, Home's circle, postcards). A
//              place of respect (respectPlaces.js) prints typographic whatever its owner
//              chose, because the feed doesn't carry that choice. An airport without an
//              IATA code and a state crossing without its entity_type render NOTHING: the
//              caller draws its postmark ring (Envelope's PostmarkRing). Today's feed sends
//              neither field, so both kinds show the ring until backend item B6 sends them.
//   strength   the typographic stamp's ink (default STAMP_INK_STRENGTH, 2). The boards
//              print a stamp not yet collected at 0, the original worn look.
//   label      by default the thumb is decorative (aria-hidden): the tile around it names
//              the stamp (principle 8). With a label it is one role=img with that name.
//
// Print it only on cream or white: the art, the inks and the wide stamps are drawn for
// paper, never for a cloth, a plate or a dark zone.
//
// stampThumbKind(stamp, { feedSafe }) gives 'local' | 'airport' | 'land' | 'art' | 'type',
// or null when StampThumb would render nothing, so a caller can choose its stand-in.
import React, { useState } from 'react';
import { stampArtUrl } from '@/lib/stampArt';
import { isPlainArt, respectPlaceFor } from '@/lib/respectPlaces';
import { STAMP_INK_STRENGTH } from '@/lib/stampDesign';
import { WIDE_STAMP_RATIO, iataOf, isLandCrossing } from '@/lib/stampKind';
import AirportStamp from '@/components/passport/AirportStamp';
import LandStamp from '@/components/passport/LandStamp';
import TypographicStamp from '@/components/passport/TypographicStamp';
import LocalFavoriteStamp, { isLocalFavorite } from '@/components/passport/LocalFavoriteStamp';

/** @typedef {import('react').CSSProperties} CSS */

const clean = (v) => String(v ?? '').trim();

// What to draw for a stamp: { kind, art, iata } or null.
function planThumb(stamp, feedSafe) {
  if (!stamp || typeof stamp !== 'object') return null;
  if (isLocalFavorite(stamp)) return { kind: 'local', art: null, iata: null };
  if (stamp.kind === 'airport') {
    const iata = iataOf(stamp);
    if (iata) return { kind: 'airport', art: null, iata };
    if (feedSafe) return null;
    return clean(stamp.name) ? { kind: 'type', art: null, iata: null } : null;
  }
  if (isLandCrossing(stamp)) {
    if (feedSafe && stamp.kind === 'state' && !stamp.entity_type) return null;
    return { kind: 'land', art: null, iata: null };
  }
  if (!clean(stamp.name)) return null;
  if (feedSafe && respectPlaceFor({ name: stamp.name, kind: stamp.kind })) return { kind: 'type', art: null, iata: null };
  const art = stamp.kind === 'country' || isPlainArt(stamp)
    ? null
    : stampArtUrl(stamp.name, { entityId: stamp.entity_id, country: stamp.country });
  return art ? { kind: 'art', art, iata: null } : { kind: 'type', art: null, iata: null };
}

/**
 * @param {any} stamp
 * @param {{ feedSafe?: boolean }} [opts]
 * @returns {'local'|'airport'|'land'|'art'|'type'|null}
 */
export function stampThumbKind(stamp, opts) {
  const p = planThumb(stamp, !!(opts && opts.feedSafe));
  return p ? /** @type {any} */ (p.kind) : null;
}

// The booklet's tilt (PassportBook StampToken): -4..+4 degrees from the stamp's id.
const hashStr = (s) => {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * @param {{
 *   stamp: any, size?: number, tilt?: number|boolean, feedSafe?: boolean, strength?: number,
 *   label?: string, className?: string, style?: CSS,
 * }} props
 */
export default function StampThumb({
  stamp,
  size = 64,
  tilt = 0,
  feedSafe = false,
  strength = STAMP_INK_STRENGTH,
  label = undefined,
  className = undefined,
  style = undefined,
}) {
  // The art URL that failed to load, so a stamp whose art changes tries the new file.
  const [failed, setFailed] = useState(/** @type {string|null} */ (null));
  const plan = planThumb(stamp, feedSafe);
  if (!plan) return null;

  const w = Math.max(1, Math.round(Number(size) || 64));
  const kind = plan.kind === 'art' && failed === plan.art ? 'type' : plan.kind;
  const wide = kind === 'airport' || kind === 'land';
  const h = wide ? Math.round(w / WIDE_STAMP_RATIO) : w;
  const rot = tilt === true
    ? (hashStr(stamp.id || stamp.entity_id || stamp.name) % 9) - 4
    : Number.isFinite(Number(tilt)) ? Number(tilt) : 0;
  const date = stamp.visited_on || null;
  const direction = stamp.meta?.direction || null;
  const named = typeof label === 'string' && label.trim() !== '';

  let body;
  if (kind === 'local') {
    body = <LocalFavoriteStamp name={stamp.name} city={stamp.city} country={stamp.country} date={date} width={w} />;
  } else if (kind === 'airport') {
    body = (
      <AirportStamp iata={plan.iata} city={stamp.city} country={stamp.country} countryCode={stamp.country}
        date={date} direction={direction} width={w} />
    );
  } else if (kind === 'land') {
    body = stamp.kind === 'state'
      ? <LandStamp template="state" name={stamp.region || stamp.name} date={date} direction={direction} width={w} />
      : (
        <LandStamp template="country" name={clean(stamp.name).split(' · ')[0]}
          countryCode={String(stamp.entity_id || '').split(':')[0]} date={date} direction={direction} width={w} />
      );
  } else if (kind === 'art') {
    body = (
      <img src={plan.art} alt="" loading="lazy" decoding="async" width={w} height={w}
        onError={() => setFailed(plan.art)} style={{ display: 'block', width: w, height: w, objectFit: 'contain' }} />
    );
  } else {
    // A legacy country stamp is named '<Country> · Border Crossing': the stamp prints the
    // country. Everything else prints its own name.
    const name = stamp.kind === 'country' ? clean(stamp.name).split(' · ')[0] : clean(stamp.name);
    // design and ink stay the stamp's own (stampDesign.js); they are passed as undefined
    // only because TypographicStamp declares them without defaults.
    body = (
      <TypographicStamp name={name} city={stamp.city} region={stamp.region} country={stamp.country} date={date}
        entityId={stamp.entity_id || stamp.id} width={w} strength={strength} film={stamp.meta?.film || null}
        design={undefined} ink={undefined} />
    );
  }

  return (
    <span
      aria-hidden={named ? undefined : 'true'}
      role={named ? 'img' : undefined}
      aria-label={named ? label : undefined}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: w,
        height: h,
        lineHeight: 0,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        ...style,
      }}
    >
      {body}
    </span>
  );
}
