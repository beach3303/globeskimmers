// Weather: Bluebird (the new look, Weather.dc.html; the founder's pick of 2026-10-13, plan S13).
//
// The Bluebird plate (WEATHER · LISBON · UPDATED 2:10 PM, "The week ahead", the place and
// °F/°C), turning midnight after the place's own sunset. The white now card: the day arc,
// the temperature, high and low, the condition and four stats. One white sheet for the
// week: 64px rows with each day's range on the week's scale, each opening its hours
// (today's from now, with sunrise and sunset, the moon after dark) and its rain, wind, UV
// and daylight. Then What to pack, worked out from the forecast.
//
// Honest by design: every number is printed (the range bars never stand alone, the UV
// chip says its level in words). The place's clock (its IANA zone) decides night, the arc
// and "now", so a traveler browsing another city sees that city's day. "Updated" appears
// only when the forecast says when it was fetched. The pack line says only what the
// numbers back, and is left out when they back nothing. No emoji, no gradients on white.
import React, { useState, useEffect, useMemo, useId } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { getLocationLabel } from "@/components/location/locationLabel";
import LocationModePicker from "@/components/location/LocationModePicker";
import DistanceUnitToggle from "@/components/location/DistanceUnitToggle";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldSkeleton } from "@/components/finder/FinderCard";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import DayArc, { clockMinutes, minutesInZone, dayPhase } from "@/components/finder/motifs/DayArc";
import { useFontScale } from "@/components/a11y/FontScaleContext";
import {
  ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudOff, CloudRain, CloudRainWind,
  CloudSnow, CloudSun, Droplet, Droplets, Luggage, MapPin, Moon, Sun, Sunrise, Sunset, Wind,
} from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.weather;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const SCALES = [{ value: "fahrenheit", label: "°F" }, { value: "celsius", label: "°C" }];
// The range bar's track (Weather.dc.html L99), and its fill: cool to sunny.
const TRACK = 56;
const RANGE = `linear-gradient(90deg, ${W.range[0]} 0%, ${W.range[1]} 42%, ${W.range[2]} 64%, ${W.range[3]} 100%)`;

/** @type {(o: Record<string, any>) => import('react').CSSProperties} */
const mono = (o) => ({ fontFamily: MONO, letterSpacing: ".1em", textTransform: "uppercase", ...o });

// ─── WORDS AND ICONS ────────────────────────────────────────────────────────
// The worker's condition words (Open-Meteo's WMO codes) as lucide icons; clear and partly
// cloudy skies turn to the moon after dark.
function conditionIcon(condition, night) {
  const c = String(condition || "").toLowerCase();
  if (c.includes("thunder")) return CloudLightning;
  if (c.includes("snow")) return CloudSnow;
  if (c.includes("violent") || c.includes("heavy rain")) return CloudRainWind;
  if (c.includes("drizzle")) return CloudDrizzle;
  if (c.includes("rain") || c.includes("shower")) return CloudRain;
  if (c.includes("fog")) return CloudFog;
  if (c.includes("overcast")) return Cloud;
  if (c.includes("partly")) return night ? CloudMoon : CloudSun;
  if (c.includes("clear") || c.includes("sunny")) return night ? Moon : Sun;
  return Cloud;
}

// The UV index's level in words (WHO): the chip reads it, the number stays beside it.
const uvLevel = (uv) => (uv >= 11 ? "Extreme" : uv >= 8 ? "Very high" : uv >= 6 ? "High" : null);

const pick = (isC, c, f) => (isC ? c : f);
const deg = (n) => (Number.isFinite(n) ? `${n}°` : "—");

// The place's calendar date, '2026-10-14', or null.
function dateInZone(tz, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return null;
  }
}

// Night for an hour of a day: its middle falls before that day's sunrise or after its
// sunset. Unknown sun times say nothing.
function hourIsNight(day, hour) {
  const rise = clockMinutes(day?.sunrise);
  const set = clockMinutes(day?.sunset);
  if (rise == null || set == null) return false;
  const mid = hour * 60 + 30;
  return mid < rise || mid > set;
}

