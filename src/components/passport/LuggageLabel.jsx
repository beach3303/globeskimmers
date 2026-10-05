// LuggageLabel — one engraved 1920s hotel luggage label, drawn in the muted
// worn-ink language of the passport stamps (founder bar, 2026-09-29: aged
// paper, engraving, serif, roman numerals — never cartoons, never gloss).
// Six shapes cover every label: oval, roundel, lozenge, diamond, plane, film.
// The label is pure SVG so it composites over the photo-real trunk skin and
// survives html2canvas capture for shares.
import React from "react";

const SERIF = "Georgia, 'Times New Roman', serif";
const PAPER = "#F2E9D2", PAPER_EDGE = "#DCCFAE";

// Fit a text into a width at a base size (same 0.62em/char heuristic the stamps use).
const fit = (s, box, max, ls = 0) => Math.min(max, (box - String(s || "").length * ls) / (Math.max(1, String(s || "").length) * 0.62));

export default function LuggageLabel({ label, uid }) {
  if (label.shape === "flag") {
    // A real vinyl flag sticker: white die-cut border, the true flag, a faint
    // gloss. HTML (not SVG <image>) so share captures can draw it — the flag
    // art serves with open CORS for exactly that. A country that isn't home or
    // residence prints "VISITED <NAME>" above its flag (founder, 2026-10-05);
    // home flags stay plain.
    return (
      <div role="img" aria-label={label.visited ? `Sticker: visited ${label.top}` : `Flag sticker: ${label.top}`}
        style={{ position: "relative", background: "#FFFFFF", padding: "7%", borderRadius: "12% / 16%", boxShadow: "0 1px 1.5px rgba(0,0,0,.28), 0 0 0 0.5px rgba(0,0,0,.06)" }}>
        {label.visited && (
          <span style={{ display: "block", textAlign: "center", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: "clamp(6.5px, 0.72em, 11px)", lineHeight: 1.15, letterSpacing: ".04em", color: "#2B3A52", padding: "0 1% 4%", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Visited {label.top}
          </span>
        )}
        <img src={label.flag} alt="" crossOrigin="anonymous" draggable={false}
          style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: "6% / 8%", pointerEvents: "none" }} />
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "12% / 16%", background: "linear-gradient(155deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,0) 38%)", pointerEvents: "none" }} />
      </div>
    );
  }
  const worn = `lblworn-${uid}`;
  const ink = label.ink;
  const Defs = (
    <defs>
      <filter id={worn} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
      </filter>
    </defs>
  );

  if (label.shape === "oval") {
    // Naturalist's engraving: arc title, hatched creature, sub line.
    const arcId = `lblarc-${uid}`;
    return (
      <svg viewBox="0 0 200 128" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: ${label.top || label.big}`}>
        {Defs}
        <ellipse cx="100" cy="64" rx="98" ry="62" fill={PAPER} />
        <ellipse cx="100" cy="64" rx="98" ry="62" fill="none" stroke={PAPER_EDGE} strokeWidth="3" />
        <g filter={`url(#${worn})`} style={{ color: ink }}>
          <ellipse cx="100" cy="64" rx="88" ry="52" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path id={arcId} d="M22,64 a78,44 0 0 1 156,0" fill="none" />
          <text fontFamily={SERIF} fontWeight="700" fontSize={fit(label.top, 150, 11, 2.2)} fill="currentColor" letterSpacing="2.2">
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{label.top}</textPath>
          </text>
          {/* the engraved fish, hatched */}
          <g fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M52,72 q22,-18 56,-15 q16,1 26,8 l15,-11 q4,-2 3,2 l-5,12 5,11 q1,4 -3,2 l-15,-9 q-10,7 -26,8 q-34,2 -56,-8 z" />
            <path d="M64,66 q20,-8 44,-7" opacity=".7" />
            <path d="M66,73 q22,5 46,3" opacity=".7" />
          </g>
          <g fill="currentColor"><circle cx="61" cy="66" r="1.6" /><circle cx="80" cy="60" r="1.3" /><circle cx="94" cy="58" r="1.3" /><circle cx="108" cy="58" r="1.3" /></g>
          {label.big && <text x="100" y="100" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize={fit(label.big, 140, 11, 2)} fill="currentColor" letterSpacing="2">{label.big}</text>}
          {label.sub && <text x="100" y={label.big ? 114 : 104} textAnchor="middle" fontFamily={SERIF} fontSize="8.5" fill="#7A6A45" letterSpacing="2.2">{label.sub}</text>}
        </g>
      </svg>
    );
  }

  if (label.shape === "roundel") {
    return (
      <svg viewBox="0 0 140 140" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: ${label.top}`}>
        {Defs}
        <circle cx="70" cy="70" r="68" fill={PAPER} />
        <circle cx="70" cy="70" r="68" fill="none" stroke={PAPER_EDGE} strokeWidth="3" />
        <g filter={`url(#${worn})`} style={{ color: ink }}>
          <circle cx="70" cy="70" r="56" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="70" cy="70" r="50" fill="none" stroke="currentColor" strokeWidth="1" />
          <text x="70" y="66" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="26" fill="currentColor" letterSpacing="2">{label.top}</text>
          <path d="M36,74 h68" stroke="currentColor" strokeWidth="1" />
          {label.sub && <text x="70" y="92" textAnchor="middle" fontFamily={SERIF} fontSize="10" fill="currentColor" letterSpacing="1.8">{label.sub}</text>}
        </g>
      </svg>
    );
  }

  if (label.shape === "diamond") {
    return (
      <svg viewBox="0 0 160 160" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: ${label.top}`}>
        {Defs}
        <path d="M80,4 L156,80 L80,156 L4,80 Z" fill={label.ink === "#C9A85C" ? "#222C40" : PAPER} stroke={PAPER_EDGE} strokeWidth="3" />
        <g filter={`url(#${worn})`} style={{ color: ink }}>
          <path d="M80,16 L144,80 L80,144 L16,80 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x="80" y="68" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize={fit(label.top, 96, 14, 2.4)} fill="currentColor" letterSpacing="2.4">{label.top}</text>
          {label.big && <text x="80" y="94" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="22" fill="currentColor" letterSpacing="2">{label.big}</text>}
          {label.sub && <text x="80" y="114" textAnchor="middle" fontFamily={SERIF} fontSize="9" fill="currentColor" letterSpacing="1.6" opacity=".85">{label.sub}</text>}
        </g>
      </svg>
    );
  }

  if (label.shape === "plane") {
    return (
      <svg viewBox="0 0 110 110" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: first flight ${label.top}`}>
        {Defs}
        <circle cx="55" cy="55" r="53" fill={PAPER} />
        <circle cx="55" cy="55" r="53" fill="none" stroke={PAPER_EDGE} strokeWidth="3" />
        <g filter={`url(#${worn})`} style={{ color: ink }}>
          <circle cx="55" cy="55" r="42" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M35,62 l20,-8 14,-16 q3,-3 5,0 q2,3 -1,6 l-13,14 -4,20 -5,1 -1,-15 -10,4 -3,6 -4,1 1,-8 -6,-4 1,-4 z" fill="currentColor" />
          {label.top && <text x="55" y="92" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="10.5" fill="currentColor" letterSpacing="2.4">{label.top}</text>}
        </g>
      </svg>
    );
  }

  if (label.shape === "film") {
    return (
      <svg viewBox="0 0 150 86" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: filmed here`}>
        {Defs}
        <rect x="2" y="2" width="146" height="82" rx="10" fill="#222C40" stroke={PAPER_EDGE} strokeWidth="3" />
        <g filter={`url(#${worn})`} style={{ color: "#D8CCAA" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} fill="currentColor" opacity=".9">
              <rect x={14 + i * 21} y="10" width="9" height="7" rx="1.5" />
              <rect x={14 + i * 21} y="69" width="9" height="7" rx="1.5" />
            </g>
          ))}
          <text x="75" y="42" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="12.5" fill="currentColor" letterSpacing="2">{label.top}</text>
          {label.sub && <text x="75" y="60" textAnchor="middle" fontFamily={SERIF} fontSize={fit(label.sub, 120, 9, 1.2)} fill="#8C9BB8" letterSpacing="1.2">{label.sub}</text>}
        </g>
      </svg>
    );
  }

  // lozenge (default): script or small-caps line on a rounded band.
  return (
    <svg viewBox="0 0 190 66" width="100%" style={{ display: "block" }} role="img" aria-label={`Label: ${label.big || label.top}`}>
      {Defs}
      <rect x="2" y="2" width="186" height="62" rx="31" fill={PAPER} stroke={PAPER_EDGE} strokeWidth="3" />
      <g filter={`url(#${worn})`} style={{ color: ink }}>
        <rect x="10" y="10" width="170" height="46" rx="23" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {label.big
          ? <text x="95" y="41" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontWeight="700" fontSize="19" fill="currentColor">{label.big}</text>
          : <>
              <text x="95" y="34" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize={fit(label.top, 150, 12.5, 2)} fill="currentColor" letterSpacing="2">{label.top}</text>
              {label.sub && <text x="95" y="50" textAnchor="middle" fontFamily={SERIF} fontSize="9.5" fill="#7A6A45" letterSpacing="2.2">{label.sub}</text>}
            </>}
      </g>
    </svg>
  );
}
