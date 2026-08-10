// Find a Hotel — goal-based hotel finder. Collects WHERE (a location goal),
// WHEN (dates), and WHO (guests), then hands off to Stay22 — a multi-OTA
// meta-search that routes each user to the cheapest option (Booking / Expedia /
// Agoda / Hotels.com …). Best price = trust; we earn on whatever they book.
//
// Affiliate: the handoff goes through trackAffiliateClick (partner "stay22" →
// SubID rides in Stay22's `campaign` param, logged SubID→D1). AID is a
// placeholder until Stay22 approves us (see @/lib/stay22).
//
// By design (meta-search): amenity filters (breakfast/pool/gym/A/C/microwave/
// fridge) are chosen on the RESULTS page, not pre-set here — so we say so
// honestly. In-app amenity pre-filtering is the planned Agoda follow-up.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, MapPin, Minus, Plus } from "lucide-react";
import { useLocation } from "../components/location/LocationContext";
import { getLocationLabel } from "@/components/location/locationLabel";
import LocationModePicker from "@/components/location/LocationModePicker";
import { trackAffiliateClick } from "@/lib/affiliate";
import { buildStay22Url } from "@/lib/stay22";

const ED_SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const ED_INK = "#16110D";
const INK2 = "#6B7280";
const ACCENT = "#2563EB";      // hotels accent (blue)
const ACCENT_BG = "#EAF1FE";
const fs = (n) => `calc(${n}px*var(--fs))`;

// Location goals → how we tell Stay22 WHERE. "This area" uses the user's coords;
// the rest pass a text address Stay22 geocodes (e.g. "Tokyo airport").
const GOALS = [
  { key: "area",        emoji: "📍", label: "This area" },
  { key: "airport",     emoji: "✈️", label: "Near the airport", suffix: "airport" },
  { key: "centre",      emoji: "🏙️", label: "City centre",      suffix: "city centre" },
  { key: "sights",      emoji: "🗺️", label: "Near the sights",  suffix: "downtown" },
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
  const [goal, setGoal] = useState("area");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const lat = activeLocation?.coordinates?.latitude;
  const lng = activeLocation?.coordinates?.longitude;
  const city = activeLocation?.address?.city || activeLocation?.city || activeLocation?.placeName || activeLocation?.name || "";
  const country = activeLocation?.address?.country || activeLocation?.country || "";
  const locLabel = getLocationLabel(activeLocation);
  const hasLocation = (Number.isFinite(lat) && Number.isFinite(lng)) || !!city;
  const today = new Date().toISOString().slice(0, 10);

  const buildUrl = () => {
    const g = GOALS.find((x) => x.key === goal);
    // "This area" → coords when we have them; a goal chip → a text address Stay22
    // geocodes (falls back to coords if we somehow have no city name).
    const useAddress = g?.suffix && city;
    return buildStay22Url({
      ...(useAddress ? { address: `${city} ${g.suffix}` } : { lat, lng, address: (Number.isFinite(lat) && Number.isFinite(lng)) ? undefined : city }),
      checkin: checkin || undefined,
      checkout: checkout || undefined,
      adults,
      children,
    });
  };

  const proceed = async () => {
    setConfirm(false);
    const url = await trackAffiliateClick({
      partner: "stay22",
      targetUrl: buildUrl(),
      category: "hotel",
      destCity: city,
      destCountry: country,
    });
    if (url) window.open(url, "_blank");
  };

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
        {/* Where */}
        <button onClick={() => setLocPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] text-left mb-3" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
          <MapPin size={18} color={ACCENT} strokeWidth={2} className="flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Where</div>
            <div className="font-bold text-[calc(14.5px*var(--fs))] mt-0.5 truncate" style={{ color: ED_INK }}>{locLabel || "Set your location"}</div>
          </div>
          <span className="px-2.5 py-1.5 rounded-[10px] font-bold text-[calc(11.5px*var(--fs))] flex-none" style={{ background: ACCENT_BG, color: ACCENT }}>Change</span>
        </button>

        {/* Goal chips */}
        <div className="flex flex-wrap gap-2 mb-4">
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

        {/* When */}
        <div className="rounded-[16px] px-4 py-2 mb-3" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1">
              <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Check-in</div>
              <input type="date" value={checkin} min={today} onChange={(e) => { setCheckin(e.target.value); if (checkout && e.target.value && checkout <= e.target.value) setCheckout(""); }}
                className="w-full bg-transparent font-bold text-[calc(14.5px*var(--fs))] mt-0.5" style={{ color: ED_INK, fontFamily: "inherit" }} />
            </div>
            <div className="w-px h-9" style={{ background: "#F0E9DC" }} />
            <div className="flex-1">
              <div className="font-mono text-[calc(9.5px*var(--fs))] tracking-[0.14em] uppercase font-semibold" style={{ color: "#94A3B8" }}>Check-out</div>
              <input type="date" value={checkout} min={checkin || today} onChange={(e) => setCheckout(e.target.value)}
                className="w-full bg-transparent font-bold text-[calc(14.5px*var(--fs))] mt-0.5" style={{ color: ED_INK, fontFamily: "inherit" }} />
            </div>
          </div>
          <div className="text-[calc(11px*var(--fs))] pb-1.5" style={{ color: INK2 }}>Leave blank to browse flexible dates.</div>
        </div>

        {/* Who */}
        <div className="rounded-[16px] px-4 mb-4" style={{ background: "#FFFFFF", border: "1px solid #F0E9DC" }}>
          <Stepper label="Adults" value={adults} setValue={setAdults} min={1} />
          <div className="h-px" style={{ background: "#F5F0E8" }} />
          <Stepper label="Children" value={children} setValue={setChildren} min={0} />
        </div>

        {/* Find button */}
        <button onClick={() => hasLocation && setConfirm(true)} disabled={!hasLocation}
          className="w-full py-4 rounded-[16px] font-bold text-white text-[calc(16px*var(--fs))] flex items-center justify-center gap-2"
          style={{ background: ACCENT, opacity: hasLocation ? 1 : 0.5 }}>
          🏨 Find hotels <ExternalLink size={15} color="#fff" strokeWidth={2.4} />
        </button>
        {!hasLocation && <div className="text-center text-[calc(12px*var(--fs))] mt-2" style={{ color: INK2 }}>Set your location to search.</div>}

        {/* Honest amenity note — meta-search filters on the results page */}
        <div className="mt-4 rounded-[14px] px-4 py-3 text-[calc(12.5px*var(--fs))] leading-relaxed" style={{ background: ACCENT_BG, color: "#1E3A8A" }}>
          💡 On the results page you can filter for <b>breakfast, pool, gym, in-hotel restaurant, A/C, microwave &amp; fridge</b>, and set your price — across every site at once.
        </div>

        {/* Affiliate disclosure (FTC) */}
        <p className="text-[calc(10.5px*var(--fs))] leading-snug pt-3 px-1" style={{ color: "#9AA0A6" }}>
          Hotel results open on our partner Stay22, which compares Booking, Expedia, Agoda and more. We may earn a commission on some bookings — it never changes the price you pay.
        </p>
      </div>

      {/* Gentle "leaving to a partner" heads-up */}
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
