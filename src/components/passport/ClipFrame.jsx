// A house frame around a clip (founder, 2026-11-03: "the marks only we can put on a clip — build both").
// Four frames drawn at playback from the clip's own verified city and date, around whatever plays
// inside (`children` is the <video>): Airmail (a white mat with the red-and-blue air-mail border, the
// caption in the house italic, a postmark), Postmark (the clip alone with a postmark pressed into its
// top corner), Passport page (a cream page with PLACE · DATE · TRAVELER · ENTRY typed above the clip
// and the city's stamp pressed across its corner) and Print (a photo print with the caption written by
// hand underneath and the date burnt into a corner). Nothing sits over the player's controls.
//
//   <ClipFrame frame city region country date caption>{video}</ClipFrame>
import React from "react";
import { markDate } from "@/lib/clipMarks";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const HAND = "'Caveat', 'Bradley Hand', cursive";
const RED = "#B0472F", BLUE = "#1F4E8C", INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", CREAM = "#FBF6EC", CREAM_RULE = "#EADFC9";
// The frame's stamp inks by region are the passport's; the frame uses forest green for the Americas,
// the stamp red elsewhere.
const stampInk = (country) => (/united states|canada|mexico|brazil|argentina|chile|peru|colombia/i.test(String(country || "")) ? "#2F5F3F" : RED);

