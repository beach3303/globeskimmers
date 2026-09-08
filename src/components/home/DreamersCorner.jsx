// DreamersCorner — "Places to dream about", extracted from HomeRows' old
// whereToNext branch so the DREAM zone can place it independently.
//
// Data is the SAME worker payload HomeRows renders (POST /home/rows, owned +
// KV-cached — zero Google spend): this file owns a small module-level client
// cache (fetchHomeRows below) shared with HomeRows, so mounting both costs ONE
// network call per location. This component keeps only the `whereToNext` row;
// HomeRows skips that key and renders the rest.
//
// Cards are EventsRow-sized photo cards (the row sells the dream, so the photo
// is big) with a mono data line when the worker card carries the data:
// "72°F NOW · ~9H FLIGHT (EST)". Honesty rules: each fragment renders only
// when its datum actually exists (tempF from the card; flight hours need the
// user's PHYSICAL GPS fix + card coords), the flight number keeps its "(EST)"
// hint because estFlightHours is a rough great-circle estimate, and nothing is
// shown at all under MIN_FLIGHT_MILES — nobody flies to the next town.
//
// A card tap opens DreamGallery (photo immersion); the end-of-rail "Dream
// anywhere" card is a typed doorway into the same gallery, whose own honest
// empty state answers nonsense input. Renders nothing when the worker sends no
// whereToNext row (under 3 destinations), so the feed never shows an empty rail.
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getSeason, haversineKm } from "@/lib/homeContext";
import { estFlightHours, MIN_FLIGHT_MILES, KM_TO_MI } from "@/lib/flightTime";
import { trackEvent } from "@/Layout";
import DreamGallery from "@/components/home/DreamGallery";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ---------------------------------------------------------------------------
// Shared /home/rows client cache — ONE network call per 0.1°-rounded location
// (the worker's own KV granularity) for every consumer that mounts in the same
// stack. HomeRows imports this instead of calling the worker directly.
// callWorker never throws ({ data, error } in-band), so failed results are
// evicted here to keep a retry possible on the next mount.
// ---------------------------------------------------------------------------
const _rowsCache = new Map(); // key -> { at, promise }
const ROWS_CLIENT_TTL_MS = 10 * 60 * 1000;

export function fetchHomeRows({ latitude, longitude, cityName = "", countryName = "" }) {
  const key = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
  const hit = _rowsCache.get(key);
  if (hit && Date.now() - hit.at < ROWS_CLIENT_TTL_MS) return hit.promise;
  const promise = callWorker(ROUTE.getHomeRows, {
    latitude,
    longitude,
    localHour: new Date().getHours(),
    season: getSeason(new Date(), latitude),
    cityName,
    countryName,
  }).then((res) => {
    if (!res || res.error) _rowsCache.delete(key);
    return res;
  });
  _rowsCache.set(key, { at: Date.now(), promise });
  return promise;
}

// whereToNext cards carry country only inside `whyVisit` ("City, Country") —
// the worker sends no `country` field on this row, so derive it client-side.
function parseDreamCountry(whyVisit) {
  const parts = String(whyVisit || "").split(",");
  return parts.length > 1 ? parts.slice(1).join(",").trim() : "";
}

// DREAMER'S CORNER card — EventsRow's dated-card size (photo-led w-[300px]),
// not the small HomeRowCard: this row sells the dream, so the photo is big.
// `dataLine` is the pre-built "72°F NOW · ~9H FLIGHT (EST)" mono string (or
// null — the line simply doesn't render).
function DreamerCornerCard({ card, country, dataLine, onOpen, wide }) {
  return (
    <button
      onClick={onOpen}
      className={`flex-none ${wide ? "w-[320px]" : "w-[300px]"} rounded-2xl overflow-hidden bg-white text-left`}
      style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
    >
      <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-serif text-[calc(34px*var(--fs))]" style={{ color: "rgba(255,255,255,0.85)" }}>
            {(card.name || "?").charAt(0)}
          </div>
        )}
        {card.photoUrl && (card.credit || card.photographer) && (
          <div
            className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[calc(8px*var(--fs))] leading-none"
            style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)" }}
          >
            {card.credit || card.photographer}
          </div>
        )}
      </div>
      <div className="p-3">
        <div
          className="font-serif leading-[1.14] text-[calc(16px*var(--fs))]"
          style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {card.name || "Explore"}
        </div>
        {country && (
          <div
            className="mt-1 truncate uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold"
            style={{ fontFamily: MONO, color: SUB }}
          >
            {country}
          </div>
        )}
        {dataLine && (
          <div className="mt-1 truncate tracking-[0.08em] text-[calc(10px*var(--fs))]" style={{ fontFamily: MONO, color: SUB }}>
            {dataLine}
          </div>
        )}
      </div>
    </button>
  );
}

// End-of-rail "Dream anywhere" card — a typed doorway into DreamGallery. No
// fetch here: the gallery's own honest-empty state answers nonsense input.
function DreamAnywhereCard({ wide, value, onChange, onSubmit }) {
  return (
    <div
      className={`flex-none ${wide ? "w-[320px]" : "w-[300px]"} rounded-2xl p-4 flex flex-col justify-center gap-2.5`}
      style={{ border: `1.5px dashed ${EDGE}`, background: "#FBF6EC" }}
    >
      <div className="font-serif text-[calc(18px*var(--fs))] leading-tight" style={{ color: INK }}>
        Dream anywhere
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        placeholder="Type a country…"
        className="w-full rounded-xl px-3 py-2 text-[calc(12px*var(--fs))] bg-white"
        style={{ fontFamily: MONO, color: INK, border: `1px solid ${EDGE}`, outline: "none" }}
      />
      <button
        onClick={onSubmit}
        className="self-start uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold underline underline-offset-2"
        style={{ fontFamily: MONO, color: TEAL }}
      >
        See photos
      </button>
    </div>
  );
}

