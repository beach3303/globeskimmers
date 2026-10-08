// DreamShelf — the DREAM-mode photo rail of stampable places.
//
// Home (planning/home stack) points this at the city the user is DREAMING
// about — its navigate-mode selection — and the shelf lays out the stamps
// waiting there as the promise of the trip. Endowed progress: the mono kicker
// reads "{CITY} · {earned} OF {total}" even at 0 — the set itself is the
// endowment. Owned attraction data only (attractions/nearby, D1 — zero
// Google/AI spend) + one /passport/list read to mark what's already collected.
//
// Deliberately different from StampsNearYou:
//   - NO includeSecrets — secrets are found by being there, never dreamed;
//   - DISTANCE under every card (founder, 2026-10-06): the shelf reaches 50
//     miles — everything a car, train or bus can do — so each card says how
//     far, in the traveler's unit (miles in mile countries, km elsewhere,
//     Settings override wins). Water in between gets an honest ⛴ FERRY tag;
//     fly-only places don't belong on a within-reach shelf.
//   - photo-forward cards when a place has a real photoUrl, the engraved
//     typographic stamp card otherwise (never a colored placeholder box).
// A tap opens the place's full page — the same one "Stamps near you" opens
// (founder, 2026-10-08: Six Flags opened its page, but the Hollywood Sign
// opened a name-matched photo gallery full of other "Hollywood" signs).
// Home still owns what opening means (onOpenActivity → openStamp).
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { useAuth } from "@/lib/AuthContext";
import { countryCode } from "@/lib/countries";
import { distanceUnit, distanceLabel } from "@/lib/units";
import { callWorker } from "@/lib/callWorker";
import { listPassport } from "@/lib/passport";
import { stampArtUrl } from "@/lib/stampArt";
import { haversineKm } from "@/lib/homeContext";
import { estFlightHours, MIN_FLIGHT_MILES, KM_TO_MI } from "@/lib/flightTime";
import TypographicStamp from "@/components/passport/TypographicStamp";
import { logDiscover } from "@/lib/logDiscover";
import { IVORY_2 } from "@/components/redesign/constants";

const INK = "#16302B", INK2 = "#243447", MUTED = "#736657";
const STAMP = "#B0472F", PAPER = "#FBF6EC", EDGE = "#E6DFD0";

// Subtle mono "already in your passport" mark — the rubber-stamp red at low
// volume, never teal (collected is a fact, not a call to action).
function CollectedTag({ overlay }) {
  return (
    <div
      className={`font-mono uppercase tracking-[0.08em] leading-none text-[calc(8.5px*var(--fs))] ${overlay ? "absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded" : "mt-0.5"}`}
      style={{ color: STAMP, ...(overlay ? { background: "rgba(251,246,236,.94)" } : {}) }}
    >
      Collected
    </div>
  );
}

