// EventsRow — "Events in {city}" (the Demand Radar's first surface).
//
// Real concerts / sports / theatre / comedy from Ticketmaster Discovery + bookable
// Viator experiences, for the user's base city. One /events/search worker call
// (TM + Viator only, NO Google spend), cached 6h; the worker now returns ~35 days
// of events so the time-window chips (Tonight · This weekend · This week · This
// month) are populated — travelers can PLAN, not just see tonight. Grouping is
// pure client-side off the one cached payload. Viator experiences are date-flexible
// → shown in every window as tail filler. A tap records an attributed click
// (affiliate_clicks → "My Trip") then opens the partner. Renders nothing until
// there's something on, so the home feed never shows an empty shell.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorProductLink, viatorSearchLink } from "@/lib/viator";
import { logDiscover } from "@/lib/logDiscover";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const CAT_EMOJI = { Music: "🎵", Sports: "🏟️", "Arts & Theatre": "🎭", "Arts & Theater": "🎭", Film: "🎬", Comedy: "🎤", Miscellaneous: "🎪" };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDate = (s) => { try { return s ? new Date(s + "T00:00:00") : null; } catch { return null; } };
const fmtDate = (d) => { try { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); } catch { return ""; } };

export default function EventsRow({ wide = false }) {
  const { getActiveLocation } = useLocation();
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState("weekend"); // default to a plan-ahead window, not "today"

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("gs:stay-changed", on);
    return () => window.removeEventListener("gs:stay-changed", on);
  }, []);

  const base = getPrimaryStay() || getActiveLocation?.() || null;
  const a = base?.address || {};
  const city = a.city || base?.city || base?.placeName || "";
  const country = a.country || base?.country || "";
  const lat = base?.coordinates?.latitude ?? base?.latitude ?? base?.lat;
  const lng = base?.coordinates?.longitude ?? base?.longitude ?? base?.lng;

  useEffect(() => {
    let cancelled = false;
    if (!city && !Number.isFinite(lat)) { setItems([]); return; }
    (async () => {
      try {
        const { data } = await callWorker(ROUTE.searchEvents, { city, latitude: lat, longitude: lng, cityName: city });
        if (cancelled) return;
        const out = [];
        (data?.events || []).forEach((e) => out.push({ type: "event", id: e.id, name: e.name, image: e.image, date: e.date, dateObj: parseDate(e.date), venue: e.venue, cat: e.category, fromPrice: e.fromPrice, currency: e.currency, url: e.url }));
        (data?.experiences || []).forEach((p) => out.push({ type: "exp", id: p.code || p.url, name: p.title, image: p.thumbnail, date: null, dateObj: null, venue: "", cat: null, fromPrice: p.fromPrice, currency: p.currency, url: p.url }));
        const seen = new Set();
        const merged = out.filter((x) => { const k = (x.name || "").toLowerCase(); if (!x.name || !x.url || seen.has(k)) return false; seen.add(k); return true; });
        setItems(merged);
        if (merged.length) logDiscover("event_view", { city, country, count: merged.length });
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [city, country, lat, lng, tick]);

  // Time-window bounds (local time), computed once per render.
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
  }, [tick]);

  const inWindow = (d, w) => {
    if (!d) return true; // experiences are date-flexible → in every window
    if (w === "tonight") return ymd(d) === W.todayKey;
    if (w === "weekend") return d >= W.wkStart && d <= W.wkEnd;
    if (w === "week") return d >= W.startToday && d <= W.weekEnd;
    if (w === "month") return d >= W.startToday && d <= W.monthEnd;
    return true; // all
  };

  // Drop past-dated events — TM returns flex/ongoing "admission" passes with a
  // stale localDate that would otherwise show a misleading past-date card.
  const events = items.filter((x) => x.type === "event" && (!x.dateObj || x.dateObj >= W.startToday));
  const exps = items.filter((x) => x.type === "exp");
  if (!items.length) return null;

  const datedIn = (w) => events.filter((e) => e.dateObj && inWindow(e.dateObj, w)).length;
  const hasTonight = events.some((e) => e.dateObj && ymd(e.dateObj) === W.todayKey);
  const chips = [
    ...(hasTonight ? [{ id: "tonight", label: "Tonight" }] : []),
    { id: "weekend", label: "This weekend" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "all", label: "All upcoming" },
  ];

  // Selected-window events; fall forward to "all upcoming" when the window has no
  // dated events, so the row is never blank. Experiences (flexible) always tail.
  let windowEvents = events.filter((e) => inWindow(e.dateObj, sel));
  const emptyWindow = windowEvents.length === 0;
  if (emptyWindow && sel !== "all") windowEvents = events.slice(); // fall-forward to all upcoming
  // Soonest first, so each window LEADS with its relevant near-term events — without
  // this the first 12 shown overlapped across windows and the row looked static when
  // switching Tonight/Weekend/Week/Month.
  windowEvents.sort((a, b) => (a.dateObj?.getTime() || 8.64e15) - (b.dateObj?.getTime() || 8.64e15));
  const shown = [...windowEvents, ...exps].slice(0, 12);

  const cityIn = city ? ` in ${city}` : "";
  const EMPTY = {
    tonight: `Nothing ticketed tonight${cityIn} — here's what's coming up`,
    weekend: `Nothing ticketed this weekend${cityIn} yet — here's what's coming up`,
    week: `Quiet week${cityIn} — here's what's coming up`,
    month: `No dated events this month${cityIn} yet — experiences you can book any day`,
    all: "",
  };

  const relLabel = (d) => {
    if (!d) return "";
    const k = ymd(d);
    if (k === W.todayKey) return "Tonight";
    if (k === W.tomorrowKey) return "Tomorrow";
    const diff = Math.round((d - W.startToday) / 86400000);
    if (diff >= 2 && diff <= 6) return `This ${WD[d.getDay()]}`;
    return "";
  };

  const open = async (it) => {
    logDiscover("event_tap", { name: it.name, category: it.cat || it.type, window: sel, city, country, partner: it.type === "event" ? "ticketmaster" : "viator" });
    let url = it.url;
    try {
      if (it.type === "event") url = await trackAffiliateClick({ partner: "ticketmaster", targetUrl: it.url, category: "event", productName: it.name, destCity: city, destCountry: country });
      else url = await trackAffiliateClick({ partner: "viator", targetUrl: viatorProductLink(it.url) || viatorSearchLink(it.name), category: "event", productName: it.name, destCity: city, destCountry: country });
    } catch { /* fall back to raw url */ }
    try { window.open(url || it.url, "_blank"); } catch { /* ignore */ }
  };

  const pickChip = (id) => { setSel(id); logDiscover("event_window", { window: id, city, country }); };

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="mb-2 px-0.5">
          <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>{city ? `Events in ${city}` : "Events near you"}</div>
          <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>{city ? `Concerts, sports, shows & experiences — plan your ${city} days` : "Concerts, sports, shows & experiences to plan around"}</div>
        </div>

        {/* Time-window chips */}
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
          {shown.map((it) => {
            const rel = relLabel(it.dateObj);
            const dateLine = it.type === "exp" ? "Flexible dates" : (rel || fmtDate(it.dateObj));
            return (
              <button key={it.type + it.id} onClick={() => open(it)} className={`flex-none ${wide ? "w-[200px]" : "w-[172px]"} rounded-2xl overflow-hidden text-left bg-white`} style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
                <div className="relative w-full" style={{ aspectRatio: "16 / 10", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
                  {it.image ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[30px]">{it.type === "exp" ? "✦" : (CAT_EMOJI[it.cat] || "🎫")}</div>}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[calc(9px*var(--fs))] font-semibold" style={{ background: "rgba(255,255,255,0.92)", color: INK }}>
                    {it.type === "exp" ? "✦ Experience" : `${CAT_EMOJI[it.cat] || ""} ${it.cat || "Event"}`.trim()}
                  </div>
                </div>
                <div className="p-2.5">
                  {dateLine && <div className="text-[calc(11px*var(--fs))] font-bold" style={{ color: rel && it.type !== "exp" ? TEAL : INK }}>{dateLine}</div>}
                  <div className="font-serif leading-[1.12] text-[calc(15px*var(--fs))] mt-0.5" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.name}</div>
                  {it.venue && <div className="text-[calc(11px*var(--fs))] mt-0.5" style={{ color: SUB }}>{it.venue}</div>}
                  {Number.isFinite(it.fromPrice) && <div className="text-[calc(11px*var(--fs))] mt-0.5 font-semibold" style={{ color: TEAL }}>from {it.currency || "$"}{it.fromPrice}</div>}
                  <div className="text-[calc(10px*var(--fs))] mt-1.5 font-semibold" style={{ color: SUB }}>{it.type === "exp" ? "View & book · Viator" : "See tickets · Ticketmaster"}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
