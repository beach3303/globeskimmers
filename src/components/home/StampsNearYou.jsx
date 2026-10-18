// StampsNearYou — Home's stamps zone on passport cream (Home-Boxes L149-188).
//
// Turns the Virtual Passport into a discovery hook: iconic, collectible stamps you
// can earn near the active location, with the distance from your spot in your unit.
// Owned attraction data only (attractions/nearby, D1 — zero Google/AI spend).
//
//   Near:   'Be there, and it's *yours*' + the deck, iconic first, then nearest.
//   Far:    nothing within ~25 mi, so one wider look: 'The nearest *stamps*' and
//           '{distance} AWAY · WORTH THE TRIP', nearest first.
//   None:   no stamps even then: 'No places to stamp around here yet' with 'Add a past
//           trip' and 'Things to do nearby'.
//   Nothing while loading, without coordinates, or when the read fails.
//
// A tap opens the attraction's Things to Do card, where the GPS-verified "I was here"
// stamp is actually earned — we never claim a tap collects a stamp. onNearest gets
// the closest stampable place ({ name, km, miles }) for the passport zone.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { logDiscover } from "@/lib/logDiscover";
import { createPageUrl } from "@/utils";
import { openAttraction } from "@/lib/openAttraction";
import { KM_PER_MI, distanceLabel } from "@/lib/units";
import { HomeZone } from "@/components/redesign/Zone";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import StampThumb from "@/components/passport/StampThumb";

const RED = NEUTRAL.stamp;

const kmOf = (a) => {
  if (Number.isFinite(a?.distanceKm)) return a.distanceKm;
  if (Number.isFinite(a?.distanceMiles)) return a.distanceMiles * KM_PER_MI;
  return NaN;
};

