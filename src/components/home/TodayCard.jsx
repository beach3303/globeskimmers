// TodayCard — "Today in {city}": the single zero-query answer card that
// replaces RightNowStrip on the NEARBY Home.
//
// One card, one job: what should I do RIGHT NOW, answered before the user
// types anything. Top to bottom: mono kicker → serif meal-window headline
// (same day-part windows RightNowStrip used) → up to 4 dish chips from the
// SAME cached /culture calls RightNowStrip made (identical cacheKeys, so this
// card creates zero new AI spend) → one headline TONIGHT event line (same
// /events/search body EventsRow sends — the 6h KV entry is shared, zero new
// partner spend) → one teal primary action + a quiet "All events" link.
// Everything fetches in parallel and renders as it lands; a skeleton matching
// the final layout holds the space. Hides itself when there is no dish data
// AND no event. Prop surface is EXACTLY RightNowStrip's so Home swaps it in.
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { getDayPart } from "@/lib/homeContext";
import { callWorker, fetchCulture } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { logDiscover } from "@/lib/logDiscover";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { placePhrase, geoKey } from "@/lib/placeContext";
import { localISODate } from "@/lib/localDate";
import { IVORY, IVORY_2, TEAL_DEEP } from "@/components/redesign/constants";

const INK = "#16110D", SUB = "#736657", EDGE = "#E6DFD0";

// ── Dish fetch — MUST stay byte-identical to RightNowStrip's cacheKeys/prompts
//    so both surfaces share one KV entry per city (no duplicate AI spend).
const HONESTY = (p) => ` Base this on what is genuinely typical for ${p}. If unsure of a field use an empty array — do NOT invent specific business names. No URLs.`;
const STRARR = { type: "array", items: { type: "string" } };
const DISHARR = { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } } } };
const STABLE_SCHEMA = { type: "object", properties: { best_breakfast: STRARR, signature_dishes: DISHARR } };
const stablePrompt = (p) => `For a traveler in ${p}: best_breakfast = 2-4 classic morning foods (short names). signature_dishes = 4-6 traditional dishes the place is genuinely known for, each with a one-line why.${HONESTY(p)}`;
const VIRAL_SCHEMA = { type: "object", properties: { viral_foods: DISHARR } };
const viralPrompt = (p) => `For a traveler in ${p}: viral_foods = 4-6 foods that are CURRENTLY trending — the ones travelers hype and post on TikTok/Instagram/YouTube ("you have to try", social-media-famous, even if touristy or a fad), each with a one-line why. Prioritize what is popular right now.${HONESTY(p)}`;
const monthBucket = () => { try { return new Date().toISOString().slice(0, 7); } catch { return "period"; } };

// Same meal windows RightNowStrip keyed off getDayPart — labels + the primary
// action target, minus the emoji/gradient dressing (Passport Standard: none).
const MEALS = {
  earlyMorning: { label: "Coffee & early bites", primary: { t: "Find coffee", a: "Coffee" } },
  morning: { label: "Breakfast time", primary: { t: "Find breakfast", a: "Places to Eat" } },
  midday: { label: "Lunch time", primary: { t: "Find lunch", a: "Places to Eat" } },
  afternoon: { label: "Afternoon pick-me-up", primary: { t: "Coffee & cafés", a: "Coffee" } },
  evening: { label: "Dinner time", primary: { t: "Find dinner", a: "Places to Eat" } },
  lateNight: { label: "Late-night eats", primary: { t: "Open now", a: "Places to Eat" } },
};

// The worker sends ISO currency codes and fractional TM minimums — same
// formatting rule as EventsRow: "from $35" / "from CHF 35", never "USD39.5".
const CUR_SYM = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
const fmtPrice = (n, cur) => { const c = String(cur || "").toUpperCase(); return `${c ? (CUR_SYM[c] || `${c} `) : "$"}${Math.round(n)}`; };

// Card frame — shared by the loaded card and the skeleton so the space held
// while loading is exactly the space the answer takes.
function Shell({ wide, children }) {
  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="rounded-2xl p-4" style={{ background: IVORY, border: `1px solid ${EDGE}` }}>{children}</div>
      </div>
    </div>
  );
}

function Skeleton({ wide }) {
  const block = (cls) => <div className={`${cls} rounded-full animate-pulse`} style={{ background: IVORY_2 }} />;
  return (
    <Shell wide={wide}>
      {block("h-3 w-28")}
      <div className="mt-2">{block("h-6 w-44")}</div>
      <div className="flex gap-2 mt-3">{block("h-8 w-24")}{block("h-8 w-28")}{block("h-8 w-20")}</div>
      <div className="mt-3.5">{block("h-9 w-36")}</div>
    </Shell>
  );
}

