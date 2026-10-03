// StampsNearYou — "Stamps near you" homepage row.
//
// Turns the Virtual Passport into a discovery hook: iconic, collectible stamps
// you can earn near where you are / where you're staying, with the DISTANCE from
// your spot. Centered on the active location (which auto-follow keeps current;
// the accommodation anchor in Phase 2 will pin it). Owned attraction data only
// (attractions/nearby, D1 — zero Google/AI spend). Renders NOTHING when there's
// no coverage, so the tiles + feed above stand alone.
//
// A tap opens the attraction (ActivityDetail), where the GPS-verified "I was
// here" stamp is actually earned — we never claim a tap collects a stamp.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { stampArtUrl } from "@/lib/stampArt";
import TypographicStamp from "@/components/passport/TypographicStamp";
import { logDiscover } from "@/lib/logDiscover";
import { createPageUrl } from "@/utils";

const INK = "#243447", INK3 = "#66717D", STAMP = "#B0472F", PAPER = "#FBF6EC";

// One collectible stamp: the bespoke stamp art in a dashed "not yet earned" ring;
// falls back to a clean rubber-stamp placeholder when a spot has no art yet.
function StampChip({ item, wide, onOpen }) {
  const [fail, setFail] = useState(false);
  const art = stampArtUrl(item.name);
  const size = wide ? 116 : 100;
  const miles = Number.isFinite(item.distanceMiles) ? `${item.distanceMiles.toFixed(1)} mi` : null;
  return (
    <button onClick={onOpen} className={`flex-none text-center ${wide ? "w-[150px]" : "w-[128px]"}`} aria-label={`Stamp: ${item.name}`}>
      <div
        className="mx-auto flex items-center justify-center"
        style={{
          width: size, height: size, borderRadius: "50%",
          border: `2px dashed ${STAMP}`, background: PAPER,
          boxShadow: "inset 0 0 0 1px rgba(176,71,47,.15)", opacity: 0.96,
        }}
      >
        {art && !fail ? (
          <img
            src={art} alt="" loading="lazy" onError={() => setFail(true)}
            style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain", opacity: 0.92 }}
          />
        ) : (
          // No bespoke art for this spot yet -> a real typographic stamp rather
          // than a generic emoji, so an uncollected stamp still looks worth having.
          <TypographicStamp
            name={item.name} city={item.city} country={item.country}
            entityId={item.id || item.name} width={size * 0.84} film={item.film || null}
          />
        )}
      </div>
      <div className="mt-1.5 leading-tight" style={{ fontFamily: '"Instrument Serif", Georgia, serif', color: INK, fontSize: `calc(13px*var(--fs))`, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.name}
      </div>
      {miles && <div className="mt-0.5" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: INK3, fontSize: `calc(10.5px*var(--fs))` }}>{miles}</div>}
    </button>
  );
}

