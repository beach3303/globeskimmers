// Find a Hotel — goal-based hotel finder. Collects WHERE (current location OR
// any city), a location GOAL, WHEN (dates), and WHO (guests), then hands off to
// Stay22 — a multi-OTA meta-search (Booking / Expedia / Agoda / Hotels.com …)
// that routes each user to the cheapest option. Best price = trust; we earn on
// whatever they book.
//
// Goals:
//   • This area      → the destination's own coordinates
//   • Near the airport → real picker: the nearest airports to the destination
//     (from our 7.9k IATA dataset) → search around the chosen airport's coords
//   • City centre    → "{city} city centre" (Stay22 geocodes)
//   • Near the sights → the destination's TOP attraction (owned attractions DB)
//     → search around that landmark's coords
//
// Affiliate: handoff via trackAffiliateClick (partner "stay22" → SubID in
// Stay22's `campaign` param, logged D1). Amenity filters (breakfast/pool/gym…)
// are chosen on the results page (meta-search) — the UI says so; native amenity
// pre-filtering is the planned Agoda-API follow-up.
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, MapPin, Minus, Plus, Search, X, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";
import { useLocation } from "../components/location/LocationContext";
import { getLocationLabel } from "@/components/location/locationLabel";
import LocationModePicker from "@/components/location/LocationModePicker";
import { trackAffiliateClick } from "@/lib/affiliate";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { buildStay22Url } from "@/lib/stay22";
import { nearestAirports } from "@/lib/airports";

const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_INK = "#16110D";
const INK2 = "#6B7280";
const ACCENT = "#2563EB";
const ACCENT_BG = "#EAF1FE";
const fs = (n) => `calc(${n}px*var(--fs))`;

const GOALS = [
  { key: "area",    emoji: "📍", label: "This area" },
  { key: "airport", emoji: "✈️", label: "Near an airport" },
  { key: "centre",  emoji: "🏙️", label: "City centre" },
  { key: "sights",  emoji: "🗺️", label: "Near the sights" },
];

