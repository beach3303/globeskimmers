// StayAnchor — set your trip BASE (hotel / rental / friends / your place) so every
// finder, day-trip and passport stamp re-centers on your neighborhood instead of
// raw GPS. Setting it re-centers all finders via switchToNavigateMode.
//
// Redesigned 2026-08-21 for TRUST (research-backed — Booking/Airbnb/NN-g/Apple):
//  - INLINE expanding card, never a blocking dark-overlay modal (that read as
//    "stalkery/cornering").
//  - Leads with the concrete VALUE + an honest "on this device" privacy line
//    (persistence is localStorage — never overclaim cloud/secure storage).
//  - Every stay-type tap ADVANCES the flow (no more "picking Hotel does nothing").
//  - Ends on a real confirmation showing what changed.
//  - Consent-first: GPS only on an explicit "Use my current location" tap.
//  - Dropped the creepy "Room in an Airbnb"; neutral dwelling labels only.
import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Search, X, ChevronLeft, Check, Lock } from "lucide-react";
import { useLocation } from "@/components/location/LocationContext";
import LocationModePicker from "@/components/location/LocationModePicker";
import { STAY_TYPES, setPrimaryStay, getPrimaryStay, clearPrimaryStay, stayTypeMeta } from "@/lib/savedLocations";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const SNOOZE_KEY = "gs_stay_prompt_snooze";
const todayStr = () => { try { return new Date().toISOString().slice(0, 10); } catch { return "x"; } };

