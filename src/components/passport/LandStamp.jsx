// LandStamp — border-crossing stamps earned on the ground (founder,
// 2026-10-05): deliberately NOT the airport designs. Two templates:
//   state    — a roadside welcome sign: double rule, the state name big, its
//              claim in italics ("The Silver State"), ENTRY/EXIT and the date.
//   country  — a checkpoint: a diagonally striped barrier bar, the country
//              name, BORDER CROSSING, ENTRY/EXIT and the date. No transport
//              words or glyphs — we can't know car from train from ship
//              (founder, 2026-10-05), so the stamp never guesses.
// Same worn + pressed ink treatment as the airport stamps, different bones.
// direction: 'arrival' (prints ENTRY) | 'departure' (prints EXIT).
// via 'air' (founder, 2026-10-24: "for the international airports … departure and arrival"):
//              the country stamp an international airport gives beside its airport stamp, like
//              immigration's: a flight path and plane where the barrier bar was, IMMIGRATION ·
//              <code> (the airport), and ARRIVAL / DEPARTURE in place of ENTRY / EXIT.
import React, { useId } from "react";
import { stateInfo } from "@/lib/stateNicknames";

// Flags (founder, 2026-10-24: "put on state flag when border state to state crossing, for example
// entering california put the enter with california state flag"). The 50 states and DC are bundled
// (src/assets/state-flags/<abbr>.png, 160 px, from Wikimedia Commons — public domain) so a stamp
// shows its flag offline too; England, Scotland and Wales print their emoji flags, a country stamp
// its country's. The flag is the one thing on the stamp in colour, framed in the stamp's ink.
const STATE_FLAGS = Object.fromEntries(Object.entries(import.meta.glob("/src/assets/state-flags/*.png", { eager: true, import: "default" }))
  .map(([path, url]) => [path.split("/").pop().replace(/\.png$/, "").toUpperCase(), url]));
const NATION_FLAGS = { England: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", Scotland: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", Wales: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}" };
const countryFlag = (cc) => (/^[a-z]{2}$/i.test(cc || "") ? String.fromCodePoint(...[...String(cc).toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : null);

const INKS = ["#274268", "#7E1C28", "#2E5A3A", "#24316B", "#5A3A1E", "#232323"];
const hash = (s) => { let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export default function LandStamp({ template = "country", name, sub = null, countryCode: cc = "", date, direction = null, via = null, code = null, width = 320 }) {
  const raw = useId();
  const uid = String(raw).replace(/[:]/g, "");
  const serif = "Georgia, 'Times New Roman', serif";
  const ink = INKS[hash(`${template}:${name}`) % INKS.length];
  const dep = direction === "departure";
  const air = via === "air" && template === "country";
  const WORD = direction ? (air ? (dep ? "DEPARTURE" : "ARRIVAL") : (dep ? "EXIT" : "ENTRY")) : null;
  const CODE = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const dateStr = (() => {
    const d = new Date(String(date || "").slice(0, 10) + "T00:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "").toUpperCase();
  })();
  const NAME = String(name || "").toUpperCase();
  // Long names step down so they stay inside the frame (MASSACHUSETTS and UNITED STATES ran over).
  const nameSize = NAME.length > 16 ? 20 : NAME.length > 12 ? 26 : NAME.length > 10 ? 32 : 38;
  const info = template === "state" ? stateInfo(name) : null;
  const claim = sub || info?.nickname || null;
  const flagUrl = info?.abbr ? STATE_FLAGS[info.abbr] || null : null;
  const flagText = template === "state" ? (flagUrl ? null : NATION_FLAGS[String(name || "").trim()] || null) : countryFlag(cc);
  const H = Math.round((width * 224) / 340);
  const worn = `lworn-${uid}`, press = `lpress-${uid}`, stripes = `lbar-${uid}`;
  return (
    <svg viewBox="0 0 340 224" width={width} height={H} style={{ color: ink, display: "block" }} role="img"
      aria-label={`${WORD ? `${WORD.toLowerCase()} ` : ""}${template === "state" ? "state line" : air ? "immigration" : "border"} stamp: ${name}${air && CODE ? ` ${CODE}` : ""}, ${dateStr}`}>
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
            {flagUrl || flagText ? null : <><circle cx="46" cy="52" r="5" fill="currentColor" /><circle cx="294" cy="52" r="5" fill="currentColor" /></>}
          </g>
          {/* The state's flag in the sign's top-left corner, beside ★ ENTRY ★ (2026-10-24). */}
          {flagUrl ? (
            <g>
              <image href={flagUrl} x="40" y="42" width="36" height="24" preserveAspectRatio="xMidYMid slice" opacity="0.95" />
              <rect x="40" y="42" width="36" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </g>
          ) : flagText ? <text x="58" y="66" textAnchor="middle" fontSize="24">{flagText}</text> : null}
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
            {air ? (
              // A flight path across the top, the plane mid-way, where the barrier bar was.
              <>
                <line x1="40" y1="45" x2="146" y2="45" stroke="currentColor" strokeWidth="1.8" strokeDasharray="5 5" />
                <line x1="194" y1="45" x2="300" y2="45" stroke="currentColor" strokeWidth="1.8" strokeDasharray="5 5" />
                {/* An airliner, nose to the right (Material "flight" glyph, Apache-2.0). */}
                <path transform="translate(156 31) scale(1.17) rotate(90 12 12)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor" />
              </>
            ) : (
              <rect x="30" y="32" width="280" height="26" rx="5" fill={`url(#${stripes})`} stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
            )}
            <rect x="30" y="160" width="280" height="1.6" fill="currentColor" opacity="0.7" />
            <circle cx="300" cy="182" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M294,182 L299,187 L307,176" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g filter={`url(#${press})`}>
            <text x="170" y={NAME.length > 14 ? 96 : 100} textAnchor="middle" fontFamily={serif} fontSize={nameSize} fontWeight="700" letterSpacing="1" fill="currentColor">{NAME}</text>
            <text x="170" y="122" textAnchor="middle" fontFamily={serif} fontSize="11" fontWeight="700" letterSpacing="2.5" fill="currentColor">
              {air ? `IMMIGRATION${CODE ? ` · ${CODE}` : ""}` : `BORDER CROSSING${cc ? ` · ${String(cc).toUpperCase()}` : ""}`}
            </text>
            {WORD && <text x="170" y="146" textAnchor="middle" fontFamily={serif} fontSize="15" fontWeight="700" letterSpacing="4" fill="currentColor">★ {WORD} ★</text>}
            <text x="196" y="186" textAnchor="middle" fontFamily={serif} fontSize="12" fontWeight="700" letterSpacing="1.5" fill="currentColor">{dateStr}</text>
          </g>
          {/* The country's flag in the bottom-left corner (2026-10-24). */}
          {flagText ? <text x="58" y="194" textAnchor="middle" fontSize="28">{flagText}</text> : null}
        </>
      )}
    </svg>
  );
}