// The hour columns: from (day, hour), spilling into the next days, `count` at most, with
// sunrise and sunset placed between the hours they fall in. Events before `afterMin` on
// the first day (already past) are left out.
function hourColumns(days, dayIdx, startHour, count, afterMin = -1) {
  const cols = [];
  for (let d = dayIdx; d < days.length && cols.filter((c) => c.kind === "hour").length < count; d++) {
    const day = days[d];
    const events = [
      { kind: "sunrise", min: clockMinutes(day.sunrise), text: day.sunrise },
      { kind: "sunset", min: clockMinutes(day.sunset), text: day.sunset },
    ].filter((e) => e.min != null && !(d === dayIdx && e.min < afterMin));
    for (const h of day.hourly || []) {
      if (d === dayIdx && h.hour < startHour) continue;
      if (cols.filter((c) => c.kind === "hour").length >= count) break;
      cols.push({ kind: "hour", key: `${d}-${h.hour}`, h, night: hourIsNight(day, h.hour) });
      events.filter((e) => Math.floor(e.min / 60) === h.hour).forEach((e) => cols.push({ ...e, key: `${d}-${e.kind}` }));
    }
  }
  return cols;
}

// What to pack, from the week's numbers only: the coldest night or evening, rain or snow
// (named by day), heat and strong sun. Two things at most; nothing when nothing applies.
function packLine(days, isC) {
  if (!days.length) return null;
  const name = (d) => (d.is_today ? "today" : d.day_of_week);
  const things = [];
  const lows = days.filter((d) => Number.isFinite(d.low_celsius));
  const cold = lows.length ? lows.reduce((a, b) => (b.low_celsius < a.low_celsius ? b : a)) : null;
  if (cold) {
    const t = deg(pick(isC, cold.low_celsius, cold.low_fahrenheit));
    if (cold.low_celsius <= 4) things.push(`a warm coat for ${t} nights`);
    else if (cold.low_celsius <= 12) things.push(`a warm layer for ${t} nights`);
    else if (cold.low_celsius <= 17) things.push(`a light layer for ${t} evenings`);
  }
  const snowy = days.find((d) => /snow/i.test(d.condition));
  if (snowy) things.push(`waterproof boots for ${name(snowy)}’s ${snowy.condition.toLowerCase()}`);
  const wet = days.filter((d) => /rain|drizzle|shower|thunder/i.test(d.condition) || d.precipitation_probability >= 50);
  if (wet.length === 1) {
    const d = wet[0];
    things.push(/rain|drizzle|shower|thunder/i.test(d.condition)
      ? `an umbrella for ${name(d)}’s ${d.condition.toLowerCase()}`
      : `an umbrella: a ${d.precipitation_probability}% chance of rain ${d.is_today ? "today" : `on ${d.day_of_week}`}`);
  } else if (wet.length === 2) {
    things.push(`an umbrella for rain ${wet[0].is_today ? "today" : `on ${wet[0].day_of_week}`} and ${name(wet[1])}`);
  } else if (wet.length > 2) {
    things.push(`an umbrella: rain is likely on ${wet.length} days`);
  }
  const hot = days.reduce((a, b) => (Number.isFinite(b.high_celsius) && (!a || b.high_celsius > a.high_celsius) ? b : a), null);
  if (hot && hot.high_celsius >= 30) things.push(`light clothes and water for ${deg(pick(isC, hot.high_celsius, hot.high_fahrenheit))} afternoons`);
  const sunny = days.find((d) => d.uv_index >= 8);
  if (sunny) things.push(`sunscreen: the UV index reaches ${sunny.uv_index}`);
  if (!things.length) return null;
  const two = things.slice(0, 2);
  const text = two.length === 2 ? `${two[0]}, and ${two[1]}` : two[0];
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

// ─── NOW CARD (Weather.dc.html L44-83) ──────────────────────────────────────
function Stat({ label, children, first }) {
  return (
    <div style={{ minWidth: 0, padding: first ? "0 8px 0 0" : "0 8px", borderLeft: first ? 0 : `1px solid ${W.line}` }}>
      <p style={mono({ margin: 0, fontSize: fs(9.5), lineHeight: 1.37, color: NEUTRAL.ink3 })}>{label}</p>
      <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2, fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.18, color: NEUTRAL.ink }}>{children}</div>
    </div>
  );
}

function UvChip({ uv }) {
  const level = uvLevel(uv);
  if (!level) return null;
  return (
    <span style={mono({ padding: "2px 6px", borderRadius: 6, background: W.lemonWash, color: W.sunDeep, fontSize: fs(9.5), fontWeight: 500, letterSpacing: ".08em", lineHeight: 1.37 })}>
      {level}
    </span>
  );
}

