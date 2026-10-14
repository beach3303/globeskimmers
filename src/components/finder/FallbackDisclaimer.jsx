// FallbackDisclaimer: the honest note when a search found no exact match (extracted from
// PlacesToEat, where it and AlsoServesBanner lived). It sits in FinderHeader's one note
// slot, on the world wash with a lucide Info, and prints only when the worker says so:
//
//   fallback     fallbackInfo.needed: the search had an intent (a dish or a cuisine) and
//                no Dish Specialist or Authentic Match came back. 'No exact match nearby',
//                why, 'Closest match: {name} · {distance}' when the worker knows one, and
//                'Search somewhere else' (every finder already searches the 25-mile net, so
//                moving the search is the honest way to widen it).
//   alsoServes   banner.cuisine: a strict dish search found nothing, and the list shows
//                nearby restaurants of the dish's cuisine instead. 'No exact "{dish}"
//                nearby', 'Showing nearby {cuisine} restaurants you might like instead.'
// Never both: the fallback wins. With neither it renders nothing. The headline never
// names a cuisine in a negative ('no Chinese food'), only the search. AlsoServes is the
// second variant on its own.
//
// Props: world (WORLD row or key; default 'eat'), fallbackInfo (the worker's
// { needed, nearestAuthenticName, nearestAuthenticDistanceMiles }), banner ({ cuisine,
// queryLabel }), onSearchElsewhere (opens the location picker), formatDistance (miles ->
// the traveler's unit, from useDistanceUnit; without it the miles are printed).
//
// fallbackNoteKind(fallbackInfo, banner) -> 'fallback' | 'alsoServes' | null tells a page
// whether this note will print, so it can pass the next note in line (the city line, its
// own hint) when it won't:
//   note={fallbackNoteKind(fi, banner) ? <FallbackDisclaimer ... /> : null}
import React from 'react';
import { Info } from 'lucide-react';
import { WorldNote } from './FinderControls';

/**
 * @param {any} fallbackInfo
 * @param {any} banner
 * @returns {'fallback'|'alsoServes'|null}
 */
export function fallbackNoteKind(fallbackInfo, banner) {
  if (fallbackInfo && fallbackInfo.needed) return 'fallback';
  if (banner && banner.cuisine) return 'alsoServes';
  return null;
}

/**
 * @param {{
 *   world?: any, fallbackInfo?: any, banner?: any, onSearchElsewhere?: () => void,
 *   formatDistance?: (miles: number) => string, className?: string, style?: import('react').CSSProperties,
 * }} props
 */
export default function FallbackDisclaimer({
  world = 'eat',
  fallbackInfo = null,
  banner = null,
  onSearchElsewhere = undefined,
  formatDistance = undefined,
  className = undefined,
  style = undefined,
}) {
  const kind = fallbackNoteKind(fallbackInfo, banner);
  if (!kind) return null;
  const action = onSearchElsewhere ? { label: 'Search somewhere else', onClick: onSearchElsewhere } : undefined;

  if (kind === 'fallback') {
    const name = typeof fallbackInfo.nearestAuthenticName === 'string' ? fallbackInfo.nearestAuthenticName.trim() : '';
    const miles = Number(fallbackInfo.nearestAuthenticDistanceMiles);
    const hasMiles = fallbackInfo.nearestAuthenticDistanceMiles != null && Number.isFinite(miles) && miles >= 0;
    const distance = hasMiles ? (typeof formatDistance === 'function' ? formatDistance(miles) : `${miles} mi`) : '';
    return (
      <WorldNote world={world} icon={Info} title="No exact match nearby" action={action} className={className} style={style}>
        These are the closest options we found — they may be a good fit, but aren't an exact match for your search.
        {name ? (
          <span style={{ display: 'block', marginTop: 4 }}>
            Closest match: <strong style={{ fontWeight: 600 }}>{name}</strong>
            {distance ? ` · ${distance}` : ''}
          </span>
        ) : null}
      </WorldNote>
    );
  }

  const label = typeof banner.queryLabel === 'string' && banner.queryLabel.trim() ? `“${banner.queryLabel.trim()}”` : 'match';
  return (
    <WorldNote world={world} icon={Info} title={`No exact ${label} nearby`} action={action} className={className} style={style}>
      Showing nearby <strong style={{ fontWeight: 600 }}>{banner.cuisine}</strong> restaurants you might like instead.
    </WorldNote>
  );
}

// The also-serves note alone (a page that has no fallbackInfo to pass).
/** @param {{ world?: any, banner?: any, onSearchElsewhere?: () => void, className?: string, style?: import('react').CSSProperties }} props */
export function AlsoServes({ world = 'eat', banner = null, onSearchElsewhere = undefined, className = undefined, style = undefined }) {
  return <FallbackDisclaimer world={world} banner={banner} onSearchElsewhere={onSearchElsewhere} className={className} style={style} />;
}

export { FallbackDisclaimer };
