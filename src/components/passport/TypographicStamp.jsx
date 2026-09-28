import React, { useId } from "react";
import { fmtStampDate } from "@/lib/airportStamp";
import { typographicStampConfig } from "@/lib/stampDesign";

// ============================================================================
// TypographicStamp — a borderless, type-only passport stamp rendered in-app from
// data. No illustration, no upload, no release: every destination gets a real
// stamp the day it lands in the database, which is what makes "top spots per
// city" affordable at all.
//
// Eight layouts, picked deterministically per place (see stampDesign.js) so a
// filled passport looks stamped by many hands rather than by one machine. Ink is
// the documented region colour, so these sit beside the commissioned landmark art
// without clashing. This is what renders instead of the 🛂 emoji when a place has
// no art on R2 yet — and it silently steps aside once art lands.
//
// TWO LAYERS (founder call): the FRAME — stars, rules, city, region, date — takes
// the distressed rubber-stamp filter, but the DESTINATION NAME prints SOLID, full
// ink, no fade. Airport stamps keep their all-over distress; this rule is for
// destinations. Every design below returns { frame, name } to enforce it.
//
// Props: name, city, region, country, date, width, overprint, design, ink,
// strength (ink B = 2), film ({ title, year } → the Scene layout).
// ============================================================================

const SERIF = "Georgia, 'Times New Roman', serif";

// Greedy wrap into at most maxLines, balanced by character count so a two-line
// name doesn't come out as one long line and one short one.
function wrapWords(name, maxLines) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  if (words.length <= maxLines) return words;
  const target = words.join(" ").length / maxLines;
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > target * 1.25 && lines.length < maxLines - 1) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

const longestOf = (lines) => lines.reduce((m, l) => Math.max(m, l.length), 1);
// Georgia bold caps average ~0.62em of advance, so this keeps the longest line
// inside `box` without measuring text (which SVG can't do before paint).
const fitSize = (lines, box, max) => Math.min(max, box / (longestOf(lines) * 0.62));

// Stack of centred lines, vertically centred on `mid`.
function Lines({ lines, size, mid, ls = 0, x = 150, anchor = "middle" }) {
  const step = size * 1.16;
  const top = mid - ((lines.length - 1) * step) / 2;
  return lines.map((l, i) => (
    <text key={i} x={x} y={top + i * step} textAnchor={anchor} fontFamily={SERIF}
      fontSize={size} fontWeight="700" letterSpacing={ls} fill="currentColor">{l}</text>
  ));
}

// strength (founder, 2026-09-28, after the first Instagram story): the frame
// text — VISITED, city · country, the date — read too small and too worn, and
// "I was here!" too faint. 0 keeps the original worn look; 1–3 set the frame
// text larger (capped to the stamp's width so long cities never overflow),
// track it tighter, lighten the wear, and print the strike SOLID crimson.
export const STAMP_STRENGTH = [
  { size: 1,    track: 1,    wear: "-1.5 1.28", strike: 17, strikeWorn: true,  strikeOpacity: 0.85, rule: 1.2 },
  { size: 1.25, track: 0.8,  wear: "-1.1 1.4",  strike: 20, strikeWorn: false, strikeOpacity: 1,    rule: 1.5 },
  { size: 1.42, track: 0.7,  wear: "-0.85 1.4", strike: 22, strikeWorn: false, strikeOpacity: 1,    rule: 1.7 },
  { size: 1.6,  track: 0.6,  wear: "-0.6 1.35", strike: 24, strikeWorn: false, strikeOpacity: 1,    rule: 1.9 },
];