function NowCard({ current, today, tz, nowMin, night, isC, stacked }) {
  const temp = pick(isC, current.temperature_celsius, current.temperature_fahrenheit);
  const feels = pick(isC, current.feels_like_celsius, current.feels_like_fahrenheit);
  const Icon = conditionIcon(current.condition, night);
  let placeDate = "";
  try {
    placeDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(new Date());
  } catch { /* an unknown zone: no date */ }
  const stats = [
    { label: "Humidity", value: `${current.humidity}%` },
    { label: "Wind", value: isC ? `${current.wind_speed_kmh} km/h` : `${current.wind_speed_mph} mph` },
    { label: "Rain", value: today ? `${today.precipitation_probability}%` : "—" },
    { label: "UV index", value: current.uv_index, chip: true },
  ];
  return (
    <section aria-label="Now" style={{ boxSizing: "border-box", padding: 20, borderRadius: 22, background: NEUTRAL.white, border: `1px solid ${W.line}` }}>
      {today ? <DayArc world={W} sunrise={today.sunrise} sunset={today.sunset} now={nowMin} night={night} /> : null}
      <p style={mono({ margin: today ? "16px 0 0" : 0, fontSize: fs(10), letterSpacing: ".14em", lineHeight: 1.4, color: NEUTRAL.ink3 })}>
        Now{placeDate ? ` · ${placeDate}` : ""}
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <p style={{ margin: 0, display: "flex", alignItems: "flex-start", color: W.ink }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(72), lineHeight: 0.92, letterSpacing: "-0.02em" }}>{deg(temp)}</span>
          <span style={{ margin: "8px 0 0 3px", fontFamily: MONO, fontSize: fs(14), lineHeight: 1.3, color: NEUTRAL.ink3 }}>{isC ? "C" : "F"}</span>
        </p>
        {today ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingBottom: 4 }}>
            {[["H", "High", pick(isC, today.high_celsius, today.high_fahrenheit), NEUTRAL.ink], ["L", "Low", pick(isC, today.low_celsius, today.low_fahrenheit), NEUTRAL.ink3]].map(([k, word, v, color]) => (
              <p key={k} style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                <abbr title={word} style={mono({ textDecoration: "none", fontSize: fs(10), letterSpacing: ".14em", color: NEUTRAL.ink3 })}>{k}</abbr>
                <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(24), lineHeight: 1, color }}>{deg(v)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: 8, fontSize: fs(15), lineHeight: 1.33, color: NEUTRAL.ink2 }}>
        <Icon size={20} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>{current.condition} · Feels like {deg(feels)}</span>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: stacked ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", rowGap: 14, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${W.line}` }}>
        {stats.map((s, i) => (
          <Stat key={s.label} label={s.label} first={stacked ? i % 2 === 0 : i === 0}>
            <span>{s.value}</span>
            {s.chip ? <UvChip uv={s.value} /> : null}
          </Stat>
        ))}
      </div>
    </section>
  );
}

// ─── THE WEEK (Weather.dc.html L85-222) ─────────────────────────────────────
function RangeBar({ low, high, min, max }) {
  const span = max - min;
  const left = span > 0 ? ((low - min) / span) * TRACK : 0;
  const width = span > 0 ? Math.max(4, ((high - low) / span) * TRACK) : TRACK;
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "block", flexShrink: 0, width: TRACK, height: 4, margin: "0 8px", borderRadius: 999, background: W.wash }}>
      <span style={{ position: "absolute", top: 0, left, width: Math.min(width, TRACK - left), height: 4, borderRadius: 999, backgroundImage: RANGE, backgroundSize: `${TRACK}px 4px`, backgroundPosition: `${-left}px 0` }} />
    </span>
  );
}