function Wavy({ w = 52, color = RED, style = undefined }) {
  return (
    <svg width={w} height={40} viewBox="0 0 52 40" style={{ color, ...style }} aria-hidden="true" focusable="false">
      <path d="M0 6 q6 -5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M0 17 q6 -5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M0 28 q6 -5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
// The round postmark: the city, the day, the house.
function Postmark({ city, date, size = 64, backed = false, style = undefined }) {
  const d = markDate(date);
  const [dm, y] = d ? [d.slice(0, 6), d.slice(7)] : ["", ""];
  return (
    <div aria-hidden="true" style={{ width: size, height: size, boxSizing: "border-box", borderRadius: 999, border: `2px solid ${RED}`, boxShadow: backed ? `inset 0 0 0 3px rgba(255,255,255,.6), inset 0 0 0 4.5px ${RED}` : `inset 0 0 0 3px #FFFFFF, inset 0 0 0 4px ${RED}`, background: backed ? "rgba(255,255,255,.62)" : "transparent", color: RED, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, transform: "rotate(-9deg)", opacity: 0.9, fontFamily: MONO, textAlign: "center", lineHeight: 1.05, ...style }}>
      <div style={{ fontSize: Math.max(5.5, size * 0.09), letterSpacing: ".08em", lineHeight: 1, maxWidth: size * 0.8, maxHeight: size * 0.2, overflow: "hidden" }}>{String(city || "").toUpperCase()}</div>
      {dm ? <div style={{ fontSize: Math.max(8, size * 0.15), fontWeight: 500, letterSpacing: ".04em" }}>{dm}</div> : null}
      {y ? <div style={{ fontSize: Math.max(8, size * 0.15), fontWeight: 500, letterSpacing: ".04em" }}>{y}</div> : null}
      <div style={{ fontSize: Math.max(5, size * 0.085), letterSpacing: ".12em" }}>GLOBESKIMMERS</div>
    </div>
  );
}

export default function ClipFrame({ frame = null, city = null, region = null, country = null, date = null, caption = null, children, style = undefined }) {
  const d = markDate(date);
  if (!frame) return children;
  if (frame === "airmail") {
    return (
      <div style={{ boxSizing: "border-box", padding: 10, background: "#FFFFFF", border: "10px solid transparent", borderImage: `repeating-linear-gradient(45deg, ${RED} 0 12px, #FFFFFF 12px 24px, ${BLUE} 24px 36px, #FFFFFF 36px 48px) 10`, boxShadow: "0 10px 24px -14px rgba(22,17,13,.35)", ...style }}>
        {children}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 64, marginTop: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE }}>Par avion · by air mail</div>
            {caption ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 17, lineHeight: 1.2, color: INK2, overflowWrap: "anywhere" }}>{caption}</div> : city ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 17, color: INK2 }}>{city}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
            <Postmark city={city} date={date} size={60} />
            <Wavy w={44} style={{ opacity: 0.8 }} />
          </div>
        </div>
      </div>
    );
  }
  if (frame === "postmark") {
    return (
      <div style={{ position: "relative", ...style }}>
        {children}
        <div aria-hidden="true" style={{ position: "absolute", right: 10, top: 10, display: "flex", alignItems: "center", gap: 2, pointerEvents: "none" }}>
          <Wavy w={64} style={{ opacity: 0.85 }} />
          <Postmark city={city} date={date} size={84} backed />
        </div>
      </div>
    );
  }
  if (frame === "passport") {
    const ink = stampInk(country);
    const label = { fontFamily: MONO, fontSize: 8.5, letterSpacing: ".18em", textTransform: "uppercase", color: INK3 };
    const value = { fontSize: 12.5, fontWeight: 600, color: INK, overflowWrap: "anywhere" };
    return (
      <div style={{ position: "relative", boxSizing: "border-box", padding: "12px 14px 14px", background: CREAM, border: `1px solid ${CREAM_RULE}`, borderRadius: 4, boxShadow: "inset 16px 0 20px -16px rgba(22,17,13,.28), 0 10px 24px -14px rgba(22,17,13,.3)", ...style }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 12px", marginBottom: 10 }}>
          <div><div style={label}>Place</div><div style={value}>{city || "—"}</div></div>
          <div><div style={label}>Date</div><div style={value}>{d ? d.charAt(0) + d.slice(1).toLowerCase().replace(/ (\w)/g, (m) => m.toUpperCase()) : "—"}</div></div>
          <div><div style={label}>Traveler</div><div style={value}>A traveler</div></div>
          <div><div style={label}>Entry</div><div style={value}>Clip</div></div>
        </div>
        <div style={{ position: "relative", border: "6px solid #FFFFFF", background: "#000", boxShadow: "0 8px 18px -10px rgba(22,17,13,.45)" }}>
          {children}
          <div aria-hidden="true" style={{ position: "absolute", left: -14, top: -10, width: 150, height: 66, boxSizing: "border-box", border: `2.5px double ${ink}`, borderRadius: 8, color: ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, transform: "rotate(-8deg)", opacity: 0.9, fontFamily: MONO, textAlign: "center", background: "rgba(251,246,236,.5)", pointerEvents: "none" }}>
            <div style={{ fontSize: 8.5, letterSpacing: ".16em", maxWidth: 136, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(city || "").toUpperCase()}</div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".08em" }}>★ {d || "VERIFIED"} ★</div>
            <div style={{ fontSize: 6, letterSpacing: ".16em" }}>GLOBESKIMMERS · ENTRY</div>
          </div>
        </div>
        {caption ? <div style={{ marginTop: 10, fontFamily: SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.25, color: INK2, overflowWrap: "anywhere" }}>{caption}</div> : null}
      </div>
    );
  }
  if (frame === "print") {
    const film = d ? `'${d.slice(-2)} ${String(new Date(date).getMonth() + 1).padStart(2, "0")} ${d.slice(0, 2)}` : "";
    return (
      <div style={{ position: "relative", boxSizing: "border-box", padding: "12px 12px 14px", background: "#FFFFFF", boxShadow: "0 14px 28px -14px rgba(22,17,13,.45), 0 1px 0 rgba(22,17,13,.06)", ...style }}>
        <div style={{ position: "relative" }}>
          {children}
          {film ? <div aria-hidden="true" style={{ position: "absolute", right: 10, top: 8, fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: ".08em", color: "#F2A33A", textShadow: "0 0 3px rgba(242,163,58,.7)", pointerEvents: "none" }}>{film}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 10, minHeight: 28 }}>
          <div style={{ fontFamily: HAND, fontSize: 22, fontWeight: 600, lineHeight: 1.05, color: INK2, transform: "rotate(-1deg)", overflowWrap: "anywhere" }}>{caption || city || ""}</div>
          {city ? <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".16em", textTransform: "uppercase", color: INK3, whiteSpace: "nowrap" }}>{city}</div> : null}
        </div>
      </div>
    );
  }
  return children;
}