export default function StampsNearYou({ onAction, wide = false, onNearest }) {
  // First-run explainer (founder queue #1: "explain what stamps near you
  // mean" — the Atlanta story). Shows once, dismissible, never again after.
  const [explain, setExplain] = useState(() => {
    try { return !localStorage.getItem("pp_stamps_explained"); } catch { return false; }
  });
  const dismissExplain = () => {
    setExplain(false);
    try { localStorage.setItem("pp_stamps_explained", "1"); } catch { /* fine */ }
  };

  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  // Out of coverage (audit P1 #9): nothing within 25 mi → one wider look so
  // the first screen still holds a collectible ("the nearest stamps"); only
  // when even that is empty does a quiet card offer a past trip instead.
  const [far, setFar] = useState(false);
  const [none, setNone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    // Coords are NESTED on the active-location shape (coordinates.latitude), like
    // every finder; top-level fallbacks cover any flattened picked/search shape.
    const lat = loc?.coordinates?.latitude ?? loc?.latitude ?? loc?.lat;
    const lng = loc?.coordinates?.longitude ?? loc?.longitude ?? loc?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setItems([]); return; }
    (async () => {
      try {
        // The worker reads `radiusKm` (NOT `radius`); ~40 km (25 mi) keeps a
        // city's iconic stamps in range while the distance labels stay honest
        // for a "near your stay" header (an 80 km default would surface ~50-mi
        // stamps as "near").
        // includeSecrets: the worker hides tier=secret rows from general browse; this
        // proximity path may see them (inside their rotation window) — and we show a
        // secret ONLY when the traveler is physically inside its footprint. That is
        // the whole game: you stumble onto it by being there.
        const { data, error } = await callWorker("attractions/nearby", { latitude: lat, longitude: lng, radiusKm: 40, limit: 24, includeSecrets: true, stampsOnly: true });
        if (cancelled) return;
        const raw = (!error && Array.isArray(data?.attractions)) ? data.attractions : [];
        let list = raw.filter((a) => a.tier !== "secret" || (Number.isFinite(a.distanceKm) && a.distanceKm * 1000 <= (a.footprint_radius_m || 150)));
        let isFar = false;
        if (!list.length && !error) {
          const wide2 = await callWorker("attractions/nearby", { latitude: lat, longitude: lng, radiusKm: 250, limit: 12, stampsOnly: true });
          if (cancelled) return;
          list = (!wide2.error && Array.isArray(wide2.data?.attractions)) ? wide2.data.attractions.filter((a) => a.tier !== "secret") : [];
          isFar = list.length > 0;
        }
        // Near: iconic first, then nearest. Far: nearest first — the trip is the point.
        list.sort((a, b) => (isFar ? 0 : (Number(!!b.isMarquee) - Number(!!a.isMarquee))) || ((a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)));
        setItems(list.slice(0, 12)); setFar(isFar); setNone(!error && !list.length);
        // Feed the passport hero the closest stampable place (by distance, not
        // marquee rank — "next stamp" should be the one you can walk to).
        if (onNearest) {
          const near = list.slice().sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999))[0];
          onNearest(near ? { name: near.name, miles: Number.isFinite(near.distanceMiles) ? near.distanceMiles : null } : null);
        }
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [getActiveLocation]);

  if (!items.length) {
    if (!none) return null;
    return (
      <div className={wide ? "pb-3" : "px-4 pb-3"}>
        <div className={wide ? "" : "max-w-md mx-auto"}>
          <div className="rounded-[16px] px-4 py-3.5" style={{ background: "#F6F0E4", border: "1px solid #E4DAC4" }}>
            <div className="font-serif text-[calc(17px*var(--fs))] leading-[1.2]" style={{ color: "#16302B" }}>No famous stamps around here yet</div>
            <p className="text-[calc(12.5px*var(--fs))] mt-1 leading-[1.45]" style={{ color: "#3F5A50" }}>
              Stamps live at the world&rsquo;s iconic places. Been somewhere before? Add the trip with a photo you took there.
            </p>
            <div className="flex gap-2 mt-2.5 flex-wrap">
              <button type="button" onClick={() => navigate(createPageUrl("Passport"))} className="rounded-full px-3.5 py-2 font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: "#B0472F", color: "#fff" }}>
                ✍️ Add a past trip
              </button>
              <button type="button" onClick={() => onAction?.("Things to Do")} className="rounded-full px-3.5 py-2 font-semibold text-[calc(12.5px*var(--fs))]" style={{ background: "#fff", color: "#16302B", border: "1px solid #E4DAC4" }}>
                Things to do nearby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const nearestMi = far ? Math.round(Math.min(...items.map((x) => (Number.isFinite(x.distanceMiles) ? x.distanceMiles : 999)))) : null;

  // Open the attraction so the user can earn the stamp there (GPS "I was here").
  const openStamp = (item) => {
    try {
      const loc = getActiveLocation?.();
      const activity = {
        id: item.id, name: item.name, category: item.category,
        photos: item.photoUrl ? [item.photoUrl] : [],
        description: item.whyVisit || item.description || "",
        latitude: item.lat, longitude: item.lng, rating: item.rating,
        free_to_visit: item.freeToVisit,
        distance_km: Number.isFinite(item.distanceKm) ? item.distanceKm : undefined,
        // Stamps earned from this page carry their country (passport "countries"
        // count, GPS-vs-IP check) and the per-row stamp radius override — pass
        // them through whenever the worker card has them.
        city: item.city || undefined,
        region: item.region || item.state || undefined,
        country: item.country || undefined,
        countryCode: item.countryCode || item.cc || undefined,
        footprint_radius_m: item.footprint_radius_m ?? item.footprintRadiusM ?? undefined,
        film: item.film || undefined,   // movie scene spots: the film behind the place
      };
      sessionStorage.setItem("current_activity", JSON.stringify(activity));
      if (loc) sessionStorage.setItem("activity_location", JSON.stringify(loc));
      logDiscover("home_stamp_tap", { place_id: item.id, place_name: item.name });
      // ?id= makes the page deep-linkable/shareable; sessionStorage stays the fast path.
      navigate(createPageUrl("ActivityDetail") + "?id=" + encodeURIComponent(activity.id));
    } catch { onAction?.("Things to Do"); }
  };

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        {explain && (
          <div className="relative rounded-[14px] px-4 py-3 mb-3" style={{ background: "#EAF3EF", border: "1px solid #CDE2D8" }}>
            <button type="button" onClick={dismissExplain} aria-label="Got it — hide this note"
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "#fff", color: "#16302B", fontSize: 12, fontWeight: 700, border: "1px solid #CDE2D8" }}>✕</button>
            <div className="font-serif text-[calc(16px*var(--fs))] leading-[1.2] pr-6" style={{ color: "#16302B" }}>
              These are the places actually worth going.
            </div>
            <p className="text-[calc(12.5px*var(--fs))] mt-1 leading-[1.45] pr-4" style={{ color: "#3F5A50" }}>
              The stamps below are the top destinations around you — the aquarium, the mountain, the famous steps. Be at one and its stamp is yours for life, dated and verified. Add your photos, and share the page.
            </p>
          </div>
        )}
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: "#16302B" }}>{far ? "The nearest stamps" : "Stamps near you"}</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: "#71827D" }}>{far && nearestMi < 999 ? `${nearestMi} mi away — worth the trip` : "Collect these as you explore"}</div>
          </div>
          <button
            onClick={() => navigate(createPageUrl("Passport"))}
            className="flex-none text-[calc(12.5px*var(--fs))] font-semibold"
            style={{ color: "#17A38F" }}
          >
            My Passport →
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {items.map((it) => (
            <StampChip key={it.id} item={it} wide={wide} onOpen={() => openStamp(it)} />
          ))}
        </div>
      </div>
    </div>
  );
}