// One shelf card. Photo-forward when the place has a real photo; otherwise the
// engraved typographic stamp in the dashed "not yet earned" ring (mirrors
// StampsNearYou's StampChip — bespoke stamp art first, TypographicStamp when
// there's none). No distance line in either form — dreaming isn't nearby.
function DreamCard({ item, collected, sub, onOpen }) {
  const [photoFail, setPhotoFail] = useState(false);
  const [artFail, setArtFail] = useState(false);
  const art = stampArtUrl(item.name, { entityId: item.id, country: item.country });

  if (item.photoUrl && !photoFail) {
    return (
      <button
        onClick={onOpen}
        className="flex-none w-[150px] rounded-2xl overflow-hidden bg-white text-left border"
        style={{ borderColor: EDGE, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
        aria-label={`Dream stamp: ${item.name}`}
      >
        <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: IVORY_2 }}>
          <img src={item.photoUrl} alt="" loading="lazy" onError={() => setPhotoFail(true)} className="w-full h-full object-cover" />
          {collected && <CollectedTag overlay />}
        </div>
        <div className="p-2.5">
          <div
            className="font-serif leading-[1.1] text-[calc(15px*var(--fs))]"
            style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {item.name}
          </div>
          {sub && <div className="font-mono uppercase tracking-[0.08em] text-[calc(9px*var(--fs))] mt-0.5" style={{ color: MUTED }}>{sub}</div>}
        </div>
      </button>
    );
  }

  const size = 104;
  return (
    <button onClick={onOpen} className="flex-none text-center w-[150px]" aria-label={`Dream stamp: ${item.name}`}>
      <div
        className="mx-auto flex items-center justify-center"
        style={{
          width: size, height: size, borderRadius: "50%",
          border: `2px dashed ${STAMP}`, background: PAPER,
          boxShadow: "inset 0 0 0 1px rgba(176,71,47,.15)", opacity: 0.96,
        }}
      >
        {art && !artFail ? (
          <img
            src={art} alt="" loading="lazy" onError={() => setArtFail(true)}
            style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain", opacity: 0.92 }}
          />
        ) : (
          <TypographicStamp
            name={item.name} city={item.city} country={item.country}
            entityId={item.id || item.name} width={size * 0.84}
          />
        )}
      </div>
      <div className="mt-1.5 leading-tight" style={{ fontFamily: '"Instrument Serif", Georgia, serif', color: INK2, fontSize: `calc(13px*var(--fs))`, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.name}
      </div>
      {sub && <div className="font-mono uppercase tracking-[0.08em] text-[calc(9px*var(--fs))] mt-0.5" style={{ color: MUTED }}>{sub}</div>}
      {collected && <CollectedTag />}
    </button>
  );
}

// `cityTempF` is OPTIONAL: the dreamed city's current temperature in °F, when
// the mounting page already holds it (Home fetches /weather-forecast for the
// active location in dream mode). No temp passed → that fragment just hides.
export default function DreamShelf({ latitude, longitude, cityName, cityTempF = null, onOpenActivity }) {
  const { currentGpsLocation, activeLocation } = useLocation();
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [earnedIds, setEarnedIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setItems([]); return; }
    (async () => {
      try {
        // 80 km ≈ 50 miles (founder, 2026-10-06): every top destination a car,
        // train or bus can reach from here belongs on the shelf. NO
        // includeSecrets: the worker hides tier=secret rows from browse, and a
        // secret is earned by stumbling onto it in person — never previewed
        // here. /passport/list is the lightest existing count read (signed-out
        // it returns empty stamps, never an error → "0 OF N" is the endowment).
        const [near, pass] = await Promise.all([
          callWorker("attractions/nearby", { latitude, longitude, radiusKm: 80, limit: 48, stampsOnly: true }),
          listPassport(),
        ]);
        if (cancelled) return;
        const raw = (!near.error && Array.isArray(near.data?.attractions)) ? near.data.attractions : [];
        const list = raw.filter((a) => a.tier !== "secret");
        // Iconic first, then best-loved — NOT nearest-first; the shelf is a
        // promise, not a proximity list.
        list.sort((a, b) => (Number(!!b.isMarquee) - Number(!!a.isMarquee)) || ((b.popularity ?? 0) - (a.popularity ?? 0)));
        setItems(list.slice(0, 16));
        // Attraction stamps store the attraction id as entity_id
        // (ActivityDetail's addStamp), so id membership = already collected.
        setEarnedIds(new Set((pass.stamps || []).filter((s) => s && s.entity_id != null).map((s) => String(s.entity_id))));
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude]);

  // Self-hide: no dreamed coords, or too few stampable places to read as a set.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || items.length < 3) return null;

  const earned = items.filter((it) => earnedIds.has(String(it.id))).length;
  const city = String(cityName || "").trim();

  // "72°F NOW · ~9H FLIGHT (EST)" — the dreamed city's live temp (optional
  // cityTempF prop) and a rough flight estimate from where the user PHYSICALLY
  // is (GPS fix; null in navigate mode until Home's silent fetch fills it).
  // Each fragment hides without its datum; under MIN_FLIGHT_MILES no flight
  // fragment at all — nobody flies to the town next door. The whole line is
  // skipped silently when both are missing.
  const gpsLat = currentGpsLocation?.coordinates?.latitude;
  const gpsLng = currentGpsLocation?.coordinates?.longitude;
  const dataFrags = [];
  if (Number.isFinite(cityTempF)) dataFrags.push(`${Math.round(cityTempF)}°F NOW`);
  if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
    const mi = haversineKm(gpsLat, gpsLng, latitude, longitude) * KM_TO_MI;
    if (mi >= MIN_FLIGHT_MILES) dataFrags.push(`~${estFlightHours(mi)}H FLIGHT (EST)`);
  }
  const dataLine = dataFrags.length ? dataFrags.join(" · ") : null;

  // Distance under each card, from the shelf's anchor. Unit: Settings choice
  // first, else the traveler's country (mile countries get miles). Known
  // water crossings say so instead of pretending the road exists.
  const unit = distanceUnit(profile, countryCode(activeLocation?.address?.country || currentGpsLocation?.address?.country) || "");
  const FERRY = ["catalina", "alcatraz", "statue of liberty", "liberty island", "ellis island", "angel island", "channel islands"];
  const subFor = (it) => {
    if (!Number.isFinite(it?.lat) || !Number.isFinite(it?.lng)) return null;
    const d = distanceLabel(haversineKm(latitude, longitude, it.lat, it.lng), unit);
    if (!d) return null;
    const ferry = FERRY.some((f) => String(it.name || "").toLowerCase().includes(f));
    return ferry ? `⛴ FERRY · ${d}` : d;
  };

  const openDream = (item) => {
    logDiscover("dream_shelf_tap", { place_id: item.id, place_name: item.name });
    onOpenActivity?.(item);
  };

  return (
    <div className="px-4 pb-3">
      <div className="max-w-md mx-auto">
        <div className="mb-2 px-0.5">
          <div className="font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))]" style={{ color: MUTED }}>
            {city ? `${city} · ` : ""}{earned} of {items.length}
          </div>
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1] mt-0.5" style={{ color: INK }}>Dream shelf</div>
          {dataLine && (
            <div className="font-mono uppercase tracking-[0.08em] text-[calc(10px*var(--fs))] mt-1" style={{ color: MUTED }}>
              {dataLine}
            </div>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {items.map((it) => (
            <DreamCard key={it.id} item={it} collected={earnedIds.has(String(it.id))} sub={subFor(it)} onOpen={() => openDream(it)} />
          ))}
        </div>
      </div>
    </div>
  );
}