export default function TypographicStamp({
  name, city, region, country, date, entityId,
  width = 200, overprint = false, design, ink, strength = 0, film = null,
}) {
  const S = STAMP_STRENGTH[Math.max(0, Math.min(STAMP_STRENGTH.length - 1, Number(strength) || 0))];
  // Frame text size + tracking for this strength, never wider than `box`
  // (Georgia bold caps ≈ 0.62em advance) and never smaller than the original.
  const ft = (base, ls, str, box = 262) => {
    const n = Math.max(1, String(str || "").length);
    const track = ls * S.track;
    const cap = (box - track * (n - 1)) / (n * 0.62);
    const size = Math.max(Math.min(base, cap), Math.min(base * S.size, cap));
    return { fontSize: +size.toFixed(2), letterSpacing: +track.toFixed(2) };
  };
  const raw = useId();
  const uid = String(raw).replace(/:/g, "");
  const worn = `tw-${uid}`;
  const arcT = `taT-${uid}`, arcB = `taB-${uid}`;
  const ovT = `toT-${uid}`, ovB = `toB-${uid}`;

  const cfg = typographicStampConfig({ entityId: entityId || name, name, country });
  // A filming-location stamp always takes the Scene layout (founder-approved
  // mockup, 2026-09-28): film strips top and bottom, ★ FILMED HERE ★.
  const D = film && film.title ? "scn" : (design || cfg.design);
  const INK = ink || cfg.ink;

  const CITY = String(city || "").toUpperCase();
  const REGION = String(region || "").toUpperCase();
  const CTRY = String(country || "").toUpperCase();
  const dateStr = fmtStampDate(date);
  // City and region both present makes a natural top line; otherwise use whichever.
  const PLACE_LINE = [REGION || CTRY].filter(Boolean).join("");
  const TOP = CITY || CTRY;

  // Every design: { frame, name } — frame gets the worn filter, name stays solid.
  const body = {
    col: (() => {
      const lines = wrapWords(name, 4);
      const size = fitSize(lines, 214, 27);
      return {
        name: <Lines lines={lines} size={size} mid={176} />,
        frame: (<>
          <text x="150" y="70" textAnchor="middle" fontFamily={SERIF} {...ft(13, 1.6, `★ ★ ★`, 262)} fontWeight="700" fill="currentColor">★ ★ ★</text>
          {TOP && <text x="150" y="100" textAnchor="middle" fontFamily={SERIF} {...ft(13.5, 5, `${TOP}`, 262)} fontWeight="700" fill="currentColor">{TOP}</text>}
          <path d="M64,114 L236,114" stroke="currentColor" strokeWidth="1.4" />
          <path d="M150,108 L156,114 L150,120 L144,114 Z" fill="currentColor" />
          <path d="M64,232 L236,232" stroke="currentColor" strokeWidth="2.6" />
          {PLACE_LINE && <text x="150" y="252" textAnchor="middle" fontFamily={SERIF} {...ft(11.5, 3, `${PLACE_LINE}`, 262)} fontWeight="700" fill="currentColor">{PLACE_LINE}</text>}
          {dateStr && <text x="150" y="274" textAnchor="middle" fontFamily={SERIF} {...ft(13, 2.2, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),

    rng: (() => {
      const lines = wrapWords(name, 2);
      const size = fitSize(lines, 152, 27);
      return {
        name: <Lines lines={lines} size={size} mid={156} />,
        frame: (<>
          {TOP && <text fontFamily={SERIF} {...ft(12.5, 3.2, `${TOP}${REGION ? ` · ${REGION}` : ""}`, 300)} fontWeight="700" fill="currentColor"><textPath href={`#${arcT}`} startOffset="50%" textAnchor="middle">{TOP}{REGION ? ` · ${REGION}` : ""}</textPath></text>}
          <text fontFamily={SERIF} {...ft(11.5, 4.5, `★ ${CTRY || "VISITED"} ★`, 300)} fontWeight="700" fill="currentColor"><textPath href={`#${arcB}`} startOffset="50%" textAnchor="middle">★ {CTRY || "VISITED"} ★</textPath></text>
          {dateStr && <>
            <rect x="104" y="188" width="92" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <text x="150" y="202" textAnchor="middle" fontFamily={SERIF} {...ft(11.5, 1.6, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>
          </>}
        </>),
      };
    })(),

    ban: (() => {
      const lines = wrapWords(name, 3);
      const size = fitSize(lines, 226, 29);
      return {
        name: <Lines lines={lines} size={size} mid={166} />,
        frame: (<>
          {TOP && <text x="150" y="92" textAnchor="middle" fontFamily={SERIF} {...ft(12.5, 4.5, `${TOP}`, 262)} fontWeight="700" fill="currentColor">{TOP}</text>}
          <path d="M40,110 L260,110" stroke="currentColor" strokeWidth="3.2" />
          <path d="M40,118 L260,118" stroke="currentColor" strokeWidth="1.2" />
          <path d="M40,206 L260,206" stroke="currentColor" strokeWidth="1.2" />
          <path d="M40,214 L260,214" stroke="currentColor" strokeWidth="3.2" />
          {PLACE_LINE && <text x="150" y="238" textAnchor="middle" fontFamily={SERIF} {...ft(12, 2.6, `${PLACE_LINE}`, 262)} fontWeight="700" fill="currentColor">{PLACE_LINE}</text>}
          {dateStr && <text x="150" y="264" textAnchor="middle" fontFamily={SERIF} {...ft(13.5, 2.2, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),

    jst: (() => {
      const lines = wrapWords(name, 3);
      const size = fitSize(lines, 188, 30);
      const step = 48;
      const top = 150 - ((lines.length - 1) * step) / 2;
      // Track each line out to one common measure — the letterpress-bill look.
      const lsFor = (l) => Math.max(0, Math.min(18, (188 - l.length * size * 0.62) / Math.max(1, l.length - 1)));
      return {
        name: lines.map((l, i) => (
          <text key={i} x={150 + lsFor(l) / 2} y={top + i * step} textAnchor="middle" fontFamily={SERIF} fontSize={size} fontWeight="700" letterSpacing={lsFor(l)} fill="currentColor">{l}</text>
        )),
        frame: (<>
          {TOP && <text x="150" y="78" textAnchor="middle" fontFamily={SERIF} {...ft(11.5, 4, `${TOP}`, 262)} fontWeight="700" fill="currentColor">{TOP}</text>}
          <path d="M56,92 L244,92" stroke="currentColor" strokeWidth="1.3" />
          {lines.map((l, i) => (
            <path key={i} d={`M56,${top + i * step + 14} L244,${top + i * step + 14}`} stroke="currentColor" strokeWidth=".9" />
          ))}
          <text x="150" y={top + (lines.length - 1) * step + 44} textAnchor="middle" fontFamily={SERIF} {...ft(11, 3, `★ ${CTRY || "VISITED"} ★`, 262)} fontWeight="700" fill="currentColor">★ {CTRY || "VISITED"} ★</text>
          {dateStr && <text x="150" y={top + (lines.length - 1) * step + 66} textAnchor="middle" fontFamily={SERIF} {...ft(12.5, 2.2, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),

    ldg: (() => {
      const lines = wrapWords(name, 3);
      const size = fitSize(lines, 208, 26);
      const top = 138;
      const step = size * 1.2;
      const endY = top + (lines.length - 1) * step;
      return {
        name: <Lines lines={lines} size={size} mid={top + ((lines.length - 1) * step) / 2} x={46} anchor="start" />,
        frame: (<>
          <text x="46" y="88" fontFamily={SERIF} {...ft(11, 3.4, `VISITED`, 262)} fontWeight="700" fill="currentColor">VISITED</text>
          <path d="M46,100 L254,100" stroke="currentColor" strokeWidth="1.2" />
          <path d={`M46,${endY + 16} L254,${endY + 16}`} stroke="currentColor" strokeWidth="1.2" />
          <text x="46" y={endY + 40} fontFamily={SERIF} {...ft(12, 2.6, `${[CITY, CTRY].filter(Boolean).join(" · ")}`, 208)} fontWeight="700" fill="currentColor">{[CITY, CTRY].filter(Boolean).join(" · ")}</text>
          {dateStr && <>
            {/* Date box stacked UNDER the city line (2026-09-28): side by side, a
                long city ("BARCELONA · SPAIN") ran into the box even at the old size. */}
            <rect x="46" y={endY + 50} width="112" height="22" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text x="102" y={endY + 65} textAnchor="middle" fontFamily={SERIF} {...ft(12, 1.4, `${dateStr}`, 104)} fontWeight="700" fill="currentColor">{dateStr}</text>
          </>}
          <path d={`M46,${endY + (dateStr ? 86 : 60)} L254,${endY + (dateStr ? 86 : 60)}`} stroke="currentColor" strokeWidth="3" />
        </>),
      };
    })(),

    spl: (() => {
      const lines = wrapWords(name, 2);
      const size = fitSize(lines, 226, 31);
      return {
        name: <Lines lines={lines} size={size} mid={192} />,
        frame: (<>
          {TOP && <text x="150" y="96" textAnchor="middle" fontFamily={SERIF} {...ft(12, 4, `${TOP}`, 262)} fontWeight="700" fill="currentColor">{TOP}</text>}
          <path d="M34,138 L104,138" stroke="currentColor" strokeWidth="2.4" />
          <path d="M196,138 L266,138" stroke="currentColor" strokeWidth="2.4" />
          <path d="M118,132 L124,138 L118,144 L112,138 Z" fill="currentColor" />
          <path d="M182,132 L188,138 L182,144 L176,138 Z" fill="currentColor" />
          <text x="150" y="143" textAnchor="middle" fontFamily={SERIF} {...ft(12, 1, `★`, 262)} fontWeight="700" fill="currentColor">★</text>
          <path d="M60,244 L240,244" stroke="currentColor" strokeWidth="2.6" />
          <text x="150" y="266" textAnchor="middle" fontFamily={SERIF} {...ft(11, 2.4, `${[PLACE_LINE, dateStr].filter(Boolean).join(" · ")}`, 262)} fontWeight="700" fill="currentColor">{[PLACE_LINE, dateStr].filter(Boolean).join(" · ")}</text>
        </>),
      };
    })(),

    ovl: (() => {
      const lines = wrapWords(name, 3);
      const size = fitSize(lines, 178, 23);
      return {
        name: <Lines lines={lines} size={size} mid={150} />,
        frame: (<>
          {TOP && <text fontFamily={SERIF} {...ft(12, 3, `${TOP}${CTRY ? ` · ${CTRY}` : ""}`, 300)} fontWeight="700" fill="currentColor"><textPath href={`#${ovT}`} startOffset="50%" textAnchor="middle">{TOP}{CTRY ? ` · ${CTRY}` : ""}</textPath></text>}
          <text fontFamily={SERIF} {...ft(11, 4.5, `★ VISITED ★`, 300)} fontWeight="700" fill="currentColor"><textPath href={`#${ovB}`} startOffset="50%" textAnchor="middle">★ VISITED ★</textPath></text>
          <path d="M108,184 L192,184" stroke="currentColor" strokeWidth="1.3" />
          {dateStr && <text x="150" y="204" textAnchor="middle" fontFamily={SERIF} {...ft(12, 1.8, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),

    scn: (() => {
      // Scene: film strip · ★ FILMED HERE ★ · the place (solid) · TITLE · YEAR ·
      // CITY · COUNTRY · date · film strip. Two-line place names lift the top
      // line so nothing collides.
      const lines = wrapWords(name, 2);
      const two = lines.length > 1;
      const size = fitSize(lines, 226, two ? 27 : 35);
      const perf = [37, 263].flatMap((y) => Array.from({ length: 12 }, (_, i) => <rect key={`${y}-${i}`} x={39 + i * 19} y={y} width="10" height="9" rx="2" fill="currentColor" />));
      const title = String(film?.title || "").toUpperCase();
      const filmLine = film?.year ? `${title} · ${film.year}` : title;
      // Long titles wrap onto two lines, the year on the second, instead of
      // shrinking to unreadable ("THE FELLOWSHIP / OF THE RING · 2001").
      const wrapTitle = filmLine.length > 22;
      const tl = wrapTitle ? wrapWords(title, 2) : [filmLine];
      if (wrapTitle && tl.length === 1) tl.push("");
      if (wrapTitle && film?.year) tl[tl.length - 1] = `${tl[tl.length - 1]} · ${film.year}`.replace(/^ · /, "");
      const base = two ? 177 : 170;   // the rule under the place name
      const yFilm = wrapTitle ? [base + 20, base + 37] : [base + (two ? 23 : 26)];
      const yPlace = wrapTitle ? base + 55 : 221;
      const yDate = wrapTitle ? base + 72 : 243;
      const place = [CITY, CTRY].filter(Boolean).join(" · ");
      return {
        name: <Lines lines={lines} size={size} mid={two ? 147 : 146} />,
        frame: (<>
          <rect x="30" y="30" width="240" height="23" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <rect x="30" y="256" width="240" height="23" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
          {perf}
          <text x="150" y={two ? 94 : 110} textAnchor="middle" fontFamily={SERIF} {...ft(15, 3.4, "★ FILMED HERE ★", 262)} fontWeight="700" fill="currentColor">★ FILMED HERE ★</text>
          <path d={`M70,${two ? 103 : 120} L230,${two ? 103 : 120}`} stroke="currentColor" strokeWidth="1.5" />
          <path d={`M70,${two ? 177 : 170} L230,${two ? 177 : 170}`} stroke="currentColor" strokeWidth="2.6" />
          {tl.map((l, i) => l && <text key={i} x="150" y={yFilm[i]} textAnchor="middle" fontFamily={SERIF} {...ft(wrapTitle ? 16 : 21, wrapTitle ? 2 : 4, l, 236)} fontWeight="700" fill="currentColor">{l}</text>)}
          {place && <text x="150" y={yPlace} textAnchor="middle" fontFamily={SERIF} {...ft(12, 1.2, place, 236)} fontWeight="700" fill="currentColor">{place}</text>}
          {dateStr && <text x="150" y={yDate} textAnchor="middle" fontFamily={SERIF} {...ft(15, 2, dateStr, 236)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),

    mrq: (() => {
      const lines = wrapWords(name, 2);
      const size = fitSize(lines, 236, 42);
      return {
        name: <Lines lines={lines} size={size} mid={155} />,
        frame: (<>
          <text x="150" y="82" textAnchor="middle" fontFamily={SERIF} {...ft(10.5, 4, `★ VISITED ★`, 262)} fontWeight="700" fill="currentColor">★ VISITED ★</text>
          <path d="M78,198 L222,198" stroke="currentColor" strokeWidth="1.3" />
          <text x="150" y="222" textAnchor="middle" fontFamily={SERIF} {...ft(12.5, 2.6, `${[CITY, REGION || CTRY].filter(Boolean).join(" · ")}`, 262)} fontWeight="700" fill="currentColor">{[CITY, REGION || CTRY].filter(Boolean).join(" · ")}</text>
          {dateStr && <text x="150" y="248" textAnchor="middle" fontFamily={SERIF} {...ft(11.5, 1.8, `${dateStr}`, 262)} fontWeight="700" fill="currentColor">{dateStr}</text>}
        </>),
      };
    })(),
  };

  const chosen = body[D] || body.col;

  return (
    <svg viewBox="0 0 300 300" width={width} height={width} style={{ color: INK, display: "block" }}
      role="img" aria-label={`Stamp: ${name}${city ? `, ${city}` : ""}${dateStr ? `, ${dateStr}` : ""}`}>
      <defs>
        <path id={arcT} d="M40,150 A110,110 0 0 1 260,150" />
        <path id={arcB} d="M46,150 A104,104 0 0 0 254,150" />
        <path id={ovT} d="M28,150 A122,84 0 0 1 272,150" />
        <path id={ovB} d="M36,150 A114,76 0 0 0 264,150" />
        <filter id={worn} x="-18%" y="-18%" width="136%" height="136%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.3" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="11" result="g" />
          <feColorMatrix in="g" type="matrix" values={`0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${S.wear}`} result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
      </defs>
      {/* Frame wears like a rubber stamp; the NAME prints solid (founder call). */}
      <g filter={`url(#${worn})`}>{chosen.frame}</g>
      <g>{chosen.name}</g>
      {/* The red second strike (founder call: always crimson, never touching any
          text). Default berth is the empty top-right corner; Ring and Oval carry
          arc text up there, so theirs lands bottom-right instead. Off in a dense
          grid, on where one stamp is the whole screen. */}
      {overprint && (() => {
        // Ring and Oval carry arc text up top, so their strike goes bottom-right;
        // from strength 1 the bigger strike sits lower, in the corner outside
        // the circle, clear of the bottom arc text.
        const low = S.size > 1;
        const pos = D === "rng" || D === "ovl" ? (low ? { x: 240, y: 280 } : { x: 236, y: 258 })
          : D === "scn" ? { x: 150, y: 73 }   // centred in the gap between the top film strip and FILMED HERE
          : { x: 234, y: 52 };
        const tilt = D === "scn" ? -5 : -14;
        return (
          <g filter={S.strikeWorn ? `url(#${worn})` : undefined} opacity={S.strikeOpacity} style={{ color: "#B0472F" }} transform={`rotate(${tilt} ${pos.x} ${pos.y})`}>
            <text x={pos.x} y={pos.y + 2} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={S.strike} fontWeight="700" letterSpacing="0.5" fill="currentColor">I was here!</text>
            {D !== "scn" && <path d={`M${pos.x - S.strike * 2.1},${pos.y + 10 + (S.strike - 17) * 0.35} L${pos.x + S.strike * 2.1},${pos.y + 10 + (S.strike - 17) * 0.35}`} stroke="currentColor" strokeWidth={S.rule} />}
          </g>
        );
      })()}
    </svg>
  );
}