export default function TodayCard({ onAction, wide = false }) {
  const { getActiveLocation } = useLocation();
  const navigate = useNavigate();
  const [foods, setFoods] = useState(null);
  const [foodsPending, setFoodsPending] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsPending, setEventsPending] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  // Local calendar day, re-checked every minute and on resume — without this a
  // card left mounted overnight keeps labelling yesterday's event "TONIGHT"
  // (the exact stale-midnight bug EventsRow already fixes this way).
  const [dayKey, setDayKey] = useState(() => localISODate());
  useEffect(() => {
    const check = () => setDayKey(localISODate());
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, []);

  let hour = 12;
  try { hour = new Date().getHours(); } catch { /* midday */ }
  const part = getDayPart(hour);
  const m = MEALS[part] || MEALS.midday;

  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const country = a.country || base?.country || "";
  const lat = base?.coordinates?.latitude ?? base?.latitude ?? base?.lat;
  const lng = base?.coordinates?.longitude ?? base?.longitude ?? base?.lng;

  // Dish fetch — stable foods cached 1y, viral ~monthly; identical keys to
  // RightNowStrip so whichever surface runs first warms the other.
  useEffect(() => {
    let cancelled = false;
    if (!city && !country) { setFoods(null); setFoodsPending(false); return; }
    const phrase = placePhrase(base);
    const gk = geoKey(base);
    setFoodsPending(true);
    (async () => {
      try {
        const [stable, viral] = await Promise.all([
          fetchCulture({ cacheKey: `iconicfood:v3:${gk}`, ttlDays: 365, prompt: stablePrompt(phrase), response_json_schema: STABLE_SCHEMA }),
          fetchCulture({ cacheKey: `viralfood:v2:${gk}:${monthBucket()}`, ttlDays: 35, prompt: viralPrompt(phrase), response_json_schema: VIRAL_SCHEMA }),
        ]);
        if (!cancelled) setFoods({ ...(stable && stable.data ? stable.data : {}), ...(viral && viral.data ? viral.data : {}) });
      } catch { if (!cancelled) setFoods(null); }
      if (!cancelled) setFoodsPending(false);
    })();
    return () => { cancelled = true; };
  }, [city, country, tick]);

  // Headline event — same route + body EventsRow sends, so the 0.1°-grid KV
  // entry (6h) is shared; this adds no Ticketmaster/Viator calls.
  useEffect(() => {
    let cancelled = false;
    if (!city && !Number.isFinite(lat)) { setEvents([]); setEventsPending(false); return; }
    setEventsPending(true);
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.searchEvents, { city, latitude: lat, longitude: lng, cityName: city });
        if (!cancelled) setEvents(Array.isArray(data?.events) ? data.events : []);
      } catch { if (!cancelled) setEvents([]); }
      if (!cancelled) setEventsPending(false);
    })();
    return () => { cancelled = true; };
  }, [city, country, lat, lng, tick]);

  const showBreakfast = part === "earlyMorning" || part === "morning";
  const viral = foods?.viral_foods || [];
  const signature = foods?.signature_dishes || [];
  const dishes = (showBreakfast
    ? (foods?.best_breakfast || []).map((n) => ({ name: n }))
    : (viral.length ? viral : signature)
  ).slice(0, 4);
  const isViral = !showBreakfast && viral.length > 0;
  const hasDishes = dishes.length > 0;

  // First priced event dated today — the worker's list is soonest-first, so
  // find() picks tonight's headline. Unpriced or future-only days show no line.
  const headline = events.find((e) => e && e.date === dayKey && Number.isFinite(e.fromPrice)) || null;

  const canFoods = !!(city || country);
  const canEvents = !!(city || Number.isFinite(lat));
  const loading = (canFoods && foodsPending) || (canEvents && eventsPending);
  if (!canFoods && !canEvents) return null;
  if (!hasDishes && !headline) return loading ? <Skeleton wide={wide} /> : null;

  const goPrimary = () => { logDiscover("today_card_tap", { dayPart: part, action: m.primary.a, where: "primary", city, country }); onAction?.(m.primary.a); };
  const goAllEvents = () => { logDiscover("today_card_tap", { dayPart: part, action: "Things to Do", where: "all_events", city, country }); onAction?.("Things to Do"); };
  // Dish chip → open the Eat finder SEARCHING that exact dish, same as the
  // strip it replaces, so "Chinese Bakery Pastries" brings back that dish's spots.
  const goDish = (d) => {
    logDiscover("today_card_tap", { dayPart: part, action: "Places to Eat", where: "dish", dish: d.name, viral: isViral, city, country });
    navigate(createPageUrl("PlacesToEat"), { state: { presetQuery: d.name } });
  };

  return (
    <Shell wide={wide}>
      <div className="font-mono uppercase tracking-[0.16em] text-[calc(10.5px*var(--fs))] font-semibold" style={{ color: SUB }}>
        {city ? `Today in ${city}` : "Today"}
      </div>
      <div className="font-serif text-[calc(22px*var(--fs))] leading-tight mt-0.5" style={{ color: INK }}>{m.label}</div>

      {hasDishes && (
        <div className="mt-3">
          <div className="flex gap-2 flex-wrap">
            {dishes.map((d) => (
              <button key={d.name} onClick={() => goDish(d)} className="rounded-full px-3 py-1.5 font-serif text-[calc(14px*var(--fs))]" style={{ background: IVORY_2, color: INK, border: `1px solid ${EDGE}` }} title={d.why || ""}>
                {d.name}
              </button>
            ))}
          </div>
          {/* Honest UX: the dish list is model-written — same muted line the strip used. */}
          <div className="text-[calc(10.5px*var(--fs))] mt-1.5" style={{ color: SUB }}>
            {isViral ? "Dish picks are an AI estimate, not live trend data." : "Dish picks are an AI estimate."}
          </div>
        </div>
      )}

      {headline && (
        <div className="font-mono tracking-[0.04em] text-[calc(11px*var(--fs))] mt-3 truncate" style={{ color: INK }}>
          {`TONIGHT · ${headline.name} · from ${fmtPrice(headline.fromPrice, headline.currency)}`}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-3.5">
        <button onClick={goPrimary} className="rounded-full px-4 py-2 text-[calc(13.5px*var(--fs))] font-semibold text-white" style={{ background: TEAL_DEEP }}>{m.primary.t}</button>
        <button onClick={goAllEvents} className="text-[calc(12px*var(--fs))] font-semibold" style={{ color: SUB, textDecorationLine: "underline", textUnderlineOffset: 3 }}>All events</button>
      </div>
    </Shell>
  );
}
