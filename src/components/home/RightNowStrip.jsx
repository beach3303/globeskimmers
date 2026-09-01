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
import { logDiscover } from "@/lib/logDiscover";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { placePhrase, geoKey } from "@/lib/placeContext";

const INK = "#16302B", SUB = "#71827D";
const HONESTY = (p) => ` Base this on what is genuinely typical for ${p}. If unsure of a field use an empty array — do NOT invent specific business names. No URLs.`;
const STRARR = { type: "array", items: { type: "string" } };
const DISHARR = { type: "array", items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } } } };
// STABLE foods (breakfast + traditional signature) — don't change → cached long.
const STABLE_SCHEMA = { type: "object", properties: { best_breakfast: STRARR, signature_dishes: DISHARR } };
const stablePrompt = (p) => `For a traveler in ${p}: best_breakfast = 2-4 classic morning foods (short names). signature_dishes = 4-6 traditional dishes the place is genuinely known for, each with a one-line why.${HONESTY(p)}`;
// VIRAL foods (TikTok/IG/YouTube-hyped) — change over time → SHORT, month-rotating
// cache so they never freeze; the AI baseline refreshes (and picks up model
// upgrades), while our own dish-tap tracking becomes the live "trending here now".
const VIRAL_SCHEMA = { type: "object", properties: { viral_foods: DISHARR } };
const viralPrompt = (p) => `For a traveler in ${p}: viral_foods = 4-6 foods that are CURRENTLY trending — the ones travelers hype and post on TikTok/Instagram/YouTube ("you have to try", social-media-famous, even if touristy or a fad), each with a one-line why. Prioritize what is popular right now.${HONESTY(p)}`;
const monthBucket = () => { try { return new Date().toISOString().slice(0, 7); } catch { return "period"; } };

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
  const navigate = useNavigate();
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
    // State-qualified so "Arcadia" foods come from the RIGHT Arcadia.
    const phrase = placePhrase(base);
    const gk = geoKey(base);
    (async () => {
      try {
        // Stable foods cached 1y; viral cached ~monthly (rotating key) so it stays fresh.
        const [stable, viral] = await Promise.all([
          fetchCulture({ cacheKey: `iconicfood:v3:${gk}`, ttlDays: 365, prompt: stablePrompt(phrase), response_json_schema: STABLE_SCHEMA }),
          fetchCulture({ cacheKey: `viralfood:v2:${gk}:${monthBucket()}`, ttlDays: 35, prompt: viralPrompt(phrase), response_json_schema: VIRAL_SCHEMA }),
        ]);
        if (!cancelled) setFoods({ ...(stable && stable.data ? stable.data : {}), ...(viral && viral.data ? viral.data : {}) });
      } catch { if (!cancelled) setFoods(null); }
    })();
    return () => { cancelled = true; };
  }, [city, country, tick]);

  const showBreakfast = part === "earlyMorning" || part === "morning";
  const viral = foods?.viral_foods || [];
  const signature = foods?.signature_dishes || [];
  // Morning → classic breakfast bites; otherwise lead with the 🔥 viral/hype
  // foods people travel to post, falling back to traditional signature dishes.
  // The hype list is an ungrounded model answer (no live social/tap signal yet),
  // so it is framed as "most-hyped (AI picks)", never as live "trending" data.
  const dishes = showBreakfast
    ? (foods?.best_breakfast || []).map((n) => ({ name: n }))
    : (viral.length ? viral : signature);
  const isViral = !showBreakfast && viral.length > 0;
  const hasDishes = dishes.length > 0;
  const dishesLabel = showBreakfast
    ? "Classic morning bites here"
    : isViral ? `🔥 Most-hyped in ${city || "town"}` : `What people come to ${city || "here"} for`;

  const go = (action, where, extra) => { logDiscover("right_now_tap", { dayPart: part, action, where, city, country, ...extra }); onAction?.(action); };
  // Dish chip → open the Eat finder SEARCHING that exact dish (not the generic
  // nearby list), so "Chinese Bakery Pastries" brings back that dish's spots.
  const goDish = (d) => {
    logDiscover("right_now_tap", { dayPart: part, action: "Places to Eat", where: "dish", dish: d.name, viral: isViral, city, country });
    navigate(createPageUrl("PlacesToEat"), { state: { presetQuery: d.name } });
  };

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
              <div className="text-[calc(11.5px*var(--fs))] font-semibold mb-1.5" style={{ color: INK }}>{dishesLabel}</div>
              <div className="flex gap-2 flex-wrap">
                {dishes.slice(0, 5).map((d) => (
                  <button key={d.name} onClick={() => goDish(d)} className="rounded-full px-3 py-1.5 text-[calc(12.5px*var(--fs))] font-semibold" style={{ background: "rgba(255,255,255,0.82)", color: INK }} title={d.why || ""}>
                    {d.name}
                  </button>
                ))}
              </div>
              {/* Honest UX: every dish list here is model-written, so say so —
                  same muted "(AI estimate)" line WhereToStay uses. */}
              <div className="text-[calc(10.5px*var(--fs))] mt-1.5" style={{ color: SUB, opacity: 0.85 }}>{isViral ? "Dish picks are an AI estimate, not live trend data." : "Dish picks are an AI estimate."}</div>
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
