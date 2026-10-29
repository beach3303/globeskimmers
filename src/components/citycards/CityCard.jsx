// CityCard — the card itself (founder, 2026-10-28; the ChatGPT "Local Finds Card" boards are the
// brief): an airmail edge, cream paper, "CITY CARD · No. 1", the city with its year, the state and
// country, STAMP TEN LOCAL SPOTS, and ten slots. A stamped slot is the founder's category artwork
// with the business's name and the date of the visit in the category's ink; an empty one waits,
// dashed, with its number. A complete card wears COMPLETE across it. Never a punch.
//
//   <CityCard card size />
//   card   the worker's row: { city, region, country, year, no, count, slots, completed_at, stamps: [{ slot, name, category, design, visited_on }] }
//   size   'full' (the sheet, the pop-up) or 'small' (a tile on the City Cards page)
import React from "react";
import { fs } from "@/components/redesign/constants";
import { SLOTS, artFor, inkFor, categoryLabel, stampDate, cardLeft } from "@/lib/cityCards";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const STAMP = "Georgia, 'Times New Roman', serif";
const CREAM = "#FBF6EC", RULE = "#EADFC9", RED = "#B0472F", INK = "#16110D", INK3 = "#736657", GREEN = "#2E6B4E", DASH = "#D9CDB3", FAINT = "#B8AA8F";
// Each slot presses at its own small tilt, so a card reads as stamped by hand.
const TILT = [-7, 5, -3, 6, -5, 4, -6, 3, -4, 6];
const AIR = "repeating-linear-gradient(135deg, #B0472F 0 8px, #FFFDF8 8px 14px, #1F4E8C 14px 22px, #FFFDF8 22px 28px)";

export const cardWords = (card) => `${card?.city || ""} ${card?.year || ""}${card?.no > 1 ? ` · No. ${card.no}` : ""}`.trim();

