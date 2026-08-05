import React, { useState, useEffect, useCallback } from "react";
import { fetchCulture } from "@/lib/callWorker";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, Navigation, RefreshCw, ChevronLeft, Lightbulb, ChevronRight } from "lucide-react";
import { IVORY, IVORY_2, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";
import { useIsTablet } from "@/lib/useIsTablet";

// ============================================================================
// Insight — the "how do I actually DO this trip well" layer. Sits alongside
// Cultural Info (facts) and Things to Do (places): Insight answers the PLANNING
// questions a smart traveler asks — do I need a car here? what does 1 day / 3
// days look like? how do I beat the crowds? what do locals actually do?
//
// Content is AI-ESTIMATED to help planning, and stamped honestly (updated date
// + a plain "double-check specifics" note). It reuses the existing generic
// /culture Worker endpoint (cached Haiku + stale-while-revalidate), so this is
// a FRONTEND-ONLY feature — each section below is one cached Haiku call keyed
// per city. Insight also routes into the bookable surfaces (Book a Ride, Travel
// Essentials) at the moment they're useful — honest recommendations, no neutral
// comparison to muddy (unlike the Money Exchange screen).
// ============================================================================

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const SANS = '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.10)";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// Insight accent world — indigo (distinct from Culture brown / Things-to-do rose).
const ACCENT = { ink: "#4F46E5", bg: "#EAE9FD", soft: "#D8D6FB" };
const NOTE = { bg: "#FBEFD7", border: "#EBD9AE", ink: "#7E601F" };
const TONE = {
  green: ["#E7F3EA", "#266A3B"], blue: ["#EAF0FB", "#205FCF"],
  amber: ["#FCEAC9", "#8A5410"], rose: ["#FBE0DC", "#A82C24"],
  violet: ["#EAE0FA", "#6D29D9"], slate: ["#EFE8D9", "#736657"],
};

// ---- small utils -----------------------------------------------------------
const slug = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
const hasData = (v) => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "object") return Object.values(v).some(hasData);
  return true;
};
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return null; }
};
async function runLimited(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { results[i] = await fn(items[i], i); } catch (e) { results[i] = { error: e?.message || "failed" }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}
// In-memory memo so remounts within a session don't refetch (KV is the real cache).
const _memo = new Map();
const MEMO_MS = 15 * 60 * 1000;

// ---- schema helpers --------------------------------------------------------
const STR = { type: "string" };
const BOOL = { type: "boolean" };
const STRARR = { type: "array", items: { type: "string" } };
const objOf = (properties) => ({ type: "object", properties });
const arrOf = (properties) => ({ type: "array", items: { type: "object", properties } });
const HONESTY = (place) =>
  ` Base this on what is genuinely typical for ${place}. If you are unsure of a field, use an empty array or null — do NOT invent specific business names or streets you are not confident about. Do not include any URLs.`;

// ============================================================================
// SECTIONS — each is one cached Haiku call, keyed per city. `render(data)`
// returns the section body; a section that comes back empty renders a soft
// "not enough local detail" line instead of a blank card.
// ============================================================================
const SECTIONS = [
  {
    id: "need_a_car", icon: "🚗", title: "Do you need a car here?", ttlDays: 365,
    prompt: (p) => `For a traveler in ${p}, judge whether they need a rental car. Return car_verdict as EXACTLY one of: "not_needed" (great public transit / walkable — renting is a hassle), "helpful" (fine without one but a car opens things up), "essential" (you really want your own wheels), or "avoid" (driving/parking is a nightmare — don't). Give a one-sentence verdict_line, how_locals_get_around (3-5 short items), when_you_do_need_wheels (situations a visitor would still want a car, e.g. day trips — 0-4 items), and a short parking_or_traffic_note.${HONESTY(p)}`,
    schema: objOf({ car_verdict: STR, verdict_line: STR, how_locals_get_around: STRARR, when_you_do_need_wheels: STRARR, parking_or_traffic_note: STR }),
    render: (d, ctx) => {
      const V = {
        not_needed: { label: "Skip the car", tone: "green", sub: "Great transit / walkable" },
        helpful: { label: "Nice to have", tone: "amber", sub: "Fine without, better with" },
        essential: { label: "Get wheels", tone: "blue", sub: "You'll want your own car" },
        avoid: { label: "Don't drive", tone: "rose", sub: "Parking / traffic is rough" },
      };
      const v = V[String(d.car_verdict || "").toLowerCase()] || null;
      const wantsCar = ["helpful", "essential"].includes(String(d.car_verdict || "").toLowerCase());
      return (
        <div className="space-y-3">
          {v && (
            <div className="flex items-center gap-2.5">
              <Pill tone={v.tone} big>{v.label}</Pill>
              <span style={{ color: INK3, fontSize: fs(12), fontFamily: SANS }}>{v.sub}</span>
            </div>
          )}
          {hasData(d.verdict_line) && <p style={{ color: INK2, fontSize: fs(14), lineHeight: 1.5 }}>{d.verdict_line}</p>}
          {hasData(d.how_locals_get_around) && <Chips label="How locals get around" items={d.how_locals_get_around} />}
          {hasData(d.when_you_do_need_wheels) && <Bullets label="When you'd still want a car" items={d.when_you_do_need_wheels} />}
          {hasData(d.parking_or_traffic_note) && <Meta icon="🅿️">{d.parking_or_traffic_note}</Meta>}
          <RouteButton
            onClick={() => ctx.go("Get A Ride")}
            label={wantsCar ? `Rent a car or book a transfer in ${ctx.cityShort}` : `Book a ride when you need one`}
          />
        </div>
      );
    },
  },
  {
    id: "itinerary", icon: "🗓️", title: "If you've got 1 day · 3 days", ttlDays: 365,
    prompt: (p) => `Give a REALISTIC (not overstuffed) plan for a first-time visitor to ${p}. one_day: 3-5 stops in a sensible order (each: time_of_day like "Morning"/"Afternoon"/"Evening", activity, area, and a short note). three_day: 3 entries (each: day number 1-3, a short theme, and 2-4 highlights). Keep pacing realistic — account for travel time between stops.${HONESTY(p)}`,
    schema: objOf({
      one_day: arrOf({ time_of_day: STR, activity: STR, area: STR, note: STR }),
      three_day: arrOf({ day: { type: "number" }, theme: STR, highlights: STRARR }),
    }),
    render: (d) => (
      <div className="space-y-4">
        {hasData(d.one_day) && (
          <div>
            <Label>Perfect 1 day</Label>
            <div className="space-y-2 mt-1.5">
              {d.one_day.filter(hasData).map((s, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="shrink-0 mt-0.5 rounded-lg px-2 py-1 text-center" style={{ background: ACCENT.bg, minWidth: 64 }}>
                    <span style={{ color: ACCENT.ink, fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".02em" }}>{s.time_of_day || "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: INK, fontSize: fs(14), fontWeight: 600, lineHeight: 1.35 }}>{s.activity}</p>
                    {hasData(s.area) && <p style={{ color: INK3, fontSize: fs(11.5), fontFamily: MONO }}>📍 {s.area}</p>}
                    {hasData(s.note) && <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.45, marginTop: 2 }}>{s.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasData(d.three_day) && (
          <div>
            <Label>Got 3 days?</Label>
            <div className="space-y-2 mt-1.5">
              {d.three_day.filter(hasData).map((day, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: IVORY_2, border: `1px solid ${RULE}` }}>
                  <p style={{ color: ACCENT.ink, fontFamily: SERIF, fontSize: fs(16) }}>Day {day.day || i + 1} · {day.theme}</p>
                  {hasData(day.highlights) && (
                    <ul className="mt-1 space-y-0.5">
                      {day.highlights.filter(hasData).map((h, j) => (
                        <li key={j} style={{ color: INK2, fontSize: fs(13), lineHeight: 1.45 }}>· {h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
  },
  {
    id: "day_trips", icon: "🚡", title: "Day trips from here", ttlDays: 365,
    prompt: (p) => `List the best day trips a traveler can take from ${p}: 3-6 trips, each with name, distance_or_time (e.g. "1.5h by train"), why it's worth it, how_to_get_there (short), and needs_car (boolean — true if realistically only doable with a car).${HONESTY(p)}`,
    schema: objOf({ day_trips: arrOf({ name: STR, distance_or_time: STR, why: STR, how_to_get_there: STR, needs_car: BOOL }) }),
    render: (d, ctx) => {
      const trips = Array.isArray(d.day_trips) ? d.day_trips.filter(hasData) : [];
      const anyCar = trips.some((t) => t.needs_car);
      return (
        <div className="space-y-2">
          {trips.map((t, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: IVORY_2, border: `1px solid ${RULE}` }}>
              <div className="flex items-center justify-between gap-2">
                <p style={{ color: INK, fontSize: fs(14), fontWeight: 600, lineHeight: 1.3 }}>{t.name}</p>
                {hasData(t.distance_or_time) && <span style={{ color: ACCENT.ink, fontFamily: MONO, fontSize: fs(10.5), whiteSpace: "nowrap" }}>{t.distance_or_time}</span>}
              </div>
              {hasData(t.why) && <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.45, marginTop: 2 }}>{t.why}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {hasData(t.how_to_get_there) && <span style={{ color: INK3, fontSize: fs(11.5) }}>🚉 {t.how_to_get_there}</span>}
                {t.needs_car && <Pill tone="amber">Car needed</Pill>}
              </div>
            </div>
          ))}
          {anyCar && <RouteButton onClick={() => ctx.go("Get A Ride")} label="Rent a car for the drive" />}
        </div>
      );
    },
  },
];

// ============================================================================
// Small presentational pieces
// ============================================================================
function Pill({ children, tone = "slate", big }) {
  const [bg, color] = TONE[tone] || TONE.slate;
  return (
    <span style={{ background: bg, color, fontSize: fs(big ? 12.5 : 10.5), fontFamily: SANS }}
      className={`${big ? "px-3 py-1" : "px-2.5 py-0.5"} rounded-full font-semibold leading-tight inline-block`}>{children}</span>
  );
}
function Label({ children }) {
  return <p className="uppercase font-semibold" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: INK3 }}>{children}</p>;
}
function KV({ label, value, accent }) {
  return (
    <div>
      <Label>{label}</Label>
      <p style={{ color: accent ? ACCENT.ink : INK2, fontSize: fs(13.5), lineHeight: 1.5, fontWeight: accent ? 600 : 400 }}>{value}</p>
    </div>
  );
}
function Meta({ icon, children }) {
  return <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.45 }}>{icon ? `${icon} ` : ""}{children}</p>;
}
function Chips({ label, items, tone }) {
  const [bg, color] = tone ? (TONE[tone] || TONE.slate) : [IVORY_2, INK2];
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {items.filter(hasData).map((it, i) => (
          <span key={i} style={{ background: bg, color, fontSize: fs(12), fontFamily: SANS }} className="px-2.5 py-1 rounded-full font-medium">{it}</span>
        ))}
      </div>
    </div>
  );
}
function Bullets({ label, items }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <ul className="mt-1 space-y-0.5">
        {items.filter(hasData).map((it, i) => (
          <li key={i} style={{ color: INK2, fontSize: fs(13), lineHeight: 1.5 }}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}
function RouteButton({ onClick, label }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 mt-1 transition-transform active:scale-[.99]"
      style={{ background: ACCENT.ink, color: "#fff" }}>
      <span style={{ fontSize: fs(13.5), fontWeight: 600, fontFamily: SANS }}>{label}</span>
      <ChevronRight size={17} strokeWidth={2.4} />
    </button>
  );
}

function FreshnessLine({ meta }) {
  if (!meta) return null;
  const updated = fmtDate(meta.last_verified_at);
  if (!updated) return null;
  return (
    <span style={{ color: INK3, fontFamily: MONO, fontSize: fs(9.5) }}>
      {meta.stale ? "May have changed · " : ""}Updated {updated}
    </span>
  );
}

function SectionCard({ section, state, onRefresh, ctx }) {
  const status = state?.status;
  const data = state?.data;
  const empty = status === "ok" && !hasData(data);
  return (
    <div className="bg-white rounded-[22px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontSize: 20, lineHeight: 1 }}>{section.icon}</span>
          <h3 className="truncate" style={{ fontFamily: SERIF, fontSize: fs(20), color: INK, lineHeight: 1.1 }}>{section.title}</h3>
        </div>
        {status === "ok" && (
          <button onClick={onRefresh} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5" title="Refresh">
            <RefreshCw size={13} color={INK3} strokeWidth={2} />
          </button>
        )}
      </div>
      {status === "loading" && (
        <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT.ink }} /><span style={{ color: INK3, fontSize: fs(12.5) }}>Thinking it through…</span></div>
      )}
      {status === "error" && (
        <button onClick={onRefresh} style={{ color: ACCENT.ink, fontSize: fs(13) }} className="underline underline-offset-2">Couldn't load — tap to retry</button>
      )}
      {empty && <p style={{ color: INK3, fontSize: fs(13) }}>Not enough local detail for this one yet.</p>}
      {status === "ok" && !empty && (
        <>
          {section.render(data, ctx)}
          <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${RULE}` }}><FreshnessLine meta={state.meta} /></div>
        </>
      )}
    </div>
  );
}

// A "plan ahead" strip → routes into the bookable surfaces at the useful moment.
function PlanAheadStrip({ go }) {
  const items = [
    { e: "📶", t: "Get an eSIM", s: "Data before you land", a: "Travel Essentials" },
    { e: "✈️", t: "Airport transfer", s: "Skip the taxi line", a: "Get A Ride" },
    { e: "🧳", t: "Store luggage", s: "Hands-free days", a: "Travel Essentials" },
    { e: "🏨", t: "Where to stay", s: "Book your base", a: "Travel Essentials" },
  ];
  return (
    <div className="bg-white rounded-[22px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      <div className="flex items-center gap-2 mb-1"><span style={{ fontSize: 20 }}>🧳</span><h3 style={{ fontFamily: SERIF, fontSize: fs(20), color: INK }}>Plan ahead</h3></div>
      <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.45, marginBottom: 10 }}>Sort these before you go and the trip runs smoother.</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <button key={it.t} onClick={() => go(it.a)} className="text-left rounded-xl p-3 transition-transform active:scale-[.98]" style={{ background: IVORY_2, border: `1px solid ${RULE}` }}>
            <div style={{ fontSize: 20, lineHeight: 1 }}>{it.e}</div>
            <p style={{ color: INK, fontSize: fs(13), fontWeight: 600, marginTop: 4 }}>{it.t}</p>
            <p style={{ color: INK3, fontSize: fs(11), lineHeight: 1.35 }}>{it.s}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
export default function InsightPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[1024px]" : "max-w-md";
  const { activeLocation, locationMode, initialized, switchToCurrentLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [results, setResults] = useState({}); // sectionId -> { status, data, meta }

  const geo = (() => {
    const a = activeLocation?.address || {};
    return { country: a.country || "", city: a.city || activeLocation?.placeName || "" };
  })();
  const citySlug = slug(geo.city);
  const countrySlug = slug(geo.country);
  const cityName = geo.city || geo.country;
  const cityShort = geo.city || geo.country || "town";
  const placePhrase = geo.city ? `${geo.city}, ${geo.country}` : geo.country;

  const go = useCallback((action) => {
    const routes = { "Get A Ride": "GetARide", "Travel Essentials": "TravelEssentials", "Things to Do": "ThingsToDo" };
    if (routes[action]) navigate(createPageUrl(routes[action]));
  }, [navigate]);

  const fetchOne = useCallback(async (section, force) => {
    const cacheKey = `insight:city:${citySlug}|${countrySlug}:${section.id}`;
    if (!force) {
      const m = _memo.get(cacheKey);
      if (m && Date.now() - m.at < MEMO_MS) return { data: m.data, meta: m.meta, error: null };
    }
    const res = await fetchCulture({
      cacheKey, ttlDays: section.ttlDays, prompt: section.prompt(placePhrase),
      response_json_schema: section.schema, forceRefresh: !!force,
    });
    if (!res.error && res.data) _memo.set(cacheKey, { data: res.data, meta: res.meta, at: Date.now() });
    return res;
  }, [citySlug, countrySlug, placePhrase]);

  const loadAll = useCallback(async (force = false) => {
    if (!geo.country && !geo.city) return;
    setLoading(true);
    setResults((prev) => {
      const next = { ...prev };
      SECTIONS.forEach((s) => { next[s.id] = { ...(next[s.id] || {}), status: "loading" }; });
      return next;
    });
    await runLimited(SECTIONS, 4, async (section) => {
      const res = await fetchOne(section, force);
      setResults((prev) => ({ ...prev, [section.id]: res.error ? { status: "error", error: res.error } : { status: "ok", data: res.data, meta: res.meta } }));
    });
    setLoading(false);
  }, [geo.country, geo.city, fetchOne]);

  useEffect(() => {
    if (initialized && (geo.country || geo.city)) loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, citySlug, countrySlug]);

  const refreshSection = useCallback(async (section) => {
    setResults((prev) => ({ ...prev, [section.id]: { ...(prev[section.id] || {}), status: "loading" } }));
    const res = await fetchOne(section, true);
    setResults((prev) => ({ ...prev, [section.id]: res.error ? { status: "error", error: res.error } : { status: "ok", data: res.data, meta: res.meta } }));
  }, [fetchOne]);

  const ctx = { go, cityShort };

  if (!initialized || (loading && Object.keys(results).length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY, fontFamily: SANS }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: ACCENT.ink }} />
          <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".1em" }}>Building your insights…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: IVORY, fontFamily: SANS }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#FFFFFF", border: `1px solid ${RULE}` }} aria-label="Back">
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase" style={{ background: ACCENT.bg, color: ACCENT.ink, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".08em", fontWeight: 500 }}>
            <Lightbulb size={13} color={ACCENT.ink} strokeWidth={2} /> Insight
          </div>
          <button onClick={() => loadAll(true)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#FFFFFF", border: `1px solid ${RULE}` }} title="Refresh all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color={INK} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* TITLE */}
      <div className={`px-4 ${colWrap} mx-auto pb-2 text-center`}>
        <h1 className="italic leading-none" style={{ fontFamily: SERIF, fontSize: fs(38), color: ACCENT.ink }}>{cityName || "Your destination"}</h1>
        <p className="uppercase mt-2 font-semibold" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: "0.16em", color: INK3 }}>Traveler's Insight</p>
      </div>

      <div className={`${colWrap} mx-auto`}>
        {/* Location display */}
        <div className="px-4 mb-3">
          <div className="bg-white rounded-[22px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="shrink-0 rounded-2xl flex items-center justify-center" style={{ width: 42, height: 42, background: ACCENT.bg, fontSize: 20, lineHeight: 1 }}>{locationMode === "current" ? "📍" : "🧭"}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.1 }}>{cityName}</p>
                  {hasData(geo.country) && <p className="truncate uppercase mt-0.5" style={{ fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".06em", color: INK3 }}>{geo.country}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {locationMode === "navigate" && (
                  <button onClick={() => switchToCurrentLocation()} className="p-2 rounded-xl hover:brightness-95" style={{ background: ACCENT.bg }} title="Use Current Location">
                    <Navigation className="w-4 h-4" style={{ color: ACCENT.ink }} />
                  </button>
                )}
                <button onClick={() => setShowLocationPicker(true)} className="font-bold underline underline-offset-2 shrink-0" style={{ color: ACCENT.ink, fontSize: fs(13) }}>Change</button>
              </div>
            </div>
          </div>
        </div>

        {/* Honest disclaimer */}
        <div className="px-4 mb-3">
          <div className="rounded-[16px] px-3.5 py-2.5" style={{ background: NOTE.bg, border: `1px solid ${NOTE.border}` }}>
            <p style={{ color: NOTE.ink, fontSize: fs(11.5), lineHeight: 1.45 }}>
              💡 These insights are AI-estimated to help you plan — great for the big picture, but double-check specifics like opening hours, prices and schedules before you rely on them.
            </p>
          </div>
        </div>

        <div className="px-4 py-1 space-y-4 pb-28">
          {SECTIONS.map((section) => (
            <SectionCard key={section.id} section={section} state={results[section.id]} onRefresh={() => refreshSection(section)} ctx={ctx} />
          ))}

          <PlanAheadStrip go={go} />

          {/* Personalization teaser — sets up the paid planner without faking it */}
          <div className="rounded-[22px] p-4 text-center" style={{ background: ACCENT.bg, border: `1px solid ${ACCENT.soft}` }}>
            <p style={{ fontFamily: SERIF, fontSize: fs(20), color: ACCENT.ink }}>✨ Made for how you travel</p>
            <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.5, marginTop: 4 }}>
              Soon: plans tuned to your trip — foodie, hiking, kids, nightlife, or a niche you love — with a realistic day-by-day itinerary. Coming soon.
            </p>
          </div>
        </div>
      </div>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}
