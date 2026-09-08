// EscapesRow — "Day trips & escapes from [base]".
//
// Radiates day-trips from wherever the user is BASED (primary stay if set, else
// the active location) — works at home (weekend escapes) OR on vacation (day
// trips from your base). Reuses Insight's `day_trips` AI section via the SAME
// /culture cacheKey, so it shares that cache (no extra AI spend) and stays
// consistent with the Insight page. Honest: AI-estimated, real travel time+mode
// (needs_car), no fabricated specifics. Every view/tap is logged so we learn
// which escapes each base's visitors actually want (the demand-driven loop).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/components/location/LocationContext";
import { fetchCulture } from "@/lib/callWorker";
import { getPrimaryStay } from "@/lib/savedLocations";
import { logDiscover } from "@/lib/logDiscover";
import { createPageUrl } from "@/utils";
import { placePhrase, geoKey } from "@/lib/placeContext";

// Mirror Insight's day-trip prompt + schema exactly (shared /culture cache key).
const HONESTY = (place) => ` Base this on what is genuinely typical for ${place}. If you are unsure of a field, use an empty array or null — do NOT invent specific business names or streets you are not confident about. Do not include any URLs.`;
const STR = { type: "string" }, BOOL = { type: "boolean" };
const SCHEMA = { type: "object", properties: { day_trips: { type: "array", items: { type: "object", properties: { name: STR, distance_or_time: STR, why: STR, how_to_get_there: STR, needs_car: BOOL } } } } };
const dayTripPrompt = (p) => `List the best day trips a traveler can take from ${p}: 3-6 trips, each with name, distance_or_time (e.g. "1.5h by train"), why it's worth it, how_to_get_there (short), and needs_car (boolean — true if realistically only doable with a car).${HONESTY(p)}`;

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Mono travel tag ("TRAIN 1.5H" / "DRIVE 2H" / "BUS 45MIN") built ONLY from
// fields the AI already returned: the mode word comes from distance_or_time's
// own wording when it names one (train/bus/ferry/…), needs_car otherwise, and
// the duration is echoed from that same string — never invented. Anything
// unparseable falls back to the verbatim string after the mode word.
function travelTag(t) {
  const s = String(t.distance_or_time || "").trim();
  const m = /\b(train|bus|ferry|boat|metro|tram)\b/i.exec(s);
  const mode = m ? m[1].toUpperCase() : (t.needs_car ? "DRIVE" : "TRANSIT");
  const h = /(\d+(?:[.,]\d+)?)\s*(?:h\b|hr|hour)/i.exec(s);
  if (h) return `${mode} ${h[1].replace(",", ".")}H`;
  const min = /(\d+)\s*min/i.exec(s);
  if (min) return `${mode} ${min[1]}MIN`;
  return s ? `${mode} · ${s.toUpperCase()}` : mode;
}

export default function EscapesRow({ onAction, wide = false }) {
  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [tick, setTick] = useState(0); // bump when the stay anchor changes

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  // Base = the primary stay if set, else wherever they're looking.
  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const country = a.country || base?.country || "";
  useEffect(() => {
    let cancelled = false;
    if (!city && !country) { setTrips([]); return; }
    // State-qualified key + prompt so "Arcadia" resolves to the RIGHT Arcadia.
    const cacheKey = `insight:city:${geoKey(base)}:day_trips`;
    (async () => {
      try {
        const res = await fetchCulture({ cacheKey, ttlDays: 365, prompt: dayTripPrompt(placePhrase(base)), response_json_schema: SCHEMA });
        if (cancelled) return;
        const list = res && res.data && Array.isArray(res.data.day_trips) ? res.data.day_trips.filter((t) => t && t.name) : [];
        setTrips(list);
        if (list.length) logDiscover("escape_view", { city, country, count: list.length });
      } catch { if (!cancelled) setTrips([]); }
    })();
    return () => { cancelled = true; };
  }, [city, country, tick]);

  if (!trips.length) return null;

  const openTrip = (t) => {
    logDiscover("escape_card_tap", { name: t.name, city, country, needs_car: !!t.needs_car });
    navigate(createPageUrl("Insight")); // planning hub: full list + how-to-get-there + car verdict
  };
  const seeAll = () => { logDiscover("escape_see_all", { city, country }); navigate(createPageUrl("Insight")); };

  const where = city || "here";
  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>Day trips &amp; escapes from {where}</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>Worth-the-drive ideas around your base</div>
          </div>
          <button onClick={seeAll} className="flex-none text-[calc(12.5px*var(--fs))] font-semibold" style={{ color: TEAL }}>Plan →</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {trips.map((t, i) => (
            <button
              key={t.name + i}
              onClick={() => openTrip(t)}
              className={`flex-none ${wide ? "w-[210px]" : "w-[186px]"} rounded-2xl overflow-hidden text-left`}
              style={{ background: "#fff", border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}
            >
              <div className="px-3 pt-2.5 pb-1.5" style={{ background: "linear-gradient(135deg,#E9F5F1,#D6ECE5)" }}>
                <span className="block truncate uppercase tracking-[0.08em] text-[calc(10px*var(--fs))] font-semibold" style={{ fontFamily: MONO, color: "#15645A" }}>{travelTag(t)}</span>
              </div>
              <div className="p-3">
                <div className="font-serif leading-[1.12] text-[calc(16px*var(--fs))]" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.name}</div>
                {t.why && <div className="text-[calc(11.5px*var(--fs))] mt-1" style={{ color: SUB, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.why}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
