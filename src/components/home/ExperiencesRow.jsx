// ExperiencesRow — the bookable Viator experiences rail, extracted from
// EventsRow's old sub-rail so the home zones can place it independently.
// EventsRow now keeps ONLY the dated Ticketmaster rail.
//
// Data is the SAME worker payload EventsRow reads (POST /events/search — TM +
// Viator, NO Google spend, worker-cached 6h): this file owns a small
// module-level client cache (fetchEventsSearch below) shared with EventsRow,
// so mounting both costs ONE network call per base. Contract consumed:
//   experiences[]: { id, title, image, city (optional), fromPrice, currency, url }
//                  (code/thumbnail also accepted — pre-v4 field names)
//   destination:   Viator destination name the experiences were scoped to (optional)
//   destinationMi: straight-line miles to that destination (optional)
//
// Header honesty is unchanged from the extraction: "EXPERIENCES NEARBY" only
// when it's true (same city, no destination scoping, or within ~12 mi); a
// farther catalog (Viator has none for many suburbs) is framed as a day-trip —
// "WORTH THE DRIVE · Santa Monica · ~29 MI", never "nearby". These are
// bookable-any-day products, deliberately NOT mixed into dated event windows.
// A tap records an attributed click (affiliate_clicks → "My Trip") then opens
// Viator. Renders nothing when there are no experiences.
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorProductLink, viatorSearchLink } from "@/lib/viator";
import { openPartner } from "@/lib/openPartner";
import { logDiscover } from "@/lib/logDiscover";

const INK = "#16302B", SUB = "#71827D", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
// Same price honesty as EventsRow: the worker sends ISO currency codes, never
// symbols, and minimums can be fractional — "from $35" / "from CHF 35".
const CUR_SYM = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
const fmtPrice = (n, cur) => { const c = String(cur || "").toUpperCase(); return `${c ? (CUR_SYM[c] || `${c} `) : "$"}${Math.round(n)}`; };

// ---------------------------------------------------------------------------
// Shared /events/search client cache — ONE network call per base for every
// consumer in the same stack (EventsRow imports this instead of calling the
// worker directly). callWorker never throws ({ data, error } in-band), so
// failed results are evicted to keep a retry possible on the next mount.
// ---------------------------------------------------------------------------
const _evCache = new Map(); // key -> { at, promise }
const EV_CLIENT_TTL_MS = 10 * 60 * 1000;

export function fetchEventsSearch({ city = "", latitude, longitude, cityName = "" }) {
  const lat = Number.isFinite(latitude) ? latitude.toFixed(2) : "";
  const lng = Number.isFinite(longitude) ? longitude.toFixed(2) : "";
  const key = `${String(city).trim().toLowerCase()}|${lat}|${lng}`;
  const hit = _evCache.get(key);
  if (hit && Date.now() - hit.at < EV_CLIENT_TTL_MS) return hit.promise;
  const promise = callWorker(ROUTE.searchEvents, { city, latitude, longitude, cityName }).then((res) => {
    if (!res || res.error) _evCache.delete(key);
    return res;
  });
  _evCache.set(key, { at: Date.now(), promise });
  return promise;
}

export default function ExperiencesRow({ wide = false }) {
  const { getActiveLocation } = useLocation();
  const [payload, setPayload] = useState(null); // { exps, destName, destMi }
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  // Base = the primary stay if set, else the active location — the SAME base
  // EventsRow resolves, so both hit the same fetchEventsSearch cache entry.
  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const country = a.country || base?.country || "";
  const lat = base?.coordinates?.latitude ?? base?.latitude ?? base?.lat;
  const lng = base?.coordinates?.longitude ?? base?.longitude ?? base?.lng;

  useEffect(() => {
    let cancelled = false;
    if (!city && !Number.isFinite(lat)) { setPayload(null); return; }
    (async () => {
      try {
        const { data } = await fetchEventsSearch({ city, latitude: lat, longitude: lng, cityName: city });
        if (cancelled) return;
        const seen = new Set();
        const keep = (name, url) => { const k = (name || "").toLowerCase(); if (!name || !url || seen.has(k)) return false; seen.add(k); return true; };
        const exps = (data?.experiences || [])
          .filter((p) => keep(p.title, p.url))
          .map((p) => ({
            id: p.id || p.code || p.url, name: p.title, image: p.image || p.thumbnail,
            city: p.city || "", fromPrice: p.fromPrice, currency: p.currency, url: p.url,
          }));
        const destName = data?.destination || data?.destinationName || "";
        const destMi = Number.isFinite(data?.destinationMi) ? data.destinationMi : null;
        setPayload({ exps, destName, destMi });
        if (exps.length) logDiscover("exp_view", { city, country, count: exps.length });
      } catch { if (!cancelled) setPayload(null); }
    })();
    return () => { cancelled = true; };
  }, [city, country, lat, lng, tick]);

  // Self-hide: no bookable experiences → no row at all (never an empty shell).
  if (!payload || !payload.exps.length) return null;

  const shownExps = payload.exps.slice(0, 8);
  const sameCity = !!payload.destName && !!city && payload.destName.trim().toLowerCase() === city.trim().toLowerCase();
  const isNear = sameCity || !payload.destName || (payload.destMi != null && payload.destMi <= 12);

  const open = async (it) => {
    logDiscover("event_tap", { name: it.name, category: "exp", city, country, partner: "viator" });
    let url = it.url;
    try {
      url = await trackAffiliateClick({ partner: "viator", targetUrl: viatorProductLink(it.url) || viatorSearchLink(it.name), category: "event", productName: it.name, destCity: city, destCountry: country });
    } catch { /* fall back to raw url */ }
    openPartner(url || it.url);
  };

  const expW = wide ? "w-[264px]" : "w-[252px]";

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline gap-2 mb-1.5 px-0.5">
          <span className="text-[calc(10.5px*var(--fs))] font-semibold tracking-[0.08em]" style={{ fontFamily: MONO, color: SUB }}>{isNear ? "EXPERIENCES NEARBY" : "WORTH THE DRIVE"}</span>
          {(payload.destName || city) && <span className="font-serif text-[calc(14px*var(--fs))]" style={{ color: INK }}>{payload.destName || city}</span>}
          {!isNear && payload.destMi != null && <span className="text-[calc(10.5px*var(--fs))]" style={{ fontFamily: MONO, color: SUB }}>~{payload.destMi} mi</span>}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {shownExps.map((it) => (
            <button key={"exp" + it.id} onClick={() => open(it)} className={`flex-none ${expW} rounded-2xl overflow-hidden text-left bg-white`} style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
              <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
                {it.image
                  ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-serif text-[30px]" style={{ color: "rgba(255,255,255,0.85)" }}>{(it.name || "?").charAt(0)}</div>}
              </div>
              <div className="p-3">
                <div className="font-serif leading-[1.14] text-[calc(15px*var(--fs))]" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.name}</div>
                {(it.city || payload.destName || city) && <div className="text-[calc(10.5px*var(--fs))] mt-1 truncate" style={{ fontFamily: MONO, color: SUB }}>{it.city || payload.destName || city}</div>}
                {Number.isFinite(it.fromPrice) && <div className="text-[calc(11px*var(--fs))] mt-1 font-semibold" style={{ fontFamily: MONO, color: INK }}>from {fmtPrice(it.fromPrice, it.currency)}</div>}
                <div className="text-[calc(10px*var(--fs))] mt-1.5 font-semibold" style={{ color: SUB }}>View & book · Viator</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