// One collectible stamp: its art (or the typographic stamp) in the dashed "not yet
// earned" ring, the name and the distance.
function StampDisc({ item, unit, onOpen }) {
  const dist = distanceLabel(kmOf(item), unit);
  const spoken = dist ? `${item.name} stamp, ${dist.replace(/ MI$/, " miles").replace(/ KM$/, " kilometres")} away` : `${item.name} stamp`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={spoken}
      className="flex-none flex flex-col items-center"
      style={{ width: fs(128), background: "transparent", border: 0, padding: 0, color: NEUTRAL.ink, cursor: "pointer" }}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center"
        style={{
          width: 104, height: 104, boxSizing: "border-box", borderRadius: 999,
          border: `2px dashed ${RED}`, background: NEUTRAL.cream,
          boxShadow: "inset 0 0 0 1px rgba(176,71,47,.15), 0 6px 14px -10px rgba(22,17,13,.35)",
          overflow: "hidden",
        }}
      >
        <StampThumb stamp={{ ...item, entity_id: item.id }} size={84} strength={0} />
      </span>
      <span
        className="font-serif"
        style={{ marginTop: 6, width: "100%", fontSize: fs(15), lineHeight: 1.1, textAlign: "center", color: NEUTRAL.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {item.name}
      </span>
      {dist && (
        <span className="font-mono" style={{ marginTop: 2, fontSize: fs(10.5), lineHeight: 1.2, letterSpacing: ".06em", color: NEUTRAL.ink3 }}>{dist}</span>
      )}
    </button>
  );
}

export default function StampsNearYou({ onAction, onNearest, unit = "mi" }) {
  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [far, setFar] = useState(false);
  const [none, setNone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    // Coords are NESTED on the active-location shape (coordinates.latitude), like
    // every finder; top-level fallbacks cover any flattened picked/search shape.
    const lat = loc?.coordinates?.latitude ?? loc?.latitude ?? loc?.lat;
    const lng = loc?.coordinates?.longitude ?? loc?.longitude ?? loc?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setItems([]); setNone(false); return undefined; }
    (async () => {
      try {
        // The worker reads `radiusKm` (NOT `radius`); ~40 km (25 mi) keeps a city's
        // iconic stamps in range while the distances stay honest.
        // includeSecrets: a secret stamp shows ONLY when the traveler is physically
        // inside its footprint. That is the whole game: you stumble onto it.
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
        const d = (a) => (Number.isFinite(kmOf(a)) ? kmOf(a) : 1e9);
        list.sort((a, b) => (isFar ? 0 : (Number(!!b.isMarquee) - Number(!!a.isMarquee))) || (d(a) - d(b)));
        setItems(list.slice(0, 12)); setFar(isFar); setNone(!error && !list.length);
        // The passport zone's "next stamp": the closest one (by distance, not
        // marquee rank — the one you can walk to).
        if (onNearest) {
          const near = list.slice().sort((a, b) => d(a) - d(b))[0];
          const km = near ? kmOf(near) : NaN;
          onNearest(near ? { name: near.name, km: Number.isFinite(km) ? km : null, miles: Number.isFinite(km) ? km / KM_PER_MI : null } : null);
        }
      } catch { if (!cancelled) { setItems([]); setNone(false); } }
    })();
    return () => { cancelled = true; };
  }, [getActiveLocation]);

  const toPassport = () => navigate(createPageUrl("Passport"));

  if (!items.length) {
    if (!none) return null;
    return (
      <HomeZone zone="stamps" label="Stamps near you">
        <h3 className="font-serif m-0" style={{ fontWeight: 400, fontSize: fs(22), lineHeight: 1.15, color: NEUTRAL.ink }}>
          No places to stamp around here <em style={{ color: RED }}>yet</em>
        </h3>
        <p style={{ margin: "6px 0 0", fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
          Stamps live at the world&rsquo;s iconic places. Been somewhere before? Add the trip with a photo you took there.
        </p>
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
          <button type="button" onClick={toPassport} className="rounded-full" style={{ minHeight: 44, padding: "0 16px", background: RED, border: 0, color: NEUTRAL.white, fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>
            Add a past trip
          </button>
          <button type="button" onClick={() => onAction?.("Things to Do")} className="rounded-full" style={{ minHeight: 44, padding: "0 16px", background: "transparent", border: `1px solid ${NEUTRAL.creamRule}`, color: NEUTRAL.ink, fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>
            Things to do nearby
          </button>
        </div>
      </HomeZone>
    );
  }

  const nearestKm = far ? Math.min(...items.map((x) => (Number.isFinite(kmOf(x)) ? kmOf(x) : Infinity))) : NaN;
  const farLabel = Number.isFinite(nearestKm) ? distanceLabel(nearestKm, unit) : null;

  // Open the attraction's Things to Do card — the stamp is earned there by GPS.
  const openStamp = (item) => {
    logDiscover("home_stamp_tap", { place_id: item.id, place_name: item.name });
    if (!openAttraction(navigate, item, "Stamps near you")) onAction?.("Things to Do");
  };

  return (
    <HomeZone zone="stamps" label="Stamps near you">
      <div className="flex items-center justify-between" style={{ gap: 12, minHeight: 24 }}>
        <h3 className="font-serif m-0 min-w-0" style={{ fontWeight: 400, fontSize: fs(22), lineHeight: 1.1, color: NEUTRAL.ink }}>
          {far
            ? <>The nearest <em style={{ color: RED }}>stamps</em></>
            : <>Be there, and it&rsquo;s <em style={{ color: RED }}>yours</em></>}
        </h3>
        <button
          type="button"
          onClick={toPassport}
          className="flex-none inline-flex items-center"
          style={{ gap: 4, minHeight: 44, margin: "-10px 0", padding: 0, background: "transparent", border: 0, fontSize: fs(13), fontWeight: 600, color: RED, cursor: "pointer" }}
        >
          My Passport
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {far ? (
        farLabel && <p className="font-mono" style={{ margin: "4px 0 0", fontSize: fs(10.5), lineHeight: 1.4, letterSpacing: ".06em", color: NEUTRAL.ink3 }}>{farLabel} AWAY · WORTH THE TRIP</p>
      ) : (
        <p style={{ margin: "4px 0 0", fontSize: fs(12.5), lineHeight: 1.3, color: NEUTRAL.ink3 }}>
          {/* No "famous" (founder, 2026-10-17: "famous place is a claim"). */}
          Places to stamp around you. Be at one and its stamp is yours for life, dated and verified.
        </p>
      )}
      <div className="flex items-start overflow-x-auto" style={{ gap: 12, marginTop: 12, marginRight: -16, paddingRight: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
        {items.map((it) => (
          <StampDisc key={it.id} item={it} unit={unit} onOpen={() => openStamp(it)} />
        ))}
      </div>
    </HomeZone>
  );
}
