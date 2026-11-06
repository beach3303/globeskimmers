// CityCard — the card itself (founder, 2026-10-28; the ChatGPT "Local Finds Card" boards are the
// brief): an airmail edge, cream paper, "CARD · No. 1", the area's name, the country, STAMP TWENTY
// LOCAL SPOTS, and twenty slots. A stamped slot is the founder's category artwork with the business's
// name, its own city small, and the date of the visit in the category's ink; an empty one waits,
// dashed, with its number. A complete card wears COMPLETE across it. Never a punch.
//
// 2026-11-06: a card per METRO AREA ("Greater Phoenix"), twenty slots, numbered and never expiring —
// no year on the card. A stay reads "Accommodation" with a lock to everyone but its owner while its
// name is hidden. Stay and Do press as a word stamp until their artwork lands.
//
//   <CityCard card size onStamp />
//   card     the worker's row: { area_name, city, region, country, no, count, slots, completed_at, stamps: [{ slot, name, city, category, design, visited_on, visits, name_hidden }] }
//   size     'full' (the sheet, the pop-up) or 'small' (a tile on the City Cards page)
//   onStamp  (full only) a tap on a stamped slot → onStamp(stamp): the sheet opens that stamp big
import React from "react";
import { fs } from "@/components/redesign/constants";
import { SLOTS, artFor, inkFor, categoryLabel, categoryWord, stampDate, cardLeft, cardTitle, stampName } from "@/lib/cityCards";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const STAMP = "Georgia, 'Times New Roman', serif";
const CREAM = "#FBF6EC", RULE = "#EADFC9", RED = "#B0472F", INK = "#16110D", INK3 = "#736657", GREEN = "#2E6B4E", DASH = "#D9CDB3", FAINT = "#B8AA8F";
// Each slot presses at its own small tilt, so a card reads as stamped by hand.
const TILT = [-7, 5, -3, 6, -5, 4, -6, 3, -4, 6, -5, 4, -7, 3, -4, 6, -3, 5, -6, 4];
const AIR = "repeating-linear-gradient(135deg, #B0472F 0 8px, #FFFDF8 8px 14px, #1F4E8C 14px 22px, #FFFDF8 22px 28px)";

export const cardWords = (card) => `${cardTitle(card)}${card?.no > 1 ? ` · No. ${card.no}` : ""}`.trim();

// A category without its artwork yet (Stay, Do): a round word stamp in the category's ink.
function WordStamp({ word, ink, size, tilt }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: "block", transform: `rotate(${tilt}deg)`, opacity: 0.9 }}>
      <circle cx="32" cy="32" r="29" fill="none" stroke={ink} strokeWidth="3" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke={ink} strokeWidth="1" />
      <text x="32" y="36.5" textAnchor="middle" fontFamily={STAMP} fontWeight="700" fontSize={word.length > 4 ? 11 : 13} letterSpacing="1.5" fill={ink}>{word}</text>
    </svg>
  );
}
const Lock = ({ ink }) => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }}>
    <rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
);