function Stepper({ label, value, setValue, min = 0, max = 16 }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[calc(14.5px*var(--fs))]" style={{ color: ED_INK }}>{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => setValue(Math.max(min, value - 1))} aria-label={`Fewer ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F1EADF", opacity: value <= min ? 0.5 : 1 }} disabled={value <= min}>
          <Minus size={16} color={ED_INK} strokeWidth={2.4} />
        </button>
        <span className="w-6 text-center font-bold text-[calc(15px*var(--fs))]" style={{ color: ED_INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <button onClick={() => setValue(Math.min(max, value + 1))} aria-label={`More ${label}`}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: ACCENT_BG }} disabled={value >= max}>
          <Plus size={16} color={ACCENT} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export default function FindAHotel() {
  const navigate = useNavigate();
  const { activeLocation } = useLocation();
  const [locPicker, setLocPicker] = useState(false);

  // Destination: current location OR another city (trip planning).
  const [destMode, setDestMode] = useState("here"); // "here" | "other"
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState([]);
  const [citySearching, setCitySearching] = useState(false);
  const [pickedCity, setPickedCity] = useState(null); // a searchLocation result

  const [goal, setGoal] = useState("area");
  const [airports, setAirports] = useState([]);
  const [airportsBusy, setAirportsBusy] = useState(false);
  const [airport, setAirport] = useState(null); // chosen airport {iata,city,lat,lng,km}
  const [apOpen, setApOpen] = useState(true);    // airport list expanded/collapsed
  const [sight, setSight] = useState(null);      // top attraction {name,lat,lng}
  const [sightBusy, setSightBusy] = useState(false);

  const [range, setRange] = useState();        // { from: Date, to: Date } | undefined
  const [dateOpen, setDateOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [confirm, setConfirm] = useState(false);

  // Effective destination.
  const here = {
    lat: activeLocation?.coordinates?.latitude,
    lng: activeLocation?.coordinates?.longitude,
    city: activeLocation?.address?.city || activeLocation?.city || activeLocation?.placeName || activeLocation?.name || "",
    country: activeLocation?.address?.country || activeLocation?.country || "",
    label: getLocationLabel(activeLocation),
  };
  const picked = pickedCity ? {
    lat: pickedCity.coordinates?.latitude,
    lng: pickedCity.coordinates?.longitude,
    city: pickedCity.city || pickedCity.placeName || "",
    country: pickedCity.address?.country || "",
    label: pickedCity.placeName || pickedCity.city || pickedCity.address?.formatted || "",
  } : null;
  const dest = destMode === "other" ? (picked || { lat: undefined, lng: undefined, city: "", country: "", label: "" }) : here;
  const hasCoords = Number.isFinite(dest.lat) && Number.isFinite(dest.lng);
  const hasDest = hasCoords || !!dest.city;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  // Derived YYYY-MM-DD strings for the Stay22 link (empty = flexible dates).
  const checkin = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const checkout = range?.to ? format(range.to, "yyyy-MM-dd") : "";

  // Resolve airport list / top sight when the goal or destination changes.
  useEffect(() => {
    let cancelled = false;
    if (goal === "airport" && hasCoords) {
      setAirportsBusy(true); setAirport(null); setApOpen(true);
      nearestAirports(dest.lat, dest.lng, 6, 130)
        .then((list) => { if (!cancelled) { setAirports(list); setAirportsBusy(false); } })
        .catch(() => { if (!cancelled) { setAirports([]); setAirportsBusy(false); } });
    }
    if (goal === "sights" && hasCoords) {
      setSightBusy(true); setSight(null);
      callWorker("attractions/nearby", { latitude: dest.lat, longitude: dest.lng, radiusKm: 40, limit: 5, cityName: dest.city, countryName: dest.country })
        .then(({ data }) => { if (!cancelled) { const a = (data?.attractions || [])[0]; setSight(a ? { name: a.name, lat: a.lat, lng: a.lng } : null); setSightBusy(false); } })
        .catch(() => { if (!cancelled) { setSight(null); setSightBusy(false); } });
    }
    return () => { cancelled = true; };
  }, [goal, dest.lat, dest.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchCities = async () => {
    const q = cityQuery.trim(); if (!q) return;
    setCitySearching(true); setCityResults([]);
    try {
      const { data } = await callWorker(ROUTE.searchLocation, { query: q });
      setCityResults(Array.isArray(data?.results) ? data.results : []);
    } catch { setCityResults([]); }
    setCitySearching(false);
  };
  const pickCity = (r) => { setPickedCity(r); setCityResults([]); setCityQuery(""); };

  const buildUrl = () => {
    const base = { checkin: checkin || undefined, checkout: checkout || undefined, adults, children };
    if (goal === "airport" && airport) return buildStay22Url({ ...base, lat: airport.lat, lng: airport.lng });
    if (goal === "centre" && dest.city) return buildStay22Url({ ...base, address: `${dest.city} city centre` });
    if (goal === "sights" && sight) return buildStay22Url({ ...base, lat: sight.lat, lng: sight.lng });
    if (hasCoords) return buildStay22Url({ ...base, lat: dest.lat, lng: dest.lng });
    return buildStay22Url({ ...base, address: dest.city });
  };

  // Find is blocked until we have a destination, and (for the airport goal) an
  // airport is chosen.
  const blocked = !hasDest || (goal === "airport" && !airport);

  const proceed = async () => {
    setConfirm(false);
    const url = await trackAffiliateClick({ partner: "stay22", targetUrl: buildUrl(), category: "hotel", destCity: dest.city, destCountry: dest.country });
    if (url) window.open(url, "_blank");
  };

  const mi = (km) => `${Math.round(km * 0.621371)} mi`;

  return (
    <div className="min-h-screen" style={{ background: "#FFFCF7" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#F1EADF" }}>
          <ArrowLeft size={18} color={ED_INK} strokeWidth={2.2} />
        </button>
        <div>
          <h1 style={{ fontFamily: ED_SERIF, fontSize: fs(26), color: ED_INK, lineHeight: 1.05 }}>Find a hotel</h1>
          <div className="text-[calc(12.5px*var(--fs))]" style={{ color: INK2 }}>Best price across Booking, Expedia, Agoda &amp; more</div>
        </div>
      </div>

      <div className="px-4 pt-2 pb-10" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Destination mode toggle */}
        <div className="flex gap-2 mb-2">
          {[{ k: "here", t: "📍 Where I am" }, { k: "other", t: "🔎 Another city" }].map((m) => {
            const active = destMode === m.k;
            return (
              <button key={m.k} onClick={() => setDestMode(m.k)}
                className="flex-1 py-2.5 rounded-[12px] font-semibold text-[calc(13.5px*var(--fs))]"
                style={{ background: active ? ACCENT : "#FFFFFF", color: active ? "#fff" : ED_INK, border: `1.5px solid ${active ? ACCENT : "#F0E9DC"}` }}>
                {m.t}
              </button>
            );
          })}
        </div>

        {/* WHERE — current location */}
        {destMode === "here" && (
          <button onClick={() => setLocPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left mb-3" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
            <MapPin size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Where</div>
              <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: ED_INK }}>{here.label || "Set your location"}</div>
            </div>
            <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: ACCENT_BG, color: ACCENT }}>Change</span>
          </button>
        )}

        {/* WHERE — another city */}
        {destMode === "other" && (
          <div className="mb-3">
            {picked ? (
              <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px]" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
                <MapPin size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Destination</div>
                  <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: ED_INK }}>{picked.label}</div>
                </div>
                <button onClick={() => setPickedCity(null)} aria-label="Clear" className="w-8 h-8 rounded-full flex items-center justify-center flex-none" style={{ background: "#F1EADF" }}>
                  <X size={15} color={ED_INK} strokeWidth={2.2} />
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={(e) => { e.preventDefault(); searchCities(); }} className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 rounded-[12px]" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
                    <Search size={16} color="#94A3B8" strokeWidth={2} />
                    <input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="Search a city or destination" autoCapitalize="words"
                      className="flex-1 py-3 bg-transparent text-[calc(14px*var(--fs))]" style={{ color: ED_INK, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <button type="submit" disabled={!cityQuery.trim() || citySearching} className="px-4 rounded-[12px] font-bold text-white text-[calc(13px*var(--fs))]" style={{ background: ACCENT, opacity: (!cityQuery.trim() || citySearching) ? 0.6 : 1 }}>
                    {citySearching ? "…" : "Search"}
                  </button>
                </form>
                {cityResults.length > 0 && (
                  <div className="mt-2 rounded-[14px] overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
                    {cityResults.slice(0, 6).map((r, i) => (
                      <button key={r.placeId || i} onClick={() => pickCity(r)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ borderTop: i ? "1px solid #F5F0E8" : "none" }}>
                        <MapPin size={15} color={ACCENT} strokeWidth={2} className="flex-none" />
                        <div className="min-w-0">
                          <div className="font-semibold text-[calc(14px*var(--fs))] truncate" style={{ color: ED_INK }}>{r.placeName || r.city}</div>
                          {r.address?.formatted && <div className="text-[calc(11.5px*var(--fs))] truncate" style={{ color: INK2 }}>{r.address.formatted}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Goal chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {GOALS.map((g) => {
            const active = goal === g.key;
            return (
              <button key={g.key} onClick={() => setGoal(g.key)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold text-[calc(13px*var(--fs))]"
                style={{ background: active ? ACCENT : "#FFFFFF", color: active ? "#fff" : ED_INK, border: `1.5px solid ${active ? ACCENT : "#F0E9DC"}` }}>
                <span>{g.emoji}</span>{g.label}
              </button>
            );
          })}
        </div>

        {/* Airport picker */}
        {goal === "airport" && (
          <div className="rounded-[16px] mb-3" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
            {/* Collapsible header — shows the chosen airport when collapsed */}
            <button onClick={() => setApOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
              <span className="flex-1 min-w-0">
                <span className="block font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Airport</span>
                <span className="block font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: ED_INK }}>
                  {airport ? `${airport.iata} · ${airport.city}` : "Pick an airport"}
                </span>
              </span>
              {airport && <span className="text-[calc(12px*var(--fs))] flex-none" style={{ color: INK2 }}>{mi(airport.km)}</span>}
              <span className="flex-none text-[calc(13px*var(--fs))]" style={{ color: INK2 }}>{apOpen ? "▲" : "▼"}</span>
            </button>
            {apOpen && (
              <div className="px-2 pb-2">
                {!hasCoords ? (
                  <div className="px-2 py-2 text-[calc(13px*var(--fs))]" style={{ color: INK2 }}>Choose a destination first.</div>
                ) : airportsBusy ? (
                  <div className="px-2 py-2 text-[calc(13px*var(--fs))]" style={{ color: INK2 }}>Finding nearby airports…</div>
                ) : airports.length === 0 ? (
                  <div className="px-2 py-2 text-[calc(13px*var(--fs))]" style={{ color: INK2 }}>No airports found near {dest.city || "here"}. Try another goal.</div>
                ) : airports.map((ap) => {
                  const on = airport?.iata === ap.iata;
                  return (
                    <button key={ap.iata} onClick={() => { setAirport(ap); setApOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left"
                      style={{ background: on ? ACCENT_BG : "transparent", border: `1.5px solid ${on ? ACCENT : "transparent"}`, marginTop: 2 }}>
                      <span className="font-bold text-[calc(13px*var(--fs))] px-2 py-1 rounded-[8px] flex-none" style={{ background: on ? ACCENT : "#F1EADF", color: on ? "#fff" : ED_INK, minWidth: 44, textAlign: "center" }}>{ap.iata}</span>
                      <span className="flex-1 min-w-0 truncate text-[calc(14px*var(--fs))]" style={{ color: ED_INK }}>{ap.city}</span>
                      <span className="text-[calc(12px*var(--fs))] flex-none" style={{ color: INK2 }}>{mi(ap.km)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Near the sights — resolved top attraction */}
        {goal === "sights" && hasCoords && (
          <div className="rounded-[14px] px-4 py-3 mb-3 text-[calc(13px*var(--fs))]" style={{ background: ACCENT_BG, color: "#1E3A8A" }}>
            {sightBusy ? "Finding the top sight…" : sight ? <>Searching hotels near <b>{sight.name}</b>.</> : "We'll search the central sightseeing area."}
          </div>
        )}

        {/* When — one calendar popup, tap check-in then check-out */}
        <button onClick={() => setDateOpen(true)} className="w-full rounded-[16px] px-4 py-3.5 mb-3 text-left flex items-center gap-3" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
          <CalendarIcon size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Dates</div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: ED_INK }}>
              {range?.from
                ? (range?.to ? `${format(range.from, "EEE, MMM d")} → ${format(range.to, "EEE, MMM d")}` : `${format(range.from, "EEE, MMM d")} → …`)
                : "Any dates (flexible)"}
            </div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: ACCENT_BG, color: ACCENT }}>{range?.from ? "Edit" : "Pick"}</span>
        </button>

        {/* Who */}
        <div className="rounded-[16px] px-4 mb-4" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
          <Stepper label="Adults" value={adults} setValue={setAdults} min={1} />
          <div className="h-px" style={{ background: "#F5F0E8" }} />
          <Stepper label="Children" value={children} setValue={setChildren} min={0} />
        </div>

        {/* Find */}
        <button onClick={() => !blocked && setConfirm(true)} disabled={blocked}
          className="w-full py-4 rounded-[16px] font-bold text-white text-[calc(16px*var(--fs))] flex items-center justify-center gap-2"
          style={{ background: ACCENT, opacity: blocked ? 0.5 : 1 }}>
          🏨 Find hotels <ExternalLink size={15} color="#fff" strokeWidth={2.4} />
        </button>
        {blocked && (
          <div className="text-center text-[calc(12px*var(--fs))] mt-2" style={{ color: INK2 }}>
            {!hasDest ? "Choose a destination to search." : "Pick an airport above."}
          </div>
        )}

        {/* Honest amenity note */}
        <div className="mt-4 rounded-[14px] px-4 py-3 text-[calc(12.5px*var(--fs))] leading-relaxed" style={{ background: ACCENT_BG, color: "#1E3A8A" }}>
          💡 On the results page you can filter for <b>breakfast, pool, gym, in-hotel restaurant, A/C, microwave &amp; fridge</b>, and set your price — across every site at once.
        </div>

        <p className="text-[calc(10.5px*var(--fs))] leading-snug pt-3 px-1" style={{ color: "#9AA0A6" }}>
          Hotel results open on our partner Stay22, which compares Booking, Expedia, Agoda and more. We may earn a commission on some bookings — it never changes the price you pay.
        </p>
      </div>

      {/* Date-range calendar — one popup, tap check-in then check-out */}
      {dateOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setDateOpen(false)}>
          <div className="w-full sm:max-w-sm bg-white rounded-t-[22px] sm:rounded-[22px] p-4 sm:m-4" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="font-bold text-[calc(15px*var(--fs))]" style={{ color: ED_INK }}>Select dates</div>
              <button onClick={() => setRange(undefined)} className="text-[calc(13px*var(--fs))] font-semibold" style={{ color: ACCENT }}>Clear</button>
            </div>
            <div className="text-[calc(12px*var(--fs))] mb-1 px-1" style={{ color: INK2 }}>Tap your check-in, then your check-out.</div>
            <div style={{ "--rdp-accent-color": ACCENT, "--rdp-background-color": ACCENT_BG, display: "flex", justifyContent: "center" }}>
              <DayPicker mode="range" selected={range} onSelect={setRange} numberOfMonths={1} disabled={{ before: todayStart }} />
            </div>
            <button onClick={() => setDateOpen(false)} className="w-full mt-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT }}>Done</button>
          </div>
        </div>
      )}

      {/* Leaving-to-partner heads-up */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setConfirm(false)}>
          <div className="w-full sm:max-w-sm bg-white rounded-t-[22px] sm:rounded-[22px] p-5 sm:m-4" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.25)" }}>
            <div className="text-[calc(15px*var(--fs))] leading-snug" style={{ color: ED_INK }}>
              Heads up — we'll pop you over to <span className="font-bold">Stay22</span> to compare live hotel prices across every site. Your price won't change 🏨
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirm(false)} className="flex-1 py-3 rounded-[14px] font-semibold text-[calc(14px*var(--fs))]" style={{ background: "#F1EADF", color: ED_INK }}>Not now</button>
              <button onClick={proceed} className="flex-1 py-3 rounded-[14px] font-bold text-white text-[calc(14px*var(--fs))]" style={{ background: ACCENT }}>Compare prices</button>
            </div>
          </div>
        </div>
      )}

      <LocationModePicker isOpen={locPicker} onClose={() => setLocPicker(false)} />
    </div>
  );
}