export default function DreamersCorner({ onAction, wide = false }) {
  const { getActiveLocation, locationMode, currentGpsLocation } = useLocation();
  const [row, setRow] = useState(null); // the worker's whereToNext row, or null
  // DREAMER'S CORNER → DreamGallery. { dest: { name, country, lat, lng } }.
  const [dream, setDream] = useState(null);
  const [dreamQuery, setDreamQuery] = useState(""); // "Dream anywhere" input — persists across gallery opens

  useEffect(() => {
    let cancelled = false;
    const loc = getActiveLocation?.();
    // Active-location shape stores coords NESTED (coordinates.latitude) — same
    // as every finder; top-level fallbacks cover any flattened picked shape.
    const latitude = loc?.coordinates?.latitude ?? loc?.latitude ?? loc?.lat;
    const longitude = loc?.coordinates?.longitude ?? loc?.longitude ?? loc?.lng;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setRow(null);
      return;
    }
    const city = loc?.address?.city || loc?.city || "";
    const country = loc?.address?.country || loc?.country || "";
    (async () => {
      try {
        const { data, error } = await fetchHomeRows({ latitude, longitude, cityName: city, countryName: country });
        if (cancelled) return;
        const rows = !error && Array.isArray(data?.rows) ? data.rows : [];
        setRow(rows.find((r) => r?.key === "whereToNext" && Array.isArray(r.cards) && r.cards.length > 0) || null);
      } catch {
        if (!cancelled) setRow(null);
      }
    })();
    return () => { cancelled = true; };
  }, [getActiveLocation, locationMode]);

  // Flight estimates measure from where the user PHYSICALLY is (GPS fix), not
  // the browsed location — in navigate mode this can be null until Home's
  // silent GPS fetch fills it, and the fragment honestly hides until then.
  const gpsLat = currentGpsLocation?.coordinates?.latitude;
  const gpsLng = currentGpsLocation?.coordinates?.longitude;

  // "72°F NOW · ~9H FLIGHT (EST)" — each fragment only when its datum exists
  // (tempF + coords are worker-side additions; older cached bundles carry
  // neither), the whole line null when both are missing.
  const dataLineFor = (card) => {
    const frags = [];
    if (Number.isFinite(card.tempF)) frags.push(`${Math.round(card.tempF)}°F NOW`);
    if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng) && Number.isFinite(card.lat) && Number.isFinite(card.lng)) {
      const mi = haversineKm(gpsLat, gpsLng, card.lat, card.lng) * KM_TO_MI;
      if (mi >= MIN_FLIGHT_MILES) frags.push(`~${estFlightHours(mi)}H FLIGHT (EST)`);
    }
    return frags.length ? frags.join(" · ") : null;
  };

  // Card tap → DreamGallery (photo immersion). Coords/country ride along when
  // the card has them (country still parsed from whyVisit — see above);
  // without coords SmartPackages degrades to its typed search, by contract.
  const openDreamCard = (card) => {
    const country = parseDreamCountry(card.whyVisit);
    trackEvent("home_row_card_tap", { row: "whereToNext", place_id: card.id, place_name: card.name, country });
    setDream({ dest: { name: card.name, country, lat: card.lat, lng: card.lng } });
  };

  const openDreamAnywhere = () => {
    const q = dreamQuery.trim();
    if (!q) return;
    trackEvent("dreamer_corner_anywhere", { query: q });
    setDream({ dest: { name: q, country: "" } });
  };

  // Self-hide: the worker only sends whereToNext with 3+ destinations — no row,
  // no rail (never an empty shell, and the "Dream anywhere" doorway alone
  // wouldn't read as a corner).
  if (!row) return null;

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div className="uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold" style={{ fontFamily: MONO, color: SUB }}>
              DREAMER'S CORNER
            </div>
            <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1] mt-0.5" style={{ color: INK }}>
              Places to dream about
            </div>
          </div>
          {onAction && row.seeAll?.action && (
            <button
              onClick={() => {
                trackEvent("home_row_see_all", { row: "whereToNext", action: row.seeAll.action });
                onAction(row.seeAll.action);
              }}
              className="flex-none text-[calc(12.5px*var(--fs))] font-semibold"
              style={{ color: TEAL }}
            >
              See all →
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {row.cards.map((card) => (
            <DreamerCornerCard
              key={card.id}
              card={card}
              country={parseDreamCountry(card.whyVisit)}
              dataLine={dataLineFor(card)}
              wide={wide}
              onOpen={() => openDreamCard(card)}
            />
          ))}
          <DreamAnywhereCard wide={wide} value={dreamQuery} onChange={setDreamQuery} onSubmit={openDreamAnywhere} />
        </div>
      </div>

      {/* DREAMER'S CORNER photo immersion — both the curated cards and the
          typed "Dream anywhere" path land here; the gallery's own "Build my
          trip" CTA is the next step (no quick-look modal on this surface). */}
      <DreamGallery open={!!dream} onClose={() => setDream(null)} dest={dream?.dest || null} />
    </div>
  );
}
