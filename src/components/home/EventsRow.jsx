// EventsRow — "What's on 🎫" (the Demand Radar's first surface).
//
// Real concerts / sports (incl. playoffs) / theatre / comedy from Ticketmaster
// Discovery + bookable Viator experiences, for the user's base city. Cheap: one
// /events/search worker call (TM + Viator only, NO Google spend), cached 6h.
// A tap records an attributed click (affiliate_clicks) — which is also how it
// lands in "My Trip" later — then opens the partner. Viator earns today; TM
// revenue switches on when the Impact affiliate is approved. Renders nothing
// until there's something on (or the TM key is set), so it never shows empty.
import { useEffect, useState } from "react";
import { useLocation } from "@/components/location/LocationContext";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getPrimaryStay } from "@/lib/savedLocations";
import { trackAffiliateClick } from "@/lib/affiliate";
import { viatorProductLink, viatorSearchLink } from "@/lib/viator";
import { logDiscover } from "@/lib/logDiscover";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const CAT_EMOJI = { Music: "🎵", Sports: "🏟️", "Arts & Theatre": "🎭", "Arts & Theater": "🎭", Film: "🎬", Comedy: "🎤", Miscellaneous: "🎪" };
const fmtDate = (d) => { if (!d) return ""; try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return d; } };

export default function EventsRow({ onAction, wide = false }) {
  const { getActiveLocation } = useLocation();
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);

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
        (data?.events || []).forEach((e) => out.push({ type: "event", id: e.id, name: e.name, image: e.image, meta: [fmtDate(e.date), e.venue].filter(Boolean).join(" · "), cat: e.category, fromPrice: e.fromPrice, currency: e.currency, url: e.url }));
        (data?.experiences || []).forEach((p) => out.push({ type: "exp", id: p.code || p.url, name: p.title, image: p.thumbnail, meta: "Experience", fromPrice: p.fromPrice, currency: p.currency, url: p.url }));
        const seen = new Set();
        const merged = out.filter((x) => { const k = (x.name || "").toLowerCase(); if (!x.name || !x.url || seen.has(k)) return false; seen.add(k); return true; });
        setItems(merged.slice(0, 14));
        if (merged.length) logDiscover("event_view", { city, country, count: merged.length });
      } catch { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [city, country, lat, lng, tick]);

  if (!items.length) return null;

  const open = async (it) => {
    logDiscover("event_tap", { name: it.name, category: it.cat || it.type, city, country, partner: it.type === "event" ? "ticketmaster" : "viator" });
    let url = it.url;
    try {
      if (it.type === "event") url = await trackAffiliateClick({ partner: "ticketmaster", targetUrl: it.url, category: "event", productName: it.name, destCity: city, destCountry: country });
      else url = await trackAffiliateClick({ partner: "viator", targetUrl: viatorProductLink(it.url) || viatorSearchLink(it.name), category: "event", productName: it.name, destCity: city, destCountry: country });
    } catch { /* fall back to raw url */ }
    try { window.open(url || it.url, "_blank"); } catch { /* ignore */ }
  };

  return (
    <div className={wide ? "pb-3" : "px-4 pb-3"}>
      <div className={wide ? "" : "max-w-md mx-auto"}>
        <div className="flex items-baseline justify-between mb-2 px-0.5 gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[calc(19px*var(--fs))] leading-[1.1]" style={{ color: INK }}>What's on 🎫</div>
            <div className="text-[calc(12px*var(--fs))] mt-0.5" style={{ color: SUB }}>{city ? `Concerts, games & shows in ${city}` : "Concerts, games & shows near you"}</div>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "none" }}>
          {items.map((it) => (
            <button key={it.type + it.id} onClick={() => open(it)} className={`flex-none ${wide ? "w-[200px]" : "w-[172px]"} rounded-2xl overflow-hidden text-left bg-white`} style={{ border: `1px solid ${EDGE}`, boxShadow: "0 8px 20px -16px rgba(22,17,13,.4)" }}>
              <div className="relative w-full" style={{ aspectRatio: "16 / 10", background: "linear-gradient(135deg,#E7C7A0,#C98A2E)" }}>
                {it.image ? <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[30px]">{CAT_EMOJI[it.cat] || "🎫"}</div>}
                {it.cat && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[calc(9px*var(--fs))] font-semibold" style={{ background: "rgba(255,255,255,0.92)", color: INK }}>{CAT_EMOJI[it.cat] || ""} {it.cat}</div>}
              </div>
              <div className="p-2.5">
                <div className="font-serif leading-[1.12] text-[calc(15px*var(--fs))]" style={{ color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.name}</div>
                {it.meta && <div className="text-[calc(11px*var(--fs))] mt-1" style={{ color: SUB }}>{it.meta}</div>}
                {Number.isFinite(it.fromPrice) && <div className="text-[calc(11px*var(--fs))] mt-0.5 font-semibold" style={{ color: TEAL }}>from {it.currency || "$"}{it.fromPrice}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