export default function StayAnchor() {
  const { getCurrentLocation, switchToNavigateMode } = useLocation();
  const [stay, setStay] = useState(() => getPrimaryStay());
  const [step, setStep] = useState(null); // null (collapsed) | 'type' | 'place' | 'done'
  const [type, setType] = useState(() => getPrimaryStay()?.stayType || "hotel");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [snoozed, setSnoozed] = useState(() => { try { return localStorage.getItem(SNOOZE_KEY) === todayStr(); } catch { return false; } });

  // Confirmation auto-collapses back to the compact bar.
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => setStep(null), 2600);
    return () => clearTimeout(t);
  }, [step]);

  const recenter = (entry) => {
    try { switchToNavigateMode(entry); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent("gs:stay-changed", { detail: entry })); } catch { /* ignore */ }
  };

  const commit = (loc) => {
    if (!loc) return;
    const entry = setPrimaryStay(loc, type);
    setStay(entry);
    recenter(entry);
    setPicker(false);
    setStep("done");
  };

  const useCurrent = async () => {
    if (busy) return; setBusy(true);
    try { commit(await getCurrentLocation()); } catch { /* denied/unavailable */ }
    setBusy(false);
  };

  const dismiss = () => { try { localStorage.setItem(SNOOZE_KEY, todayStr()); } catch { /* ignore */ } setSnoozed(true); };
  const stopAnchoring = () => { try { clearPrimaryStay(); } catch { /* ignore */ } setStay(null); setStep(null); };

  const meta = stayTypeMeta(stay?.stayType);
  const label = stay?.nickname || stay?.placeName || stay?.address?.city || "your stay";
  const typeLabel = (STAY_TYPES.find((t) => t.id === type) || STAY_TYPES[0]).label;

  // Hidden: no stay set, collapsed, and dismissed for today.
  if (!stay && step === null && snoozed) return null;

  return (
    <div className="px-4 pb-2">
      <div className="max-w-md mx-auto">

        {/* COMPACT — set-state bar (a stay is set) */}
        {stay && step === null && (
          <div className="flex items-center gap-2">
            <button onClick={() => recenter(stay)} className="flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left" style={{ background: "#fff", border: `1px solid ${EDGE}` }}>
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[calc(10.5px*var(--fs))] font-semibold uppercase tracking-wide" style={{ color: SUB }}>Around your stay</span>
                <span className="block text-[calc(14.5px*var(--fs))] font-semibold truncate" style={{ color: INK }}>{label}</span>
              </span>
            </button>
            <button onClick={() => { setType(stay.stayType || "hotel"); setStep("type"); }} className="text-[calc(12.5px*var(--fs))] font-semibold px-2 py-2" style={{ color: TEAL }}>Change</button>
          </div>
        )}

        {/* COMPACT — prompt (no stay yet) */}
        {!stay && step === null && !snoozed && (
          <div className="flex items-center gap-1 rounded-xl px-3 py-2.5" style={{ background: "#fff", border: `1px dashed ${TEAL}` }}>
            <button onClick={() => setStep("type")} className="flex items-center gap-2 flex-1 min-w-0 text-left">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: TEAL }} />
              <span className="min-w-0">
                <span className="block text-[calc(14px*var(--fs))] font-semibold" style={{ color: INK }}>Where are you staying?</span>
                <span className="block text-[calc(11.5px*var(--fs))]" style={{ color: SUB }}>Re-center the app on your neighborhood ›</span>
              </span>
            </button>
            <button onClick={dismiss} aria-label="Not now" className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ color: SUB }}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* EXPANDED — inline stepper (no overlay) */}
        {step && step !== "done" && (
          <div className="rounded-2xl p-4 bg-white" style={{ border: `1px solid ${EDGE}`, boxShadow: "0 10px 30px -18px rgba(22,17,13,.35)" }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              {step === "place" ? (
                <button onClick={() => setStep("type")} className="flex items-center gap-1 text-[calc(12.5px*var(--fs))] font-semibold" style={{ color: TEAL }}><ChevronLeft className="w-4 h-4" /> Back</button>
              ) : <span />}
              <button onClick={() => setStep(null)} aria-label="Close" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#F2EEE6" }}><X className="w-4 h-4" style={{ color: INK }} /></button>
            </div>

            {step === "type" && (
              <>
                <h3 className="font-serif text-[calc(20px*var(--fs))] leading-tight" style={{ color: INK }}>Where are you staying?</h3>
                <p className="text-[calc(12.5px*var(--fs))] mt-1.5" style={{ color: SUB, lineHeight: 1.5 }}>
                  Pin your base and every finder — food, coffee, day trips, passport stamps — re-centers on your neighborhood instead of your phone&rsquo;s GPS.
                </p>
                <p className="text-[calc(11.5px*var(--fs))] mt-2 flex items-center gap-1.5" style={{ color: SUB }}>
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Saved only on this device. Never uploaded, never shared.
                </p>
                <div className="flex flex-wrap gap-2 mt-3.5">
                  {STAY_TYPES.map((t) => (
                    <button key={t.id} onClick={() => { setType(t.id); setStep("place"); }} className="px-3 py-2 rounded-full text-[calc(13px*var(--fs))] font-semibold flex items-center gap-1.5" style={{ background: "#F2EEE6", color: INK }}>
                      <span>{t.emoji}</span>{t.label}
                    </button>
                  ))}
                </div>
                {stay && (
                  <button onClick={stopAnchoring} className="mt-4 text-[calc(12px*var(--fs))] font-medium" style={{ color: SUB }}>Stop anchoring to a stay</button>
                )}
              </>
            )}

            {step === "place" && (
              <>
                <h3 className="font-serif text-[calc(19px*var(--fs))] leading-tight" style={{ color: INK }}>Where&rsquo;s your {typeLabel.toLowerCase()}?</h3>
                <p className="text-[calc(11.5px*var(--fs))] mt-1.5 mb-3.5 flex items-center gap-1.5" style={{ color: SUB }}>
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Kept on this device only.
                </p>
                <button onClick={useCurrent} disabled={busy} className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 mb-2.5 disabled:opacity-60" style={{ background: TEAL }}>
                  <Navigation className="w-4 h-4" /> {busy ? "Getting location…" : "Use my current location"}
                </button>
                <button onClick={() => setPicker(true)} className="w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: "#fff", color: INK, border: `1.5px solid ${EDGE}` }}>
                  <Search className="w-4 h-4" /> Search an address or hotel name
                </button>
              </>
            )}
          </div>
        )}

        {/* CONFIRMATION — the payoff (what changed) */}
        {step === "done" && (
          <div className="rounded-2xl p-4 bg-white flex items-start gap-3" style={{ border: `1px solid ${EDGE}`, boxShadow: "0 10px 30px -18px rgba(22,17,13,.35)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: TEAL }}><Check className="w-5 h-5 text-white" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[calc(17px*var(--fs))]" style={{ color: INK }}>You&rsquo;re based at {label}.</div>
              <div className="text-[calc(12.5px*var(--fs))] mt-0.5" style={{ color: SUB, lineHeight: 1.5 }}>Now showing food, coffee, day trips &amp; stamps around {label}.</div>
            </div>
            <button onClick={() => setStep(null)} className="text-[calc(12.5px*var(--fs))] font-semibold px-2 py-1 flex-shrink-0" style={{ color: TEAL }}>Done</button>
          </div>
        )}
      </div>

      {/* Address search reuses the location picker; onPicked returns the place and
          we set it as the stay ourselves (with the chosen type). */}
      <LocationModePicker isOpen={picker} onClose={() => setPicker(false)} onPicked={commit} />
    </div>
  );
}
