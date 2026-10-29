// CityStampDetail — one stamp on a City Card, opened by a tap on it (founder, 2026-10-29: "i like
// A but where would we put them? i also like to keep the 10 local stamps"). The card keeps its ten
// category stamps; this sheet gives the business the passport's own type-only stamp, big — name,
// city, state, country and the day it was first stamped — with the category stamp small beside
// the facts: category, slot, visits. The owner can share the stamp; a visitor just sees it.
//
//   <CityStampDetail card stamp owner onClose />
//   stamp  the card's row: { slot, place_id, name, category, design, visited_on, visits, last_visited_on }
import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, X } from "lucide-react";
import TypographicStamp from "@/components/passport/TypographicStamp";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { useDismissable } from "@/lib/dismissStack";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import { SLOTS, artFor, categoryLabel, inkFor } from "@/lib/cityCards";
import { shareStampElement } from "@/components/citycards/shareCard";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const CREAM = "#FBF6EC", RULE = "#EADFC9", RED = "#B0472F";

// "Oct 24" or, with the year, "Oct 24, 2026"
const day = (iso, year = false) => {
  const d = new Date(`${String(iso || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", year ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
};

export default function CityStampDetail({ card, stamp, owner = false, onClose }) {
  useDismissable(true, onClose);
  const [sharing, setSharing] = useState(false);
  const ref = useRef(null);
  if (!card || !stamp) return null;
  const visits = Math.max(1, Number(stamp.visits) || 1);
  const first = stamp.visited_on, last = stamp.last_visited_on || stamp.visited_on;
  const again = visits > 1 && last && last !== first;
  const slots = card.slots || SLOTS;
  const ink = inkFor(stamp.category);
  // "3 VISITS · OCT 24 – OCT 28, 2026" or "1 VISIT · OCT 24, 2026"
  const visitLine = `${visits} ${visits === 1 ? "visit" : "visits"} · ${again ? `${day(first)} – ${day(last, true)}` : day(first, true)}`.toUpperCase();
  // The card knows the first and the latest day, and how many times in between.
  const whenLine = visits === 1 ? `Stamped ${day(first, true)}`
    : visits === 2 ? `First stamped ${day(first, true)} · back ${day(last)}`
    : `First stamped ${day(first, true)} · back ${visits - 1} times, last ${day(last)}`;
  const share = async () => { if (sharing) return; setSharing(true); await shareStampElement(ref.current, card, stamp); setSharing(false); };

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9998, background: "rgba(22,17,13,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${stamp.name}, stamp ${stamp.slot} on the ${card.city} ${card.year} card`} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>Stamp {stamp.slot} of {slots} · {card.city} {card.year}</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{stamp.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>

        {/* The type-only stamp on cream — what gets shared. */}
        <div ref={ref} style={{ marginTop: 12, borderRadius: 14, background: CREAM, border: `1px solid ${RULE}`, padding: "18px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ transform: "rotate(-2deg)" }}>
            <TypographicStamp name={stamp.name} city={card.city} region={card.region} country={card.country} date={first} entityId={stamp.place_id} width={250} strength={STAMP_INK_STRENGTH} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".16em", color: NEUTRAL.ink3, marginTop: 14, textAlign: "center" }}>{visitLine}</div>
        </div>

        {/* The category stamp from the card, small, with the facts. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, padding: "10px 12px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.1)" }}>
          <img src={artFor(stamp.category, stamp.design)} alt="" draggable={false} style={{ width: 50, height: 50, display: "block", mixBlendMode: "multiply", transform: "rotate(-7deg)", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: fs(13.5), fontWeight: 650, color: NEUTRAL.ink }}><span style={{ color: ink }}>{categoryLabel(stamp.category)}</span> · stamp {stamp.slot} on {owner ? "your" : "this"} card</div>
            <div style={{ fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink2, marginTop: 2 }}>{whenLine}</div>
          </div>
        </div>

        {owner ? (
          <button type="button" onClick={share} aria-busy={sharing || undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 10, minHeight: 44, borderRadius: 12, border: `1px solid ${RULE}`, background: "#fff", font: "inherit", fontSize: fs(13.5), fontWeight: 650, color: NEUTRAL.ink, cursor: "pointer" }}>
            <Share2 size={15} strokeWidth={2.2} color={RED} aria-hidden="true" focusable="false" />{sharing ? "Rendering…" : "Share this stamp"}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
