// The flight path (founder, 2026-11-03): when a clip ends, a card over it draws a dashed gold arc from
// HOME to the city, a little plane flying it, and the miles as the crow flies — the app icon's own
// plane and trail. No map and no geography underneath: the home stays private; the distance is
// the point (the worker worked it out from the sender's home and the clip's spot).
//
//   const ended = useEnded(videoRef);   <FlightCard on miles city />
import React, { useEffect, useState } from "react";

const NAVY = "#0C2B50", GOLD = "#D6A64A", MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace", SERIF = "'Instrument Serif', Georgia, serif";
const ARC = "M40 136 Q160 24 280 80";

// True from the moment the clip ends until it plays again or is scrubbed back.
export function useEnded(videoRef, enabled = true) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = videoRef && videoRef.current;
    if (!el || !enabled) { setOn(false); return undefined; }
    const ended = () => setOn(true);
    const off = () => { if (!el.ended) setOn(false); };
    el.addEventListener("ended", ended);
    el.addEventListener("play", off);
    el.addEventListener("seeked", off);
    return () => { el.removeEventListener("ended", ended); el.removeEventListener("play", off); el.removeEventListener("seeked", off); };
  }, [videoRef, enabled]);
  return on;
}

export default function FlightCard({ on = false, miles = null, city = null }) {
  if (!on || !Number.isFinite(Number(miles))) return null;
  const n = Number(miles);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: NAVY, color: "#F3EEE1", pointerEvents: "none", animation: "gs-flight-in 320ms ease-out both", overflow: "hidden" }}>
      <style>{`@keyframes gs-flight-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes gs-flight-draw { from { stroke-dashoffset: 420 } to { stroke-dashoffset: 0 } }
@keyframes gs-flight-fly { from { offset-distance: 0% } to { offset-distance: 100% } }`}</style>
      {/* Pinned to the card's top and bottom, so its height is the card's and never a percentage of a
          content-sized track; centred across with the auto margins. */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", maxWidth: 340, padding: "6px 10px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 2 }}>
        {/* The chart gives way first on a short clip: its box is a flex item that shrinks from 180px to
            whatever the miles leave it, and the SVG fills that box (absolute, so no percentage-height
            guesswork), scaling the whole chart down to fit. */}
        <div style={{ position: "relative", flex: "0 1 180px", minHeight: 0, width: "100%" }}>
          <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}>
            {/* faint parallels and meridians: a chart, not a map */}
            {[30, 60, 90, 120, 150].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="320" y2={y} stroke="rgba(243,238,225,.07)" strokeWidth="1" />)}
            {[40, 80, 120, 160, 200, 240, 280].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="180" stroke="rgba(243,238,225,.07)" strokeWidth="1" />)}
            <path d={ARC} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" style={{ strokeDashoffset: 0, animation: "gs-flight-draw 1400ms ease-out both" }} />
            <circle cx="40" cy="136" r="5" fill={GOLD} />
            <circle cx="280" cy="80" r="5" fill={GOLD} />
            <text x="40" y="158" textAnchor="middle" fontFamily={MONO} fontSize="9" letterSpacing="2" fill="rgba(243,238,225,.85)">HOME</text>
            <text x="312" y="102" textAnchor="end" fontFamily={MONO} fontSize="9" letterSpacing="1.5" fill="rgba(243,238,225,.85)">{String(city || "HERE").toUpperCase().slice(0, 22)}</text>
            <g style={{ offsetPath: `path("${ARC}")`, offsetRotate: "auto", animation: "gs-flight-fly 1400ms ease-in-out both" }}>
              <path d="M-7 0 L5 -1.5 L7 0 L5 1.5 Z M-2 -1 L-4 -5 L-2.5 -5 L0 -1.5 Z M-2 1 L-4 5 L-2.5 5 L0 1.5 Z" fill={GOLD} transform="scale(1.6)" />
            </g>
          </svg>
        </div>
        <div style={{ textAlign: "center", flex: "none" }}>
          <div style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1, color: "#F3EEE1" }}>{n < 30 ? "Right by home" : `${n.toLocaleString()} miles`}</div>
          <div style={{ marginTop: 5, fontFamily: MONO, fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(243,238,225,.7)" }}>From home, as the crow flies</div>
        </div>
      </div>
    </div>
  );
}
