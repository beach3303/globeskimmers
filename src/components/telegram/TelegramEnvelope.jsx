// TelegramEnvelope — a telegram arrives sealed (founder, 2026-10-19: "telegram to open"). The back
// of a buff delivery envelope: the flap down to a red wax seal stamped with the bolt, GLOBESKIMMERS
// TELEGRAPH printed on the flap, a red DELIVER AT ONCE stamp, "TELEGRAM FOR MARGARET", who it's
// from, and TAP TO OPEN. Tapped, the seal breaks and the flap lifts (opening = true); the card then
// shows the telegram itself. Reduced motion skips the lift.
//
//   <TelegramEnvelope to from opening onOpen />
//   to, from  { name, handle }
import React from "react";
import { fs } from "@/components/redesign/constants";
import { TINK, TINK3, TRED, TYPE } from "@/components/telegram/TelegramPaper";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const HEAVY = "'Inter Tight', system-ui, sans-serif";
const BUFF = "#E9D8AB";
const BUFF_DARK = "#DCC792";
const ENV_BG = [
  "radial-gradient(120% 80% at 10% 0%, rgba(255,255,255,.35), transparent 55%)",
  "radial-gradient(80% 70% at 100% 100%, rgba(140,95,25,.16), transparent 60%)",
  "repeating-linear-gradient(90deg, rgba(110,80,20,.03) 0 1px, transparent 1px 5px)",
  BUFF,
].join(", ");

const label = (p) => {
  if (!p) return "";
  const n = String(p.name || "").trim().split(/\s+/)[0].toUpperCase();
  const h = p.handle ? `@${String(p.handle).replace(/^@+/, "").toUpperCase()}` : "";
  return n && h ? `${n} · ${h}` : n || h;
};

function WaxSeal({ breaking }) {
  return (
    <span aria-hidden="true" style={{
      position: "absolute", left: "50%", top: "44%", width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: "50%",
      background: "radial-gradient(circle at 38% 32%, #D2533B, #A3301C 55%, #7E2212)",
      boxShadow: "0 0 0 3px rgba(163,48,28,.55), 0 0 0 5px rgba(163,48,28,.18), 0 3px 6px rgba(60,20,10,.35), inset 0 -3px 6px rgba(0,0,0,.25), inset 0 2px 3px rgba(255,255,255,.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transform: breaking ? "scale(1.25) rotate(-12deg)" : "none", opacity: breaking ? 0 : 1,
      transition: "transform .35s ease-out, opacity .35s ease-out", zIndex: 3,
    }}>
      <svg viewBox="0 0 40 40" width="30" height="30" focusable="false">
        <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,225,210,.45)" strokeWidth="1" strokeDasharray="1.4 1.8" />
        <path d="M22.5 8 L13 22 H19 L16.5 32 L27 17.5 H21 Z" fill="rgba(255,225,210,.55)" stroke="rgba(90,20,10,.45)" strokeWidth=".8" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function TelegramEnvelope({ to = null, from = null, opening = false, onOpen = undefined }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`A sealed telegram from ${label(from) || "someone"}. Open it`}
      style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", perspective: 900, textAlign: "center" }}>
      <span style={{ position: "relative", display: "block", aspectRatio: "1.6 / 1", borderRadius: 5, background: ENV_BG, boxShadow: "0 10px 18px -12px rgba(70,45,10,.55), inset 0 0 0 1px rgba(120,85,25,.2), inset 0 0 30px rgba(150,105,30,.14)", overflow: "visible" }}>
        {/* the side and bottom folds */}
        <svg aria-hidden="true" viewBox="0 0 100 62.5" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M0 62.5 L46 32 M100 62.5 L54 32" stroke="rgba(110,80,25,.28)" strokeWidth=".35" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* the flap: it lifts when opened */}
        <span aria-hidden="true" style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "44%", transformOrigin: "50% 0", zIndex: 2,
          transform: opening ? "rotateX(178deg)" : "none", transition: "transform .55s cubic-bezier(.3,.7,.2,1) .12s",
        }}>
          <span style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: `linear-gradient(180deg, ${BUFF_DARK}, ${BUFF} 85%)`, filter: "drop-shadow(0 2px 2px rgba(80,55,15,.25))" }} />
          <span style={{ position: "absolute", left: 12, top: 9, fontFamily: MONO, fontSize: fs(7.5), letterSpacing: ".26em", color: TINK3, opacity: opening ? 0 : 1 }}>GLOBESKIMMERS TELEGRAPH</span>
        </span>
        <span aria-hidden="true" style={{ position: "absolute", right: 12, top: 10, transform: "rotate(-7deg)", padding: "2px 7px", border: `1.5px solid ${TRED}`, borderRadius: 3, color: TRED, opacity: opening ? 0 : 0.8, mixBlendMode: "multiply", fontFamily: MONO, fontSize: fs(8), fontWeight: 700, letterSpacing: ".18em", zIndex: 2, transition: "opacity .2s" }}>
          DELIVER AT ONCE
        </span>
        <WaxSeal breaking={opening} />
        {/* the address on the back */}
        <span style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: HEAVY, fontWeight: 800, fontSize: fs(15), letterSpacing: ".14em", color: TINK }}>TELEGRAM</span>
          <span style={{ fontFamily: TYPE, fontSize: fs(13.5), letterSpacing: ".05em", color: TINK, overflowWrap: "anywhere" }}>FOR {label(to) || "YOU"}</span>
          <span style={{ fontFamily: TYPE, fontSize: fs(11), letterSpacing: ".05em", color: TINK3, overflowWrap: "anywhere" }}>FROM {label(from) || "A TRAVELER"}</span>
          <span style={{ marginTop: 3, fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".28em", color: TRED }} className="motion-safe:animate-pulse">TAP TO OPEN</span>
        </span>
      </span>
    </button>
  );
}
