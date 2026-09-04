// PhotoOrIcon — the unified finder-card photo strip (Passport Standard).
//
// Generalizes the three near-identical strips (Shopping PhotoStrip, ATMFinder
// ATMPhotoStrip, RestroomFinder PhotoStrip): render the first working photo
// from `photos`, advancing to the next URL on load error; when none survive,
// render the lucide `fallbackIcon` centered on the category tint gradient —
// never a bare colored box, and no emoji (doctrine: icon-on-tint).
//
// While a photo is still loading, the tint + icon tile shows underneath and
// the image fades in on load (same opacity transition as the originals).
//
// Props:
//   photos       — array of photo URLs (nullish/holes tolerated).
//   alt          — img alt text (place name); defaults to ''.
//   fallbackIcon — lucide icon component (e.g. ShoppingBag, CreditCard).
//   tint         — a CAT entry ({ ink, bg, soft }) from redesign constants,
//                  OR a plain ink color string (gradient derived from it).
//   height       — number (px) or CSS string; default 160.
//   className    — extra classes on the outer wrapper.
//   onClick      — optional; makes the strip tappable (photo viewers). Called
//                  with the index of the photo currently shown, or with no
//                  argument from the fallback tile.
//   iconSize     — fallback icon size in px; default 44.
import React, { useState } from 'react';
import { TEAL_DEEP, IVORY_2 } from '@/components/redesign/constants';

function tintStyles(tint) {
  if (tint && typeof tint === 'object') {
    return {
      gradient: `linear-gradient(135deg, ${tint.bg}, ${tint.soft || tint.bg})`,
      ink: tint.ink,
    };
  }
  if (typeof tint === 'string' && tint) {
    return { gradient: `linear-gradient(135deg, ${tint}22, ${tint}44)`, ink: tint };
  }
  return { gradient: `linear-gradient(135deg, ${IVORY_2}, #EDE7D9)`, ink: TEAL_DEEP };
}

export default function PhotoOrIcon({
  photos,
  alt = '',
  fallbackIcon: Icon,
  tint,
  height = 160,
  className = '',
  onClick,
  iconSize = 44,
}) {
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState({});

  const H = typeof height === 'number' ? `${height}px` : height;
  const { gradient, ink } = tintStyles(tint);
  const shownIdx = (photos || []).findIndex((p, i) => p && !errors[i]);
  const url = shownIdx >= 0 ? photos[shownIdx] : null;

  const fallbackTile = (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: gradient }}
      aria-hidden={url ? true : undefined}
    >
      {Icon && <Icon size={iconSize} color={ink} strokeWidth={1.6} />}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: H, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick ? () => (shownIdx >= 0 ? onClick(shownIdx) : onClick()) : undefined}
    >
      {(!url || !loaded[shownIdx]) && fallbackTile}
      {url && (
        <img
          src={url}
          alt={alt}
          onError={() => setErrors((p) => ({ ...p, [shownIdx]: true }))}
          onLoad={() => setLoaded((p) => ({ ...p, [shownIdx]: true }))}
          style={{ width: '100%', height: H, objectFit: 'cover', opacity: loaded[shownIdx] ? 1 : 0, transition: 'opacity 0.4s' }}
        />
      )}
    </div>
  );
}