function HourColumn({ col, isC, now }) {
  /** @type {import('react').CSSProperties} */
  // position: relative keeps each column's screen-reader words inside the scroller (an
  // unpositioned column lets them reach out and widen the page).
  const box = { position: "relative", flexShrink: 0, width: fs(48), boxSizing: "border-box", padding: "8px 0 10px", borderRadius: 12, textAlign: "center", background: now ? W.wash : "transparent" };
  const label = mono({ margin: 0, fontSize: fs(9.5), letterSpacing: ".06em", lineHeight: 1.37, textTransform: "none" });
  if (col.kind !== "hour") {
    const Icon = col.kind === "sunset" ? Sunset : Sunrise;
    const word = col.kind === "sunset" ? "Sunset" : "Sunrise";
    return (
      <li style={box}>
        <p style={{ ...label, color: NEUTRAL.ink3 }}>{col.text}</p>
        <span aria-hidden="true" style={{ display: "flex", justifyContent: "center", height: 18, marginTop: 6 }}><Icon size={18} color={W.iconInk} strokeWidth={2} /></span>
        <p style={{ margin: "6px 0 0", fontSize: fs(11), lineHeight: 1.8, color: NEUTRAL.ink3 }}>{word}</p>
      </li>
    );
  }
  const { h } = col;
  const Icon = conditionIcon(h.condition, col.night);
  const temp = now ? col.nowTemp : pick(isC, h.temperature_celsius, h.temperature_fahrenheit);
  const rain = h.precipitation_probability;
  return (
    <li style={box}>
      <p style={{ ...label, fontWeight: now ? 500 : 400, color: now ? W.ink : NEUTRAL.ink3 }}>{now ? "NOW" : h.time}</p>
      <span aria-hidden="true" style={{ display: "flex", justifyContent: "center", height: 18, marginTop: 6 }}><Icon size={18} color={W.iconInk} strokeWidth={2} /></span>
      <span className="sr-only">{h.condition}</span>
      <p style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: fs(18), lineHeight: 1.12, color: NEUTRAL.ink }}>{deg(temp)}</p>
      {rain >= 20 ? (
        <p style={{ margin: "4px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, ...mono({ fontSize: fs(9.5), letterSpacing: ".04em", color: W.ink }) }}>
          <Droplet size={10} color={W.iconInk} strokeWidth={2.4} aria-hidden="true" />{rain}%
          <span className="sr-only"> chance of rain</span>
        </p>
      ) : null}
    </li>
  );
}

