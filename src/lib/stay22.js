// Stay22 goal-based hotel deep-link builder. Stay22 is a multi-OTA meta-search
// (Booking / Expedia / Agoda / Hotels.com …) — one "allez/roam" link routes each
// user to the cheapest option, so they see the best deal (trust) and we earn on
// whatever they book. No approval-blocking data API, no reverse-engineered
// facility codes.
//
// ⚠️ AID: PLACEHOLDER until Stay22 approves us (fast — often same-day). It's a
// public URL param, not a secret — swap STAY22_AID once assigned and the links
// earn. Until then the links still work; they just aren't attributed to us.
//
// NOTE (by design): Stay22 links carry location + dates + guests + currency/lang
// only. Amenity filters (breakfast / pool / gym / restaurant / A/C / microwave /
// refrigerator) are chosen on the results page — that's inherent to a price-
// comparison meta-search. In-app amenity pre-filtering is the planned Agoda
// follow-up. Params verified against dev.stay22.com/docs/allez/parameters.
export const STAY22_AID = 'PLACEHOLDER_STAY22_AID'; // TODO: replace with real Stay22 aid

// Build a Stay22 allez/roam URL. Location comes from EITHER lat/lng OR a text
// address (a goal like "Tokyo airport" / "Paris city centre"). Dates are
// YYYY-MM-DD (Stay22 defaults checkout to checkin+1 if omitted; both omitted =
// flexible). Tracking (`campaign`) is added downstream by trackAffiliateClick so
// the SubID lands in Stay22's own tracking param.
export function buildStay22Url({ lat, lng, address, checkin, checkout, adults = 2, children = 0, currency, lang } = {}) {
  const p = new URLSearchParams();
  p.set('aid', STAY22_AID);
  if (address) {
    p.set('address', address);
  } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
    p.set('lat', String(lat));
    p.set('lng', String(lng));
  }
  if (checkin) p.set('checkin', checkin);
  if (checkout) p.set('checkout', checkout);
  if (adults != null) p.set('adults', String(adults));
  if (children) p.set('children', String(children));
  if (currency) p.set('currency', currency);
  if (lang) p.set('lang', lang);
  return `https://www.stay22.com/allez/roam?${p.toString()}`;
}