export default function CityCard({ card, size = "full", style = undefined, onStamp = undefined }) {
  if (!card) return null;
  const slots = card.slots || SLOTS;
  const bySlot = new Map((card.stamps || []).map((s) => [Number(s.slot), s]));
  const count = Number(card.count) || bySlot.size;
  const left = cardLeft({ ...card, count });
  const done = !!card.completed_at;
  const title = cardTitle(card);
  const place = [card.region && !/^Greater /.test(title) ? card.region : null, card.country].filter(Boolean).join(" · ");
  const small = size === "small";
  const art = small ? 22 : 60;

  const slotNode = (i) => {
    const s = bySlot.get(i);
    const tilt = TILT[(i - 1) % TILT.length];
    if (!s) {
      return (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
          <span aria-label={`Slot ${i}, empty`} style={{ width: art, height: art, borderRadius: 999, border: `1.5px dashed ${DASH}`, display: "grid", placeItems: "center", color: FAINT, fontFamily: STAMP, fontSize: small ? fs(7) : fs(11), fontWeight: 700 }}>{i}</span>
          {!small ? <span style={{ fontFamily: MONO, fontSize: fs(6.5), letterSpacing: ".1em", color: FAINT, marginTop: 4 }}>NEXT FIND</span> : null}
        </div>
      );
    }
    const ink = inkFor(s.category);
    const src = artFor(s.category, s.design);
    const hidden = s.category === "stay" && s.name_hidden;
    const label = stampName(s);
    const tappable = !small && typeof onStamp === "function";
    const box = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 };
    const body = (
      <>
        {src
          ? <img src={src} alt={small || tappable ? "" : `${categoryLabel(s.category)} stamp`} draggable={false} style={{ width: art, height: art, display: "block", mixBlendMode: "multiply", transform: `rotate(${tilt}deg)` }} />
          : <WordStamp word={categoryWord(s.category) || "FIND"} ink={ink} size={art} tilt={tilt} />}
        {!small ? (
          <>
            <span style={{ fontFamily: STAMP, fontWeight: 700, fontSize: fs(8), lineHeight: 1.15, letterSpacing: ".04em", textTransform: "uppercase", color: ink, marginTop: 4, maxWidth: 74, overflowWrap: "anywhere" }}>{hidden ? <Lock ink={ink} /> : null}{label}</span>
            {s.city ? <span style={{ fontFamily: MONO, fontSize: fs(6.5), letterSpacing: ".08em", textTransform: "uppercase", color: INK3, marginTop: 1, maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.city}</span> : null}
            <span style={{ fontFamily: MONO, fontSize: fs(6.5), letterSpacing: ".08em", color: INK3, marginTop: 1 }}>{stampDate(s.visited_on)}{(s.visits || 1) > 1 ? <b style={{ color: ink, marginLeft: 3 }}>×{s.visits}</b> : null}</span>
          </>
        ) : null}
      </>
    );
    // In the sheet a stamp is a button: tap it and it opens big, as the type-only stamp.
    if (tappable) {
      return (
        <button key={i} type="button" onClick={() => onStamp(s)} className="active:scale-95 transition-transform"
          aria-label={`${label}${s.city ? `, ${s.city}` : ""}, ${categoryLabel(s.category)} stamp, ${stampDate(s.visited_on)}${(s.visits || 1) > 1 ? `, ${s.visits} visits` : ""}. See it big`}
          style={{ ...box, background: "transparent", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          {body}
        </button>
      );
    }
    return <div key={i} style={box}>{body}</div>;
  };

  const countLine = done ? `${slots} / ${slots} STAMPED · COMPLETE` : `${count} / ${slots} STAMPED · ${left} TO GO`;

  if (small) {
    return (
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${RULE}`, background: "#FFFCF7", boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.08)", ...style }}>
        <div aria-hidden="true" style={{ height: 5, background: AIR }} />
        <div style={{ padding: "8px 9px 10px" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(7), letterSpacing: ".18em", color: RED }}>CARD · No. {card.no}</div>
          <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(18), lineHeight: 1, marginTop: 3, color: INK }}>{title}</div>
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
        <div aria-hidden="true" style={{ position: "absolute", right: 12, top: 8, width: 56, height: 56, borderRadius: 999, border: "2px solid rgba(176,71,47,.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: RED, transform: "rotate(8deg)", opacity: 0.85 }}>
          <span className="truncate" style={{ fontFamily: MONO, fontSize: fs(5), letterSpacing: ".14em", textTransform: "uppercase", maxWidth: 44 }}>{title}</span>
          <span style={{ fontFamily: STAMP, fontWeight: 700, fontSize: fs(13), lineHeight: 1 }}>No. {card.no}</span>
          <span className="truncate" style={{ fontFamily: MONO, fontSize: fs(5), letterSpacing: ".1em", textTransform: "uppercase", maxWidth: 44 }}>{card.country}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".2em", color: RED }}>CARD · No. {card.no}</div>
        <div style={{ fontFamily: SERIF, fontSize: fs(30), lineHeight: 1, marginTop: 4, color: INK, paddingRight: 64 }}>{title}</div>
        {place ? <div style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".16em", textTransform: "uppercase", color: INK3, marginTop: 3, paddingRight: 64 }}>{place}</div> : null}
        <div style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".16em", color: RED, marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ flex: 1, borderTop: "1px solid rgba(176,71,47,.35)" }} />STAMP TWENTY LOCAL SPOTS<span aria-hidden="true" style={{ flex: 1, borderTop: "1px solid rgba(176,71,47,.35)" }} />
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
    <div aria-hidden="true" style={{ position: "absolute", left: small ? 14 : "50%", top: small ? 40 : 118, padding: small ? "2px 8px" : "3px 10px", border: `${small ? 2 : 2.5}px solid ${GREEN}`, borderRadius: 4, color: GREEN, fontFamily: STAMP, fontWeight: 700, fontSize: small ? fs(10) : fs(18), letterSpacing: ".18em", transform: small ? "rotate(-12deg)" : "translateX(-50%) rotate(-12deg)", opacity: 0.85, pointerEvents: "none" }}>COMPLETE</div>
  );
}
