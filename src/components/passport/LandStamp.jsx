// LandStamp — border-crossing stamps earned on the ground (founder,
// 2026-10-05): deliberately NOT the airport designs. Two templates:
//   state    — a roadside welcome sign: double rule, the state name big, its
//              claim in italics ("The Silver State"), ENTRY/EXIT and the date.
//   country  — a checkpoint: a diagonally striped barrier bar, the country
//              name, LAND BORDER / RAILWAY CROSSING / PORT OF ENTRY by mode,
//              ENTRY/EXIT and the date, with a car / train / ship glyph.
// Same worn + pressed ink treatment as the airport stamps, different bones.
// direction: 'arrival' (prints ENTRY) | 'departure' (prints EXIT).
import React, { useId } from "react";
import { stateInfo } from "@/lib/stateNicknames";

const INKS = ["#274268", "#7E1C28", "#2E5A3A", "#24316B", "#5A3A1E", "#232323"];
const hash = (s) => { let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const MODE_WORD = { car: "LAND BORDER", train: "RAILWAY CROSSING", ship: "PORT OF ENTRY" };

const glyph = {
  car: "M6,16 L9,9 Q10,7 13,7 L23,7 Q26,7 27,9 L30,16 L33,16 Q35,16 35,18 L35,21 L31,21 A4,4 0 0 1 23,21 L13,21 A4,4 0 0 1 5,21 L1,21 L1,18 Q1,16 3,16 Z M11,10 L9.5,15 L17,15 L17,10 Z M19,10 L19,15 L26.5,15 L25,10 Z",
  train: "M8,4 Q8,1 11,1 L25,1 Q28,1 28,4 L28,16 Q28,19 25,19 L11,19 Q8,19 8,16 Z M11,5 L25,5 L25,10 L11,10 Z M12,22 L24,22 L26,26 L10,26 Z",
  ship: "M6,14 L30,14 L26,21 L10,21 Z M16,5 L21,5 L21,9 L25,9 L25,14 L12,14 L12,9 L16,9 Z M2,24 Q5,21.5 8,24 Q11,26.5 14,24 Q17,21.5 20,24 Q23,26.5 26,24 Q29,21.5 32,24",
};

export default function LandStamp({ template = "country", name, sub = null, countryCode: cc = "", date, direction = null, mode = null, width = 320 }) {
  const raw = useId();
  const uid = String(raw).replace(/[:]/g, "");
  const serif = "Georgia, 'Times New Roman', serif";
  const ink = INKS[hash(`${template}:${name}`) % INKS.length];
  const dep = direction === "departure";
  const WORD = direction ? (dep ? "EXIT" : "ENTRY") : null;
  const dateStr = (() => {
    const d = new Date(String(date || "").slice(0, 10) + "T00:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "").toUpperCase();
  })();
  const NAME = String(name || "").toUpperCase();
  const nameSize = NAME.length > 14 ? 26 : NAME.length > 10 ? 32 : 38;
  const info = template === "state" ? stateInfo(name) : null;
  const claim = sub || info?.nickname || null;
  const H = Math.round((width * 224) / 340);
  const worn = `lworn-${uid}`, press = `lpress-${uid}`, stripes = `lbar-${uid}`;
  const modeKey = glyph[mode] ? mode : "car";
  const g = (x, y, s) => (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={glyph[modeKey]} fill="currentColor" fillRule="evenodd" />
    </g>
  );
  return (
    <svg viewBox="0 0 340 224" width={width} height={H} style={{ color: ink, display: "block" }} role="img"
      aria-label={`${WORD ? `${WORD.toLowerCase()} ` : ""}${template === "state" ? "state line" : "border"} stamp: ${name}, ${dateStr}`}>
      <defs>
        <filter id={worn} x="-16%" y="-16%" width="132%" height="132%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="gr" />
          <feColorMatrix in="gr" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.28" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
        <filter id={press} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
        <pattern id={stripes} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="18" fill="currentColor" />
        </pattern>
      </defs>
      {template === "state" ? (
        <>
          <g filter={`url(#${worn})`}>
            {/* The welcome sign: a wide board on two posts. */}
            <rect x="18" y="26" width="304" height="152" rx="16" fill="none" stroke="currentColor" strokeWidth="4.5" />
            <rect x="27" y="35" width="286" height="134" rx="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <line x1="76" y1="178" x2="76" y2="206" stroke="currentColor" strokeWidth="7" />
            <line x1="264" y1="178" x2="264" y2="206" stroke="currentColor" strokeWidth="7" />
            <line x1="62" y1="206" x2="90" y2="206" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="250" y1="206" x2="278" y2="206" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="46" cy="52" r="5" fill="currentColor" /><circle cx="294" cy="52" r="5" fill="currentColor" />
          </g>
          <g filter={`url(#${press})`}>
            <text x="170" y="60" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="3" fill="currentColor">
              {WORD ? `★ ${WORD} ★` : "★ WELCOME ★"}
            </text>
            <text x="170" y={claim ? 101 : 110} textAnchor="middle" fontFamily={serif} fontSize={nameSize} fontWeight="700" letterSpacing="1" fill="currentColor">{NAME}</text>
            {claim && <text x="170" y="126" textAnchor="middle" fontFamily={serif} fontStyle="italic" fontSize="14.5" fill="currentColor">{claim}</text>}
            <text x="170" y={claim ? 150 : 140} textAnchor="middle" fontFamily={serif} fontSize="11.5" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
            <text x="170" y={claim ? 164 : 158} textAnchor="middle" fontFamily={serif} fontStyle="italic" fontSize="11" fill="currentColor">I was here!</text>
          </g>
        </>
      ) : (
        <>
          <g filter={`url(#${worn})`}>
            {/* The checkpoint: a heavy frame under a striped barrier bar. */}
            <rect x="20" y="22" width="300" height="180" rx="10" fill="none" stroke="currentColor" strokeWidth="4.5" />
            <rect x="30" y="32" width="280" height="26" rx="5" fill={`url(#${stripes})`} stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
            <rect x="30" y="160" width="280" height="1.6" fill="currentColor" opacity="0.7" />
            {g(36, 168, 1.05)}
            <circle cx="300" cy="182" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M294,182 L299,187 L307,176" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g filter={`url(#${press})`}>
            <text x="170" y={NAME.length > 14 ? 96 : 100} textAnchor="middle" fontFamily={serif} fontSize={nameSize} fontWeight="700" letterSpacing="1" fill="currentColor">{NAME}</text>
            <text x="170" y="122" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="2.5" fill="currentColor">
              {MODE_WORD[modeKey]}{cc ? ` · ${String(cc).toUpperCase()}` : ""}
            </text>
            {WORD && <text x="170" y="146" textAnchor="middle" fontFamily={serif} fontSize="15" fontWeight="700" letterSpacing="4" fill="currentColor">★ {WORD} ★</text>}
            <text x="226" y="186" textAnchor="middle" fontFamily={serif} fontSize="12" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
          </g>
        </>
      )}
    </svg>
  );
}