function DayDetails({ day, isC, stacked }) {
  const items = [
    { icon: Droplets, label: "Rain", value: `${day.precipitation_probability}%` },
    { icon: Wind, label: "Wind", value: isC ? `${day.wind_speed_kmh} km/h` : `${day.wind_speed_mph} mph` },
    { icon: Sun, label: "UV index", value: `${day.uv_index}${uvLevel(day.uv_index) ? ` · ${uvLevel(day.uv_index)}` : ""}` },
    { icon: Sunrise, label: "Daylight", value: day.sunrise && day.sunset ? `${day.sunrise}–${day.sunset}` : "Not listed", wide: true },
  ];
  return (
    <dl style={{ display: "grid", gridTemplateColumns: stacked ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: "10px 16px", margin: "12px 14px 0 0" }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, gridColumn: it.wide ? "1 / -1" : undefined }}>
          <it.icon size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
          <dt style={mono({ fontSize: fs(9.5), color: NEUTRAL.ink3, lineHeight: 1.37 })}>{it.label}</dt>
          <dd style={{ margin: 0, minWidth: 0, fontSize: fs(13.5), lineHeight: 1.35, color: NEUTRAL.ink }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DayRow({ day, idx, first, open, onToggle, isC, week, cols, nowTemp, stacked }) {
  const panelId = useId();
  const low = pick(isC, day.low_celsius, day.low_fahrenheit);
  const high = pick(isC, day.high_celsius, day.high_fahrenheit);
  const Icon = conditionIcon(day.condition, false);
  const title = day.is_today ? "Today" : day.day_of_week;
  return (
    <div style={{ borderTop: first ? 0 : `1px solid ${W.line}` }}>
      <button type="button" onClick={() => onToggle(idx)} aria-expanded={open} aria-controls={panelId}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: 4, width: "100%", minHeight: 64, boxSizing: "border-box", padding: "10px 14px", background: "transparent", border: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
        <span style={{ flex: "1 1 120px", minWidth: 0 }}>
          <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 6 }}>
            <span style={{ fontFamily: SERIF, fontSize: fs(20), lineHeight: 1.2, color: NEUTRAL.ink }}>{title}</span>
            <span style={mono({ fontSize: fs(10), letterSpacing: ".08em", color: NEUTRAL.ink3 })}>{day.date}</span>
          </span>
          <span style={{ display: "block", marginTop: 2, fontSize: fs(12.5), lineHeight: 1.3, color: NEUTRAL.ink3 }}>{day.condition}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", marginLeft: "auto", flexShrink: 0 }}>
          <Icon size={22} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, margin: "0 8px" }} />
          <span style={{ flexShrink: 0, minWidth: fs(28), textAlign: "right", fontFamily: SERIF, fontSize: fs(18), lineHeight: 1.2, color: NEUTRAL.ink3 }}>
            <span className="sr-only">Low </span>{deg(low)}
          </span>
          <RangeBar low={low} high={high} min={week.min} max={week.max} />
          <span style={{ flexShrink: 0, minWidth: fs(32), fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.1, color: NEUTRAL.ink }}>
            <span className="sr-only">High </span>{deg(high)}
          </span>
          <ChevronDown size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true"
            style={{ flexShrink: 0, marginLeft: 8, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </span>
      </button>
      <div id={panelId} hidden={!open} style={{ padding: "2px 0 14px 14px" }}>
        {open ? (
          <>
            <ol role="list" aria-label={`Hours, ${title}`} tabIndex={0} className="gs-noscroll"
              style={{ position: "relative", display: "flex", gap: 6, margin: 0, padding: "0 14px 0 0", listStyle: "none", overflowX: "auto", overscrollBehaviorX: "contain" }}>
              {cols.map((c, i) => <HourColumn key={c.key} col={i === 0 && nowTemp != null ? { ...c, nowTemp } : c} isC={isC} now={i === 0 && nowTemp != null} />)}
            </ol>
            <DayDetails day={day} isC={isC} stacked={stacked} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function WeatherPage() {
  const isTablet = useIsTablet();
  const { scale: textScale } = useFontScale();
  const stacked = textScale > 1.2;
  const { profile } = useAuth();
  const { activeLocation, initialized } = useLocation();
  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // °F or °C: this device's choice (gs_temp_scale), else the profile's, else °F.
  const [savedScale, setSavedScale] = useState(() => {
    try {
      const s = localStorage.getItem("gs_temp_scale");
      return s === "celsius" || s === "fahrenheit" ? s : null;
    } catch {
      return null;
    }
  });
  const displayScale = savedScale || (profile?.temp_unit === "C" ? "celsius" : "fahrenheit");
  const chooseScale = (s) => { setSavedScale(s); try { localStorage.setItem("gs_temp_scale", s); } catch { /* ignore */ } };
  const isC = displayScale === "celsius";

  // ── Fetch ──
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [force, setForce] = useState(false);
  useEffect(() => {
    if (!initialized) return undefined;
    if (!lat || !lng) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    callWorker(ROUTE.getWeatherForecast, { latitude: lat, longitude: lng, forceRefresh: force })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data || data.error || !data.current) throw new Error(err || data?.error || "No forecast");
        setWx(data);
      })
      .catch(() => { if (!cancelled) { setWx(null); setError("Check your connection and try again."); } })
      .finally(() => { if (!cancelled) { setLoading(false); setForce(false); } });
    return () => { cancelled = true; };
  }, [lat, lng, initialized, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { setForce(true); setTick((t) => t + 1); };

  // The place's clock moves on: the arc, night and "now" follow it each minute.
  const [, setMinute] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinute((m) => m + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Today at the place ──
  const tz = wx?.timezone || null;
  const days = wx?.forecast || [];
  const placeDate = tz ? dateInZone(tz) : null;
  const found = placeDate ? days.findIndex((d) => d.iso_date === placeDate) : -1;
  const todayIdx = found >= 0 ? found : Math.max(0, days.findIndex((d) => d.is_today));
  const week = days.slice(todayIdx);
  const today = week[0] || null;
  const nowMin = tz ? minutesInZone(tz) : null;
  const phase = today ? dayPhase({ sunrise: today.sunrise, sunset: today.sunset, now: nowMin }) : null;
  const night = !!(phase && phase.night);

  const [openIdx, setOpenIdx] = useState(0);
  const toggle = (i) => setOpenIdx((o) => (o === i ? -1 : i));

  // The week's scale for the range bars, in the scale shown.
  const range = useMemo(() => {
    const lows = week.map((d) => pick(isC, d.low_celsius, d.low_fahrenheit)).filter(Number.isFinite);
    const highs = week.map((d) => pick(isC, d.high_celsius, d.high_fahrenheit)).filter(Number.isFinite);
    return lows.length && highs.length ? { min: Math.min(...lows), max: Math.max(...highs) } : { min: 0, max: 0 };
  }, [week, isC]);

  const nowHour = nowMin != null ? Math.floor(nowMin / 60) : 0;
  const colsFor = (i) => (i === 0
    ? hourColumns(week, 0, nowHour, 24, nowMin ?? -1)
    : hourColumns(week, i, 0, 24));
  const nowTemp = wx?.current ? pick(isC, wx.current.temperature_celsius, wx.current.temperature_fahrenheit) : null;
  const pack = packLine(week, isC);

  const updated = wx?.updated_at ? new Date(wx.updated_at) : null;
  const updatedText = updated && !Number.isNaN(updated.getTime()) ? `Updated ${updated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : null;
  const city = activeLocation?.address?.city || activeLocation?.placeName || null;

  const column = finderColumnStyle(isTablet);

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>
      {/* ── THE PLATE (Weather.dc.html L26-42): Bluebird by day, midnight after the place's
          sunset; °F/°C in place of the distance unit. ── */}
      <FinderHeader
        world="weather"
        night={night}
        count={null}
        kickerExtras={[city, updatedText]}
        onRefresh={refresh}
        refreshing={loading}
        refreshTitle="Refresh the weather"
        location={{ label: getLocationLabel(activeLocation), onChange: () => setShowLocationPicker(true) }}
        unitControl={<DistanceUnitToggle variant="plate" world="weather" night={night} options={SCALES} label="Temperature unit" unit={displayScale} setUnit={chooseScale} />}
      />

      <div style={{ ...column, paddingTop: 16, paddingBottom: 24 }}>
        {!initialized || (loading && !wx) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <WorldSkeleton world="weather" variant="entry" label="Getting the forecast" />
            <WorldSkeleton world="weather" variant="row" count={5} style={{ padding: "0 14px", borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${W.line}` }} />
          </div>
        ) : !lat || !lng ? (
          <FinderEmptyState world="weather" icon={MapPin} title="Choose a location" hint="Use your current position or pick a city to see its week."
            actionLabel="Choose a location" onAction={() => setShowLocationPicker(true)} />
        ) : error || !wx ? (
          <FinderEmptyState world="weather" icon={CloudOff} role="alert" title="Couldn’t load the weather" hint={error || "Check your connection and try again."}
            actionLabel="Try again" onAction={refresh} secondaryLabel="Search somewhere else" onSecondary={() => setShowLocationPicker(true)} />
        ) : (
          <div style={isTablet
            ? { display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", gap: 24, alignItems: "start" }
            : { display: "flex", flexDirection: "column" }}>
            <div>
              <NowCard current={wx.current} today={today} tz={tz} nowMin={nowMin} night={night} isC={isC} stacked={stacked} />
              {pack && isTablet ? <PackLine text={pack} /> : null}
            </div>
            <div style={{ marginTop: isTablet ? 0 : 24 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 2px" }}>
                <h2 style={mono({ margin: 0, fontSize: fs(10.5), fontWeight: 500, letterSpacing: ".14em", lineHeight: 1.34, color: NEUTRAL.ink3 })}>
                  {week.length}-day forecast
                </h2>
                <p style={mono({ margin: 0, fontSize: fs(10), fontWeight: 500, letterSpacing: ".12em", lineHeight: 1.4, color: W.ink })}>Tap for hourly</p>
              </div>
              {week.length ? (
                <section aria-label="Forecast" style={{ marginTop: 10, overflow: "hidden", borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${W.line}` }}>
                  {week.map((d, i) => (
                    <DayRow key={d.iso_date || i} day={d} idx={i} first={i === 0} open={openIdx === i} onToggle={toggle} isC={isC}
                      week={range} cols={openIdx === i ? colsFor(i) : []} nowTemp={i === 0 ? nowTemp : null} stacked={stacked} />
                  ))}
                </section>
              ) : (
                <FinderEmptyState world="weather" icon={Cloud} title="No forecast for this place" hint="The forecast service sent no days. Try again in a moment."
                  actionLabel="Try again" onAction={refresh} style={{ marginTop: 10 }} />
              )}
              {pack && !isTablet ? <PackLine text={pack} /> : null}
            </div>
          </div>
        )}
      </div>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}

// What to pack (Weather.dc.html L224-229): a sky-wash disc with a suitcase, the caption in
// Bluebird and the sentence in ink.
function PackLine({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 20, padding: "0 2px" }}>
      <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: W.wash }}>
        <Luggage size={18} color={W.iconInk} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={mono({ margin: 0, fontSize: fs(9.5), fontWeight: 500, letterSpacing: ".14em", lineHeight: 1.37, color: W.ink })}>What to pack</p>
        <p style={{ margin: "3px 0 0", fontSize: fs(13.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>{text}</p>
      </div>
    </div>
  );
}
