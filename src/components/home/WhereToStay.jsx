// WhereToStay — "Where should I stay in [city]?"
//
// The marquee decision-helper: for a place you don't have a base yet, recommend
// 2-4 POPULAR visitor neighborhoods near the main sights + good transit, with a
// "do you need a car?" verdict, then hand off to FindAHotel scoped to the chosen
// area. Frontend-only: one cached /culture call per city (shared across users).
// Honest by design — areas are framed as "popular with visitors," never "safe";
// no street-level safety claims; the AI estimate is labeled. Shown when the user
// is planning / away and hasn't set a stay yet (parent gates it).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Car, ChevronRight } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { fetchCulture } from "@/lib/callWorker";
import { logDiscover } from "@/lib/logDiscover";
import { createPageUrl } from "@/utils";
import { placePhrase, geoKey, placeParts } from "@/lib/placeContext";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const HON = " Frame areas as 'popular with visitors', NOT as 'safe' — never make street-level safety claims. Base on what is genuinely typical for the place; if unsure use empty arrays; no invented street names; no URLs.";
const STR = { type: "string" }, STRARR = { type: "array", items: { type: "string" } };
const SCHEMA = { type: "object", properties: { base_areas: { type: "array", items: { type: "object", properties: { name: STR, vibe: STR, why_good_base: STR, near_which_sights: STRARR, transit_note: STR, price_level: STR, good_for: STRARR } } }, avoid_airport_note: STR, car_verdict: STR, car_verdict_line: STR, disclaimer: STR } };
const prompt = (p) => `Recommend where a first-time visitor should base themselves in ${p}. base_areas: 3-4 popular, well-touristed neighborhoods near the main sights with good transit; each with name, vibe, why_good_base, near_which_sights (2-4), transit_note, price_level (budget/mid/upscale), good_for (2-3 like first-timers/families/nightlife). avoid_airport_note. car_verdict: EXACTLY one of not_needed/helpful/essential/avoid. car_verdict_line (one sentence). disclaimer (one sentence).${HON}`;

const CAR = {
  not_needed: { label: "No car needed", bg: "#E7F3EA", ink: "#266A3B" },
  helpful: { label: "A car helps", bg: "#EAF0FB", ink: "#205FCF" },
  essential: { label: "You'll want a car", bg: "#FCEAC9", ink: "#8A5410" },
  avoid: { label: "Don't drive", bg: "#FBE0DC", ink: "#A82C24" },
};
const PRICE = { budget: "$", mid: "$$", upscale: "$$$" };

export default function WhereToStay({ wide = false }) {
  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty
  const [going, setGoing] = useState(null); // area name being handed off

  const active = getActiveLocation?.();
  const a = active?.address || {};
  const city = a.city || active?.placeName || "";
  const country = a.country || "";

  useEffect(() => {
    let cancelled = false;
    if (!city && !country) { setStatus("empty"); return; }
    setStatus("loading");
    const phrase = placePhrase(active); // "City, State, Country" — disambiguates Arcadia CA vs FL
    (async () => {
      try {
        const res = await fetchCulture({ cacheKey: `wheretostay:v2:${geoKey(active)}`, ttlDays: 365, prompt: prompt(phrase), response_json_schema: SCHEMA });
        if (cancelled) return;
        const areas = res && res.data && Array.isArray(res.data.base_areas) ? res.data.base_areas.filter((x) => x && x.name) : [];
        if (!areas.length) { setStatus("empty"); return; }
        setData(res.data); setStatus("ready");
        logDiscover("where_to_stay_view", { city, country, areas: areas.length });
      } catch { if (!cancelled) setStatus("empty"); }
    })();
    return () => { cancelled = true; };
  }, [city, country]);

  if (status === "empty") return null;

  // Geocode the chosen area, then open FindAHotel scoped to it.
  const findHotels = async (area) => {
    if (going) return;
    setGoing(area.name);
    logDiscover("where_to_stay_area_tap", { city, country, area: area.name, price: area.price_level });
    const st = placeParts(active).state;
    const areaQuery = [area.name, city, st].filter(Boolean).join(", "); // include state so the right city's area is geocoded
    let presetCity = null;
    try {
      const { data: d } = await callWorker(ROUTE.searchLocation, { query: areaQuery });
      presetCity = (d && Array.isArray(d.results) && d.results[0]) || null;
    } catch { /* fall through */ }
    setGoing(null);
    navigate(createPageUrl("FindAHotel"), { state: presetCity ? { presetCity } : { presetQuery: areaQuery } });
  };

  const car = CAR[data?.car_verdict];

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline justify-between mb-1 px-0.5 gap-3">
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>Where visitors usually stay{city ? ` in ${city}` : ""}</div>
          {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" style={{ color: SUB }} />}
        </div>
        <div className="text-[calc(11.5px*var(--fs))] mb-2.5 px-0.5" style={{ color: SUB }}>Popular areas to base yourself if you&rsquo;re booking a place.</div>

        {status === "ready" && (
          <>
            {car && (
              <div className="flex items-center gap-2 mb-2.5 rounded-xl px-3 py-2" style={{ background: car.bg }}>
                <Car className="w-4 h-4 flex-shrink-0" style={{ color: car.ink }} />
                <span className="text-[calc(12.5px*var(--fs))]" style={{ color: car.ink }}><b>{car.label}.</b> {data.car_verdict_line}</span>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {data.base_areas.slice(0, 4).map((area) => (
                <button key={area.name} onClick={() => findHotels(area)} className="text-left rounded-2xl p-3" style={{ background: "#fff", border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -18px rgba(22,17,13,.4)" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[calc(17px*var(--fs))]" style={{ color: INK }}>{area.name}</span>
                    {area.price_level && <span className="text-[calc(11px*var(--fs))] font-bold" style={{ color: TEAL }}>{PRICE[String(area.price_level).toLowerCase()] || area.price_level}</span>}
                    <span className="ml-auto flex items-center gap-1 text-[calc(12px*var(--fs))] font-semibold" style={{ color: TEAL }}>{going === area.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Find hotels <ChevronRight className="w-3.5 h-3.5" /></>}</span>
                  </div>
                  {area.vibe && <div className="text-[calc(12.5px*var(--fs))] mt-0.5" style={{ color: SUB }}>{area.vibe}</div>}
                  {Array.isArray(area.near_which_sights) && area.near_which_sights.length > 0 && (
                    <div className="text-[calc(11.5px*var(--fs))] mt-1.5" style={{ color: INK }}>📍 Near {area.near_which_sights.slice(0, 3).join(" · ")}</div>
                  )}
                  {area.transit_note && <div className="text-[calc(11px*var(--fs))] mt-1" style={{ color: SUB }}>🚆 {area.transit_note}</div>}
                </button>
              ))}
            </div>
            {data.avoid_airport_note && <div className="text-[calc(11.5px*var(--fs))] mt-2 px-0.5" style={{ color: SUB }}>✈️ {data.avoid_airport_note}</div>}
            <div className="text-[calc(10.5px*var(--fs))] mt-2 px-0.5" style={{ color: SUB, opacity: 0.85 }}>Popular visitor areas (AI estimate) — always check recent reviews for the exact hotel & block.{data.disclaimer ? ` ${data.disclaimer}` : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
