// CityCardComplete — the tenth stamp (founder, 2026-10-28: "once we reach 10 we dont stamp
// virtual passport"). The finished card with every name and date, COMPLETE across it, who sees it,
// Share, Done — and the plain line that the passport isn't stamped. Card No. 1 stays in City
// Cards; the next find in that city starts No. 2.
//
//   <CityCardComplete card onClose onChanged />
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, X } from "lucide-react";
import CityCard, { cardWords } from "@/components/citycards/CityCard";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { logEvent } from "@/lib/analytics";
import { AUDIENCES, aboveCeiling, capTo, usePassportAudience } from "@/lib/audience";
import { PRIVACY_TONE } from "@/components/privacy/PrivacyChip";
import { setCityCardVisibility } from "@/lib/cityCards";
import { shareCardElement } from "@/components/citycards/shareCard";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const BLUE = "#1F4E8C", RED = "#B0472F";

export default function CityCardComplete({ card, onClose, onChanged = undefined }) {
  const reduce = useReducedMotion();
  const [ceiling] = usePassportAudience(true);
  const [level, setLevel] = useState(card?.visibility || null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const close = () => { if (!busy) onClose(); };
  useDismissable(true, close);
  useEffect(() => { if (!level && ceiling) setLevel(capTo("inner", ceiling)); }, [ceiling, level]);
  useEffect(() => { if (card) logEvent("citycard_complete_shown", { city: card.city, no: card.no }, "CityCards"); }, [card]);
  if (!card) return null;
  const shown = level ? capTo(level, ceiling) : null;
  const pick = async (v) => {
    if (busy || v === (card.visibility || null)) { setLevel(v); return; }
    setLevel(v);
    const r = await setCityCardVisibility(card.id, v);
    if (!r.ok) { showToast(r.code === "teen_hold" ? "Sharing beyond friends opens at age 18" : (r.error || "Couldn’t save that — try again"), "error"); setLevel(card.visibility || null); return; }
    onChanged?.({ ...card, visibility: r.visibility || v });
  };
  const share = async () => { if (busy) return; setBusy(true); await shareCardElement(ref.current, card); setBusy(false); };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10030, background: "rgba(7,27,51,.72)", padding: 12 }} onClick={(e) => { e.stopPropagation(); close(); }}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="cc-complete-h" onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduce ? 0.15 : 0.35, ease: "easeOut" }}
        className="w-full overflow-y-auto" style={{ position: "relative", maxWidth: 400, maxHeight: "94vh", background: NEUTRAL.ivory, borderRadius: 24, boxShadow: "0 24px 60px -20px rgba(0,0,0,.55)" }}>
        <AirmailChevron height={5} />
        <button type="button" onClick={close} aria-label="Close"
          style={{ position: "absolute", top: 8, right: 6, width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", border: 0, color: NEUTRAL.ink2, zIndex: 2 }}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <div style={{ padding: "14px 16px calc(16px + env(safe-area-inset-bottom))", textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: RED, padding: "0 28px", textWrap: "balance" }}>Ten local spots, all with you there</div>
          <h2 id="cc-complete-h" style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: fs(29), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>Your <em style={{ fontStyle: "italic", color: BLUE }}>{card.city} {card.year}</em> card is complete!</h2>
          <p style={{ margin: "8px auto 0", maxWidth: 320, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            Ten local finds, each stamped where you stood. Card No. {card.no} stays in your City Cards, every name and date on it. Your next {card.city} find starts card No. {card.no + 1}.
          </p>
          <div ref={ref} style={{ margin: "12px auto 0", transform: reduce ? "none" : "rotate(-1.5deg)" }}><CityCard card={card} size="full" /></div>

          <fieldset style={{ margin: "14px 0 0", padding: 0, border: 0, textAlign: "left" }}>
            <legend style={{ fontSize: fs(13), fontWeight: 650, color: NEUTRAL.ink, marginBottom: 6 }}>Who sees this card</legend>
            <div role="radiogroup" aria-label="Who sees this card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {AUDIENCES.map((a) => {
                const off = aboveCeiling(a.key, ceiling);
                const on = shown === a.key;
                const t = PRIVACY_TONE[a.key];
                return (
                  <button key={a.key} type="button" role="radio" aria-checked={on} aria-disabled={off || undefined} disabled={off || busy} onClick={() => pick(a.key)}
                    style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "6px 10px", borderRadius: 12, textAlign: "left", background: on ? t.bg : "#fff", border: `1.5px solid ${on ? t.ink : "rgba(22,17,13,.12)"}`, color: on ? t.ink : NEUTRAL.ink2, opacity: off ? 0.4 : 1, fontSize: fs(13), fontWeight: on ? 700 : 550, lineHeight: 1.2, cursor: off ? "not-allowed" : "pointer" }}>
                    <span aria-hidden="true">{a.icon}</span>{a.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button type="button" onClick={share} disabled={busy}
            className="w-full flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ marginTop: 12, minHeight: 50, borderRadius: 14, border: 0, background: "#0E7C73", color: "#fff", fontSize: fs(15.5), fontWeight: 650 }}>
            <Share2 size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />{busy ? "Rendering…" : `Share my ${cardWords(card)} card`}
          </button>
          <button type="button" onClick={close} disabled={busy}
            style={{ width: "100%", minHeight: 40, marginTop: 2, background: "transparent", border: 0, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
            Done
          </button>
          <p style={{ margin: "2px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Your Virtual Passport isn’t stamped. It keeps the places you’ve been; this card keeps what you found.</p>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
