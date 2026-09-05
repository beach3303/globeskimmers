// EventsRow — "Events in {city}" (the Demand Radar's first surface).
//
// Real, DATED concerts / sports / theatre / comedy from Ticketmaster Discovery in a
// photo-led rail, with bookable Viator experiences in their own clearly-labelled
// sub-rail below ("EXPERIENCES NEARBY") — never mixed into the dated windows, so
// "Tonight (3)" is always three real dated events. One /events/search worker call
// (TM + Viator only, NO Google spend), cached 6h; the worker returns ~35 days of
// events so the time-window chips (Tonight · This weekend · This week · This month)
// are populated — travelers can PLAN, not just see tonight. Grouping is pure
// client-side off the one cached payload. A tap records an attributed click
// (affiliate_clicks → "My Trip") then opens the partner. Renders nothing until
// there's something on, so the home feed never shows an empty shell.
//
// Contract consumed ({ events, experiences }):
//   events[]:      { id, name, image, date (localDate), time (localTime, optional),
//                    endDate/endTime (optional — only when TM reports a real,
//                    non-approximate end; people with kids/work want "when it ends"),
//                    venue, city, category, fromPrice, currency, url }
//   experiences[]: { id, title, image, city (optional), fromPrice, currency, url }
//                  (code/thumbnail also accepted — pre-v4 field names)
//   destination:   Viator destination name the experiences were scoped to (optional)
// Time and per-experience city are read defensively — a card shows date-only when
// the payload carries no time (never an invented one), and falls back to the base
// city for experiences.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorProductLink, viatorSearchLink } from "@/lib/viator";
import { openPartner } from "@/lib/openPartner";
import { logDiscover } from "@/lib/logDiscover";
import { localISODate } from "@/lib/localDate";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymd = localISODate; // local YYYY-MM-DD
// The worker sends ISO currency codes (TM priceRanges, Viator pricing), never symbols,
// and TM minimums can be fractional — so "from $35", "from €35", "from CHF 35"; never "USD39.5".
const CUR_SYM = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
const fmtPrice = (n, cur) => { const c = String(cur || "").toUpperCase(); return `${c ? (CUR_SYM[c] || `${c} `) : "$"}${Math.round(n)}`; };
const parseDate = (s) => { try { return s ? new Date(s + "T00:00:00") : null; } catch { return null; } };
const fmtDate = (d) => { try { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); } catch { return ""; } };
// "19:30:00" / "19:30" → "7:30 PM". Anything unparseable → "" (date-only card —
// we never invent a time the payload doesn't carry).
const fmtTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  if (!m) return "";
  const h = Number(m[1]), min = m[2];
  if (h > 23) return "";
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${h < 12 ? "AM" : "PM"}`;
};

export default function EventsRow({ wide = false }) {
  const { getActiveLocation } = useLocation();
  const [payload, setPayload] = useState(null); // { events, exps, destName }
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState("weekend"); // default to a plan-ahead window, not "today"

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  // Local calendar day, re-checked every minute and on resume. The row stays mounted
  // overnight (Capacitor keeps the tree alive in the background), so without this the
  // window bounds below froze on yesterday and labelled stale cards "Tonight".
  // setState with the same string is a no-op, so this only re-renders at midnight.
  const [dayKey, setDayKey] = useState(() => localISODate());
  useEffect(() => {
    const check = () => setDayKey(localISODate());
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, []);

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
        const { data } = await callWorker(ROUTE.searchEvents, { city, latitude: lat, longitude: lng, cityName: city });
        if (cancelled) return;
        const seen = new Set();
        const keep = (name, url) => { const k = (name || "").toLowerCase(); if (!name || !url || seen.has(k)) return false; seen.add(k); return true; };
        const events = (data?.events || [])
          .filter((e) => keep(e.name, e.url))
          .map((e) => ({
            id: e.id, name: e.name, image: e.image,
            date: e.date, dateObj: parseDate(e.date),
            time: fmtTime(e.time || e.localTime), // defensive: worker may not send time yet → date-only
            // End time only when TM reported a real same-day end — never estimated.
            endTime: !e.endDate || e.endDate === e.date ? fmtTime(e.endTime) : "",
            venue: e.venue || "", city: e.city || "", cat: e.category,
            fromPrice: e.fromPrice, currency: e.currency, url: e.url,
          }));
        const exps = (data?.experiences || [])
          .filter((p) => keep(p.title, p.url))
          .map((p) => ({
            id: p.id || p.code || p.url, name: p.title, image: p.image || p.thumbnail,
            city: p.city || "", fromPrice: p.fromPrice, currency: p.currency, url: p.url,
          }));
        const destName = data?.destination || data?.destinationName || "";
        setPayload({ events, exps, destName });
        if (events.length || exps.length) logDiscover("event_view", { city, country, count: events.length + exps.length });
      } catch { if (!cancelled) setPayload(null); }
    })();
    return () => { cancelled = true; };
  }, [city, country, lat, lng, tick]);

  // Time-window bounds (local time); recomputed on a stay change and at local midnight.
  const W = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const todayKey = ymd(startToday);
    const tomorrow = new Date(startToday); tomorrow.setDate(startToday.getDate() + 1);
    const dow = startToday.getDay();
    const wkStart = new Date(startToday);
    if (dow >= 1 && dow <= 4) wkStart.setDate(startToday.getDate() + (5 - dow)); // Mon-Thu → coming Friday
    const wsd = wkStart.getDay();
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + (wsd === 5 ? 2 : wsd === 6 ? 1 : 0)); wkEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(startToday); weekEnd.setDate(startToday.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startToday, todayKey, tomorrowKey: ymd(tomorrow), wkStart, wkEnd, weekEnd, monthEnd };
  }, [tick, dayKey]);

  const inWindow = (d, w) => {
    if (w === "tonight") return ymd(d) === W.todayKey;
    if (w === "weekend") return d >= W.wkStart && d <= W.wkEnd;
    if (w === "week") return d >= W.startToday && d <= W.weekEnd;
    if (w === "month") return d >= W.startToday && d <= W.monthEnd;
    return true; // all
  };

  if (!payload) return null;
  // DATED events only — an undated TM row (flex/ongoing "admission" pass) or a
  // past localDate would make the window counts dishonest, so both are dropped.
  const events = payload.events.filter((x) => x.dateObj && x.dateObj >= W.startToday);
  const exps = payload.exps;
  // Self-hide: nothing dated AND nothing bookable → no row at all.
  if (!events.length && !exps.length) return null;

  const datedIn = (w) => events.filter((e) => inWindow(e.dateObj, w)).length;
  const hasTonight = events.some((e) => ymd(e.dateObj) === W.todayKey);
  const chips = [
    ...(hasTonight ? [{ id: "tonight", label: "Tonight" }] : []),
    { id: "weekend", label: "This weekend" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "all", label: "All upcoming" },
  ];

  // Selected-window events; fall forward to "all upcoming" when the window has no
  // dated events, so the dated rail is never blank while events exist.
  let windowEvents = events.filter((e) => inWindow(e.dateObj, sel));
  const emptyWindow = windowEvents.length === 0;
  if (emptyWindow && sel !== "all") windowEvents = events.slice(); // fall-forward to all upcoming
  // Soonest first, so each window LEADS with its relevant near-term events — without
  // this the first 12 shown overlapped across windows and the row looked static when
  // switching Tonight/Weekend/Week/Month.
  windowEvents.sort((x, y) => x.dateObj.getTime() - y.dateObj.getTime());
  const shownEvents = windowEvents.slice(0, 12);
  const shownExps = exps.slice(0, 8);

  const cityIn = city ? ` in ${city}` : "";
  const EMPTY = {
    tonight: `Nothing ticketed tonight${cityIn} — here's what's coming up`,
    weekend: `Nothing ticketed this weekend${cityIn} yet — here's what's coming up`,
    week: `Quiet week${cityIn} — here's what's coming up`,
    month: `No dated events this month${cityIn} yet — here's what's coming up`,
    all: "",
  };

  const relLabel = (d) => {
    const k = ymd(d);
    if (k === W.todayKey) return "Tonight";
    if (k === W.tomorrowKey) return "Tomorrow";
    const diff = Math.round((d - W.startToday) / 86400000);
    if (diff >= 2 && diff <= 6) return `This ${WD[d.getDay()]}`;
    return "";
  };

  const open = async (it, kind) => {
    logDiscover("event_tap", { name: it.name, category: it.cat || kind, window: sel, city, country, partner: kind === "event" ? "ticketmaster" : "viator" });
    let url = it.url;
    try {
      if (kind === "event") url = await trackAffiliateClick({ partner: "ticketmaster", targetUrl: it.url, category: "event", productName: it.name, destCity: city, destCountry: country });
      else url = await trackAffiliateClick({ partner: "viator", targetUrl: viatorProductLink(it.url) || viatorSearchLink(it.name), category: "event", productName: it.name, destCity: city, destCountry: country });
    } catch { /* fall back to raw url */ }
    openPartner(url || it.url);
  };

  const pickChip = (id) => { setSel(id); logDiscover("event_window", { window: id, city, country }); };

  // Photo-led sizing: the photo sells the night out, so cards are wide and the
  // image is a tall 4:3 — the text stays modest (the photo is what got bigger).
  const cardW = wide ? "w-[320px]" : "w-[300px]";
  const expW = wide ? "w-[264px]" : "w-[252px]";

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="mb-2 px-0.5">
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>{city ? `Events in ${city}` : "Events near you"}</div>
          <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>{city ? `Concerts, sports & shows — plan your ${city} days` : "Concerts, sports & shows to plan around"}</div>
        </div>

        {/* Dated-events rail: chips + cards. Skipped entirely (experiences-only
            surface below) when Ticketmaster has nothing dated. */}
        {events.length > 0 && (
          <>
            {/* Time-window chips — count and filter DATED events only */}
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {chips.map((c) => {
                const on = sel === c.id;
                const n = datedIn(c.id);
                return (
                  <button key={c.id} onClick={() => pickChip(c.id)} className="flex-none rounded-full px-3 py-1.5 text-[calc(12px*var(--fs))] font-semibold" style={on ? { background: TEAL, color: "#fff" } : { background: "#fff", color: INK, border: `1px solid ${EDGE}` }}>
                    {c.label}{c.id !== "all" && n > 0 ? ` (${n})` : ""}
                  </button>
                );
              })}
            </div>

            {emptyWindow && sel !== "all" && EMPTY[sel] && (
              <div className="text-[calc(11.5px*var(--fs))] mb-1.5 px-0.5" style={{ color: SUB }}>{EMPTY[sel]}</div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
              {shownEvents.map((it) => {
                const rel = relLabel(it.dateObj);
                const datePart = rel || fmtDate(it.dateObj);
                const timePart = it.time && it.endTime ? `${it.time} – ${it.endTime}` : it.time; // end shown only when TM reports one
                const dateLine = timePart ? `${datePart} · ${timePart}` : datePart; // date-only when the payload has no time
                const placeLine = [it.venue, it.city].filter(Boolean).join(" · ");
                return (
                  <button key={"event" + it.id} onClick={() => open(it, "event")} className={`flex-none ${cardW} rounded-2xl overflow-hidden text-left bg-white`} style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
                    <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
                      {it.image
                        ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-serif text-[34px]" style={{ color: "rgba(255,255,255,0.85)" }}>{(it.name || "?").charAt(0)}</div>}
                      {it.cat && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[calc(9.5px*var(--fs))] font-semibold" style={{ background: "rgba(255,255,255,0.92)", color: INK }}>
                          {it.cat}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[calc(11px*var(--fs))] font-semibold" style={{ fontFamily: MONO, color: rel ? TEAL : INK }}>{dateLine}</div>
                      <div className="font-serif leading-[1.14] text-[calc(16px*var(--fs))] mt-1" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.name}</div>
                      {placeLine && <div className="text-[calc(10.5px*var(--fs))] mt-1 truncate" style={{ fontFamily: MONO, color: SUB }}>{placeLine}</div>}
                      {Number.isFinite(it.fromPrice) && <div className="text-[calc(11px*var(--fs))] mt-1 font-semibold" style={{ fontFamily: MONO, color: INK }}>from {fmtPrice(it.fromPrice, it.currency)}</div>}
                      <div className="text-[calc(10px*var(--fs))] mt-1.5 font-semibold" style={{ color: SUB }}>See tickets · Ticketmaster</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Experiences sub-rail — bookable-any-day Viator products, honestly
            separated from the dated events (they are NOT tonight's events). */}
        {shownExps.length > 0 && (
          <div className={events.length ? "mt-3" : ""}>
            <div className="flex items-baseline gap-2 mb-1.5 px-0.5">
              <span className="text-[calc(10.5px*var(--fs))] font-semibold tracking-[0.08em]" style={{ fontFamily: MONO, color: SUB }}>EXPERIENCES NEARBY</span>
              {(payload.destName || city) && <span className="font-serif text-[calc(14px*var(--fs))]" style={{ color: INK }}>{payload.destName || city}</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
              {shownExps.map((it) => (
                <button key={"exp" + it.id} onClick={() => open(it, "exp")} className={`flex-none ${expW} rounded-2xl overflow-hidden text-left bg-white`} style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
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
        )}
      </div>
    </div>
  );
}
