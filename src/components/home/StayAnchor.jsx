// StayAnchor — the accommodation "home base" for the trip.
//
// Where you're staying (hotel / Airbnb / friends & family / your own place /
// other) is the hub that "what's nearby", day-trips & escapes, and "stamps near
// your stay" all radiate from. Setting it re-centers every finder via the
// existing switchToNavigateMode, so no finder needs changing. Subtle + opt-in
// (a one-line bar, never a pop-up) per the consent-first / honest-UX stance.
import React, { useState } from "react";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { STAY_TYPES, setPrimaryStay, getPrimaryStay } from "@/lib/savedLocations";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";

export default function StayAnchor() {
  const { getCurrentLocation, switchToNavigateMode } = useLocation();
  const [stay, setStay] = useState(() => getPrimaryStay());
  const [sheet, setSheet] = useState(false);
  const [picker, setPicker] = useState(false);
  const [type, setType] = useState(() => getPrimaryStay()?.stayType || "hotel");
  const [busy, setBusy] = useState(false);

  const recenter = (entry) => {
    try { switchToNavigateMode(entry); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent("gs:stay-changed", { detail: entry })); } catch { /* ignore */ }
  };

  const commit = (loc) => {
    if (!loc) return;
    const entry = setPrimaryStay(loc, type);
    setStay(entry);
    recenter(entry);
    setSheet(false); setPicker(false);
  };

  const useCurrent = async () => {
    if (busy) return; setBusy(true);
    try { commit(await getCurrentLocation()); } catch { /* denied/unavailable */ }
    setBusy(false);
  };

  const label = stay?.nickname || stay?.placeName || stay?.address?.city || "your stay";
  const typeEmoji = (STAY_TYPES.find((t) => t.id === stay?.stayType) || {}).emoji || "🧭";

  return (
    <div className="px-4 pb-2">
      <div className="max-w-md mx-auto">
        {stay ? (
          <div className="flex items-center gap-2">
            <button onClick={() => recenter(stay)} className="flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
              <span style={{ fontSize: 18 }}>{typeEmoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-wide" style={{ color: SUB }}>Around your stay</span>
                <span className="block text-[calc(14.5px*var(--fs))] font-semibold truncate" style={{ color: INK }}>{label}</span>
              </span>
            </button>
            <button onClick={() => { setType(stay.stayType || "hotel"); setSheet(true); }} className="text-[calc(12.5px*var(--fs))] font-semibold px-2 py-2" style={{ color: TEAL }}>Change</button>
          </div>
        ) : (
          <button onClick={() => setSheet(true)} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "#fff", border: `1px dashed ${TEAL}` }}>
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} />
            <span className="text-[calc(14px*var(--fs))] font-semibold" style={{ color: INK }}>Where are you staying?</span>
            <span className="ml-auto text-[calc(11.5px*var(--fs))] text-right" style={{ color: SUB }}>tailors nearby &amp; escapes ›</span>
          </button>
        )}
      </div>

      {/* Set-stay sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[9996] flex items-end justify-center" onClick={() => setSheet(false)} style={{ background: "rgba(0,0,0,0.45)" }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-t-3xl p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-serif text-[calc(21px*var(--fs))]" style={{ color: INK }}>Where are you staying?</h3>
              <button onClick={() => setSheet(false)} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F2EEE6" }}><X className="w-4 h-4" style={{ color: INK }} /></button>
            </div>
            <p className="text-[calc(12.5px*var(--fs))] mb-3" style={{ color: SUB }}>We'll tailor what's nearby, day trips &amp; stamps around your base.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {STAY_TYPES.map((t) => (
                <button key={t.id} onClick={() => setType(t.id)} className="px-3 py-1.5 rounded-full text-[calc(13px*var(--fs))] font-semibold flex items-center gap-1" style={type === t.id ? { background: TEAL, color: "#fff" } : { background: "#F2EEE6", color: INK }}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
            <button onClick={useCurrent} disabled={busy} className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 mb-2.5 disabled:opacity-60" style={{ background: TEAL }}>
              <Navigation className="w-4 h-4" /> {busy ? "Getting location…" : "Use my current location"}
            </button>
            <button onClick={() => setPicker(true)} className="w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: "#fff", color: INK, border: `1.5px solid ${EDGE}` }}>
              <Search className="w-4 h-4" /> Enter address or search
            </button>
          </div>
        </div>
      )}

      {/* Address search reuses the location picker; onPicked returns the place
          without switching so we set it as the stay ourselves. */}
      <LocationModePicker isOpen={picker} onClose={() => setPicker(false)} onPicked={commit} />
    </div>
  );
}
