// RightNowStrip — "your day, curated" + destination-aware viral foods.
//
// A time-of-day card that folds THREE things into one: (1) what meal it is now,
// (2) the ICONIC/viral foods people actually come to THIS place for (breakfast
// classics in the morning, the city's signature dishes at lunch/dinner), and
// (3) a one-tap route into the Eat finder to go get it. Cheap: the iconic-food
// list is one cached /culture call per city (shared across all users); the strip
// itself does no per-load Google spend. Changes through the day via getDayPart;
// falls back to generic chips when a city/foods aren't resolved. Parent hides it
// when "planning" a far city. Logs taps so we learn each place's food demand.
import React, { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { getDayPart } from "@/lib/homeContext";
import { fetchCulture } from "@/lib/callWorker";
import { getPrimaryStay } from "@/lib/savedLocations";
import { trackEvent } from "@/Layout";

const INK = "#16302B", SUB = "#71827D";
const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
const HONESTY = (p) => ` Base this on what is genuinely typical for ${p}. If unsure of a field use an empty array — do NOT invent specific business names. No URLs.`;
const FOOD_SCHEMA = { type: "object", properties: { best_breakfast: { type: "array", items: { type: "string" } }, signature_dishes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } } } } } };
const foodPrompt = (p) => `For a traveler in ${p}, list the iconic foods people come here for. best_breakfast: 2-4 classic morning foods (short names). signature_dishes: the 5-6 most-loved dishes, each with a one-line why.${HONESTY(p)}`;

const MEALS = {
  earlyMorning: { emoji: "☕", label: "Coffee & early bites", grad: "linear-gradient(135deg,#FBE9D0,#F3D2A6)", primary: { t: "Find coffee", a: "Coffee" }, chips: [{ e: "🥐", t: "Bakeries", a: "Places to Eat" }, { e: "🍳", t: "Breakfast", a: "Places to Eat" }] },
  morning: { emoji: "🍳", label: "Breakfast time", grad: "linear-gradient(135deg,#FBE9D0,#F3D2A6)", primary: { t: "Find breakfast", a: "Places to Eat" }, chips: [{ e: "☕", t: "Coffee", a: "Coffee" }, { e: "🥐", t: "Bakeries", a: "Places to Eat" }] },
  midday: { emoji: "🥗", label: "Lunch time", grad: "linear-gradient(135deg,#E7F3EA,#CDE9D3)", primary: { t: "Find lunch", a: "Places to Eat" }, chips: [{ e: "☕", t: "Coffee", a: "Coffee" }, { e: "🛍️", t: "Shops", a: "Shopping" }] },
  afternoon: { emoji: "🍵", label: "Afternoon pick-me-up", grad: "linear-gradient(135deg,#E9F0FB,#D3E2F8)", primary: { t: "Coffee & cafés", a: "Coffee" }, chips: [{ e: "🍨", t: "Sweet treats", a: "Places to Eat" }, { e: "🎭", t: "Things to do", a: "Things to Do" }] },
  evening: { emoji: "🍽️", label: "Dinner time", grad: "linear-gradient(135deg,#F3E4EF,#E6CBDD)", primary: { t: "Find dinner", a: "Places to Eat" }, chips: [{ e: "🍸", t: "Drinks", a: "Places to Eat" }, { e: "🎭", t: "Tonight", a: "Things to Do" }] },
  lateNight: { emoji: "🌙", label: "Late-night eats", grad: "linear-gradient(135deg,#E5E4F3,#CFCEEC)", primary: { t: "Open now", a: "Places to Eat" }, chips: [{ e: "🏪", t: "Convenience", a: "Convenience Store" }, { e: "🏧", t: "ATM", a: "ATM" }] },
};

export default function RightNowStrip({ onAction, wide = false }) {
  const { getActiveLocation } = useLocation();
  const [foods, setFoods] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  let hour = 12;
  try { hour = new Date().getHours(); } catch { /* midday */ }
  const part = getDayPart(hour);
  const m = MEALS[part] || MEALS.midday;

  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const country = a.country || base?.country || "";

  useEffect(() => {
    let cancelled = false;
    if (!city && !country) { setFoods(null); return; }
    const placePhrase = city ? `${city}, ${country}` : country;
    (async () => {
      try {
        const res = await fetchCulture({ cacheKey: `iconicfood:${slug(city)}|${slug(country)}`, ttlDays: 365, prompt: foodPrompt(placePhrase), response_json_schema: FOOD_SCHEMA });
        if (!cancelled) setFoods(res && res.data ? res.data : null);
      } catch { if (!cancelled) setFoods(null); }
    })();
    return () => { cancelled = true; };
  }, [city, country, tick]);

  const showBreakfast = part === "earlyMorning" || part === "morning";
  const dishes = showBreakfast
    ? (foods?.best_breakfast || []).map((n) => ({ name: n }))
    : (foods?.signature_dishes || []);
  const hasDishes = dishes.length > 0;

  const go = (action, where, extra) => { trackEvent("right_now_tap", { dayPart: part, action, where, ...extra }); onAction?.(action); };

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="rounded-2xl p-3.5" style={{ background: m.grad }}>
          <div className="flex items-center gap-2.5 mb-2">
            <span style={{ fontSize: 24 }}>{m.emoji}</span>
            <div className="min-w-0">
              <div className="text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-wide" style={{ color: SUB }}>Right now{city ? ` in ${city}` : ""}</div>
              <div className="font-serif text-[calc(18px*var(--fs))] leading-tight" style={{ color: INK }}>{m.label}</div>
            </div>
          </div>

          {hasDishes && (
            <div className="mb-2.5">
              <div className="text-[calc(11.5px*var(--fs))] font-semibold mb-1.5" style={{ color: INK }}>
                {showBreakfast ? "Classic morning bites here" : `What people come to ${city || "here"} for`}
              </div>
              <div className="flex gap-2 flex-wrap">
                {dishes.slice(0, 5).map((d) => (
                  <button key={d.name} onClick={() => go("Places to Eat", "dish", { dish: d.name })} className="rounded-full px-3 py-1.5 text-[calc(12.5px*var(--fs))] font-semibold" style={{ background: "rgba(255,255,255,0.82)", color: INK }} title={d.why || ""}>
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => go(m.primary.a, "primary")} className="rounded-full px-4 py-2 text-[calc(13.5px*var(--fs))] font-semibold text-white" style={{ background: INK }}>{m.primary.t} →</button>
            {/* generic quick-chips only when we have no destination dishes to show */}
            {!hasDishes && m.chips.map((c) => (
              <button key={c.t} onClick={() => go(c.a, "chip")} className="rounded-full px-3 py-2 text-[calc(12.5px*var(--fs))] font-semibold flex items-center gap-1" style={{ background: "rgba(255,255,255,0.72)", color: INK }}>
                <span>{c.e}</span>{c.t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