export default function CityCard({ card, size = "full", style = undefined }) {
  if (!card) return null;
  const slots = card.slots || SLOTS;
  const bySlot = new Map((card.stamps || []).map((s) => [Number(s.slot), s]));
  const count = Number(card.count) || bySlot.size;
  const left = cardLeft({ ...card, count });
  const done = !!card.completed_at;
  const place = [card.region, card.country].filter(Boolean).join(" · ");
  const small = size === "small";
  const art = small ? 25 : 66;

  const slotNode = (i) => {
    const s = bySlot.get(i);
    const tilt = TILT[(i - 1) % TILT.length];
    if (!s) {
      return (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
          <span aria-label={`Slot ${i}, empty`} style={{ width: art, height: art, borderRadius: 999, border: `1.5px dashed ${DASH}`, display: "grid", placeItems: "center", color: FAINT, fontFamily: STAMP, fontSize: small ? fs(8) : fs(13), boxSizing: "border-box" }}>{String(i).padStart(2, "0")}</span>
          {!small ? <span style={{ fontFamily: MONO, fontSize: fs(7), letterSpacing: ".1em", color: FAINT, marginTop: 5 }}>YOUR NEXT FIND</span> : null}
        </div>
      );
    }
    const ink = inkFor(s.category);
    return (
      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 }}>
        <img src={artFor(s.category, s.design)} alt={small ? "" : `${categoryLabel(s.category)} stamp`} draggable={false}
          style={{ width: art, height: art, display: "block", mixBlendMode: "multiply", transform: `rotate(${tilt}deg)` }} />
        {!small ? (
          <>
            <span style={{ fontFamily: STAMP, fontWeight: 700, fontSize: fs(8.6), lineHeight: 1.15, letterSpacing: ".04em", textTransform: "uppercase", color: ink, marginTop: 5, maxWidth: 78, overflowWrap: "anywhere" }}>{s.name}</span>
            <span style={{ fontFamily: MONO, fontSize: fs(7), letterSpacing: ".1em", color: INK3, marginTop: 2 }}>{stampDate(s.visited_on)}</span>
          </>
        ) : null}
      </div>
    );
  };

  const countLine = done ? `${slots} / ${slots} STAMPED · COMPLETE` : `${count} / ${slots} STAMPED · ${left} TO GO`;

  if (small) {
    return (
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${RULE}`, background: "#FFFCF7", boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)", ...style }}>
        <div aria-hidden="true" style={{ height: 5, background: AIR }} />
        <div style={{ padding: "8px 9px 10px" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(7), letterSpacing: ".18em", color: RED }}>CITY CARD · {card.year} · No. {card.no}</div>
          <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(19), lineHeight: 1, marginTop: 3, color: INK }}>{card.city}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4, marginTop: 8, justifyItems: "center", opacity: done ? 0.55 : 1 }}>
            {Array.from({ length: slots }, (_, k) => slotNode(k + 1))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".1em", color: done ? GREEN : INK3, marginTop: 8 }}>{countLine}</div>
        </div>
        {done ? <CompleteMark small /> : null}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: CREAM, border: `1px solid ${RULE}`, boxShadow: "0 18px 40px -22px rgba(22,17,13,.45)", ...style }}>
      <div aria-hidden="true" style={{ height: 6, background: AIR }} />
      <div style={{ padding: "10px 14px 14px", position: "relative" }}>
        <div aria-hidden="true" style={{ position: "absolute", right: 12, top: 8, width: 56, height: 56, borderRadius: 999, border: "2px solid rgba(176,71,47,.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(176,71,47,.7)", transform: "rotate(8deg)", mixBlendMode: "multiply" }}>
          <span className="truncate" style={{ fontFamily: MONO, fontSize: fs(5), letterSpacing: ".14em", textTransform: "uppercase", maxWidth: 44 }}>{card.city}</span>
          <span style={{ fontFamily: STAMP, fontWeight: 700, fontSize: fs(13), lineHeight: 1 }}>{card.year}</span>
          <span className="truncate" style={{ fontFamily: MONO, fontSize: fs(5), letterSpacing: ".1em", textTransform: "uppercase", maxWidth: 44 }}>{card.region || card.country}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: RED }}>CITY CARD · No. {card.no}</div>
        <div style={{ fontFamily: SERIF, fontSize: fs(34), lineHeight: 1, marginTop: 4, color: INK, paddingRight: 64 }}>{card.city} <em style={{ color: RED }}>{card.year}</em></div>
        {place ? <div style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".16em", textTransform: "uppercase", color: INK3, marginTop: 3, paddingRight: 64 }}>{place}</div> : null}
        <div style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".16em", color: RED, marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ flex: 1, borderTop: "1px solid rgba(176,71,47,.35)" }} />STAMP TEN LOCAL SPOTS<span aria-hidden="true" style={{ flex: 1, borderTop: "1px solid rgba(176,71,47,.35)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 6px", marginTop: 12 }}>
          {Array.from({ length: slots }, (_, k) => slotNode(k + 1))}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(176,71,47,.2)" }}>
          <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", color: done ? GREEN : RED, flex: "none" }}>{countLine}</span>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(11.5), color: INK3, textAlign: "right" }}>Your passport is for places. This card is for discoveries.</span>
        </div>
      </div>
      {done ? <CompleteMark /> : null}
    </div>
  );
}

function CompleteMark({ small = false }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: small ? 14 : "50%", top: small ? 40 : 118, padding: small ? "2px 8px" : "3px 10px", border: `${small ? 2 : 2.5}px solid ${GREEN}`, borderRadius: 4, color: GREEN, fontFamily: STAMP, fontWeight: 700, fontSize: small ? fs(13) : fs(19), letterSpacing: ".22em", transform: small ? "rotate(-10deg)" : "translateX(-50%) rotate(-9deg)", opacity: 0.82, mixBlendMode: "multiply", boxShadow: `inset 0 0 0 ${small ? 1.5 : 2}px ${CREAM}, inset 0 0 0 ${small ? 2.5 : 3.5}px ${GREEN}`, pointerEvents: "none" }}>COMPLETE</div>
  );
}
