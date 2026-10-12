import React, { useId, useMemo } from "react";
import { fmtStampDate } from "@/lib/airportStamp";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import { STAMP_STRENGTH } from "@/components/passport/TypographicStamp";

// ============================================================================
// LocalFavoriteStamp — the stamp an approved suggested place prints (founder,
// 2026-10-12, "Suggest a Place to Stamp"). Locals and people who've been
// suggest a spot; once 5 have and the founder approves it, it becomes a Local
// favorite: its own round teal stamp, NEVER the official icon art or the
// typographic stamp, so a community pick is never mistaken for an icon.
//
// The approved mockup (LocalFavorite.dc.html): a 3px teal ring, a dashed inner
// ring, LOCAL FAVORITE along the top, the name in Instrument Serif in the
// centre, the city in small caps under it, RECOMMENDED BY LOCALS along the
// bottom, the whole stamp tilted −6°. A stamp in the passport adds its date.
//
// Ink follows the house rules: the rings and ring words wear like a rubber
// stamp (TypographicStamp's wear at `strength`), the city and date print at
// full ink with only a pressed edge (the airport rule, 2026-10-01), and the
// NAME prints solid (the destination rule).
//
// Props: name, city, country, date, width, strength (default STAMP_INK_STRENGTH).
// ============================================================================

// A stamp minted from an approved suggestion carries the id lf:<placeId>,
// which the worker checks against an approved place before it mints the
// stamp. Only that id earns the look (2026-10-12): entity_type
// 'local_favorite' is just a label anyone could send (the worker now clears a
// forged one too).
export const isLocalFavorite = (s) => !!s && /^lf:\d{1,12}$/.test(String(s.entity_id || ""));

// The line every Local favorite discloses (founder, 2026-10-12): how many
// people who've been there had recommended the place when this stamp was
// earned (meta.local_favorite.count). The booklet prints it under the stamp,
// so shared images carry it too; the stamp's card shows it in a chip.
export const localFavoriteLine = (s) => {
  const n = Math.floor(Number(s?.meta?.local_favorite?.count));
  if (!(n >= 1)) return "Recommended by people who’ve been there";
  return `Recommended by ${n.toLocaleString("en-US")} ${n === 1 ? "person who’s" : "people who’ve"} been there`;
};

const TEAL = "#0E7C73";       // the mockup's teal: rings, ring words, city, date
const NAME_INK = "#0F1419";   // the name prints near-black, as in the mockup
// Georgia is the fallback on purpose: a shared page is drawn by html2canvas,
// which turns this SVG into an image where the app's web fonts don't load, so
// the widths below are Georgia's and the name never overruns the ring there.
// On screen Instrument Serif sets narrower, which only leaves a little air.
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif';

// Geometry in a 300-unit box, like the other stamps (at width 210 it is the
// mockup's size: 1 mockup px ≈ 1.43 units).
const C = 150;
const R_RING = 141, R_DASH = 125;   // the solid ring and the dashed ring inside it
const R_TOP = 106.5;                // LOCAL FAVORITE's baseline (capitals rise outward)
const R_BOT = 118;                  // RECOMMENDED BY LOCALS' baseline (capitals rise inward)
const R_STAR = 113;                 // a star at either side, between the ring words
const R_CLEAR = 104;                // the clear circle the name, city and date sit in
const KICKER = { size: 16, ls: 3.2 };     // the mockup's 11px, tracked .2em
const FOOTER = { size: 14.5, ls: 1.5 };   // the mockup's 10px, tracked .1em
const PLACE = { size: 15, min: 8.5, ls: 0.18 };  // LOS ANGELES — 10.5px, tracked .18em
const DATE = { size: 13.5, ls: 0.12 };
const NAME_MAX = [0, 44, 39, 33];  // by line count (the mockup's 27px ≈ 39)
const NAME_MIN = 14;
// A name goes under NAME_MIN only when no layout fits it there, down to this;
// past it, the line that still runs over ends in "…".
const NAME_FLOOR = 8;
// What a line break inside a CJK word costs: the layout's size counts for this
// much less per such break, so 東京 / スカイツリー beats 東京スカ / イツリー.
const MID_WORD = 0.8;

// A dash pattern that closes exactly around the ring: no doubled dash at the seam.
const DASH = (() => { const per = (2 * Math.PI * R_DASH) / 64; return `${(per * 0.55).toFixed(2)} ${(per * 0.45).toFixed(2)}`; })();
const star = (cx, cy, ro = 5.5, ri = 2.3) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
  return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");
const STARS = [star(C - R_STAR, C), star(C + R_STAR, C)];

// Advance widths in em, close to Georgia's (see SERIF), and for bold capitals
// in Inter Tight or the system sans. SVG can't measure text before it paints,
// so every fit below is worked out from these.
const serifEm = (ch) => {
  if (ch === " ") return 0.25;
  if (ch === "…") return 0.82;
  if ("ijl.,:;'’|!".includes(ch)) return 0.28;
  if ("frtI-()[]/".includes(ch)) return 0.37;
  if ("mwMW@&".includes(ch)) return 0.86;
  if (/[A-Z]/.test(ch)) return 0.7;
  if (/[0-9]/.test(ch)) return 0.56;
  if (/[a-z]/.test(ch)) return 0.53;
  return ch.codePointAt(0) >= 0x2e80 ? 1 : 0.6;   // CJK sets square
};
const capsEm = (ch) => (ch === " " ? 0.26 : "I·.,'’:".includes(ch) ? 0.32 : "MW".includes(ch) ? 0.9
  : /[0-9]/.test(ch) ? 0.62 : ch.codePointAt(0) >= 0x2e80 ? 1 : 0.7);
// Accented Latin letters (U+00C0–U+024F) measure as their base letter ("É" as "E").
const base = (ch) => { const c = ch.codePointAt(0); return c >= 0xc0 && c <= 0x24f ? ch.normalize("NFD")[0] : ch; };
// Marks that sit on the letter before them (Thai vowels and tone marks, a
// combining accent) and the invisible joiners take no width.
const ZERO_W = /[\p{Mn}\p{Me}\u200B-\u200D\u2060\uFEFF]/u;
const charEm = (ch, fn) => (ZERO_W.test(ch) ? 0 : fn(base(ch)));
const emOf = (s, fn) => [...String(s || "")].reduce((w, ch) => w + charEm(ch, fn), 0);
const capsWidth = (s, size, ls) => (emOf(s, capsEm) + ls * Math.max(0, [...String(s || "")].length - 1)) * size;
// The biggest size ≤ max that sets these capitals inside `room`, or null under min.
const capsFit = (s, max, min, ls, room) => {
  const per = capsWidth(s, 1, ls);
  const size = per > 0 ? Math.min(max, room / per) : max;
  return size >= min ? size : null;
};
// How far either side of centre a line may run: the clear circle's half-chord
// at whichever edge of the line's box [y0, y1] is farther from the centre.
const halfAt = (y0, y1) => {
  const d = Math.max(Math.abs(y0 - C), Math.abs(y1 - C));
  return d >= R_CLEAR ? 0 : Math.sqrt(R_CLEAR * R_CLEAR - d * d) - 3;
};

// Baselines top to bottom (the name's lines, the place, the date) with the
// block centred on the stamp. Name lines step 1.04em (the mockup sets 1).
function stack(n, f, hasPlace, hasDate) {
  const names = Array.from({ length: n }, (_, i) => i * f * 1.04);
  const top = n ? -0.74 * f : 0;
  let bottom = n ? names[n - 1] + 0.22 * f : 0;
  let placeY = null, dateY = null;
  if (hasPlace) { placeY = bottom + (n ? 8 : 0) + 0.72 * PLACE.size; bottom = placeY; }
  if (hasDate) { dateY = bottom + (hasPlace ? 6 : n ? 8 : 0) + 0.72 * DATE.size; bottom = dateY; }
  const shift = C - (top + bottom) / 2;
  return { names: names.map((y) => y + shift), placeY: placeY == null ? null : placeY + shift, dateY: dateY == null ? null : dateY + shift };
}
// ems: each name line's width in em.
function fits(ems, f, need) {
  const s = stack(ems.length, f, need.place, need.date);
  for (let i = 0; i < ems.length; i++) {
    if ((ems[i] * f) / 2 > halfAt(s.names[i] - 0.74 * f, s.names[i] + 0.22 * f)) return false;
  }
  if (need.place && need.placeW / 2 > halfAt(s.placeY - 0.72 * PLACE.size, s.placeY)) return false;
  if (need.date && need.dateW / 2 > halfAt(s.dateY - 0.72 * DATE.size, s.dateY)) return false;
  return true;
}
// The biggest size in [lo, hi] the lines fit at, or null when they don't fit at lo.
function sizeIn(ems, need, lo, hi) {
  if (!fits(ems, lo, need)) return null;
  for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if (fits(ems, mid, need)) lo = mid; else hi = mid; }
  return lo;
}

// Where a name may break between lines (2026-10-12): at its spaces, and
// inside the scripts that run words together. Chinese, Japanese and Korean
// break between any two characters (code points from U+2E80), except where a
// Japanese line may not begin (、。ー, small kana, a closing bracket) or end
// (an opening bracket). Thai, Lao, Burmese and Khmer break only between words,
// as the browser's word segmenter finds them, or between letters where there
// is no segmenter (never after a leading vowel, never before SARA AM).
// Brackets and quotes go by their Unicode class (2026-10-12), so the ASCII
// ones count too: 金閣寺(鹿苑寺) used to print 金閣寺( / 鹿苑寺). Inside a word
// no line ends on an opening one (Ps, Pi) or starts with a closing one (Pe,
// Pf) or ,.!?:; and the point before an opening bracket is a clean break
// (OPEN), so the name sets 金閣寺 / (鹿苑寺). After a Latin letter, too, when
// the letter right after the bracket is CJK or Thai (2026-10-12): KFC(王府井店)
// printed KFC(王 / 府井店) and now sets KFC / (王府井店) — and Starbucks(3号店)
// sets Starbucks / (3号店): what the bracket holds counts, up to its closing
// bracket, so ABC(DEF)東京 still keeps ABC(DEF) together.
const NO_START = /^[\p{Pe}\p{Pf},.!?:;、。，．・：；？！ー々〻ゝゞヽヾぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ〜～｡､･ｰｧ-ｯ\u0E33\u0E45\u0EB3]/u;
const NO_END = /[\p{Ps}\p{Pi}\u0E40-\u0E44\u0EC0-\u0EC4]$/u;
const OPEN = /^[\p{Ps}\p{Pi}]/u;
const CLOSE = /^[\p{Pe}\p{Pf}]/u;
const SA = /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF]/u;   // Thai, Lao, Burmese, Khmer
const RUN_ON = /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u2E80-\u{10FFFF}]/u;
const SEG = (() => {
  try { return { char: new Intl.Segmenter(undefined, { granularity: "grapheme" }), word: new Intl.Segmenter(undefined, { granularity: "word" }) }; }
  catch { return null; }
})();
// The letters of a word as the screen draws them (a base and its marks), with their offsets.
const clusters = (s) => (SEG ? [...SEG.char.segment(s)] : [...s.matchAll(/\P{M}\p{M}*|\p{M}+/gu)].map((m) => ({ segment: m[0], index: m.index })));
const cjk = (c) => c.codePointAt(0) >= 0x2e80;
// The segmenter's word boundaries in a word, by offset: true where the words
// on both sides run past one letter (it splits a word it doesn't know letter
// by letter, 外|滩, み|は|ら|し, and those don't count as word breaks).
function wordBreaks(word) {
  if (!SEG || !RUN_ON.test(word)) return null;
  const segs = [...SEG.word.segment(word)];
  const one = (x) => x.isWordLike && [...x.segment].length < 2;
  return new Map(segs.slice(1).map((x, i) => [x.index, !one(segs[i]) && !one(x)]));
}
// The name as the pieces a line may break between: t, the space or nothing
// (sep) that joins it to the piece before on one line, mid (a break before it
// lands inside a CJK word, see MID_WORD), and the em widths of its characters.
function nameTokens(name) {
  const out = [];
  for (const word of String(name || "").trim().split(/\s+/).filter(Boolean)) {
    const words = wordBreaks(word);
    const cl = clusters(word);
    let prev = null;
    for (const [i, { segment: c, index }] of cl.entries()) {
      let brk = prev == null, mid = false;
      if (prev != null && !NO_END.test(prev) && !NO_START.test(c)) {
        if (SA.test(prev) || SA.test(c)) { brk = words ? words.has(index) : true; mid = !words; }
        else if (cjk(prev) || cjk(c)) { brk = true; mid = !(words && words.get(index)); }
        else if (OPEN.test(c)) {
          // What the bracket holds, to its closing bracket or the word's end.
          let inside = "";
          for (let j = i + 1; j < cl.length && !CLOSE.test(cl[j].segment); j++) inside += cl[j].segment;
          brk = RUN_ON.test(inside);   // KFC / (王府井店), Starbucks / (3号店)
        }
        if (OPEN.test(c)) mid = false;   // before a bracket: clean, segmenter or not
      }
      if (brk) out.push({ t: c, sep: prev == null && out.length ? " " : "", mid });
      else out[out.length - 1].t += c;
      prev = c;
    }
  }
  for (const k of out) { k.w = [...k.t].map((ch) => charEm(ch, serifEm)); k.sepW = [...k.sep].map((ch) => charEm(ch, serifEm)); }
  return out;
}
// Each line's width in em, summed character by character in reading order
// (exactly as emOf adds a whole line), for every run of pieces [a, b).
function lineWidths(toks) {
  const W = toks.map(() => []);
  for (let a = 0; a < toks.length; a++) {
    let w = 0;
    for (let b = a; b < toks.length; b++) {
      if (b > a) for (const e of toks[b].sepW) w += e;
      for (const e of toks[b].w) w += e;
      W[a][b + 1] = w;
    }
  }
  return W;
}
const lineText = (toks, a, b) => toks.slice(a, b).map((k, i) => (i ? k.sep : "") + k.t).join("");
// Every way to set the name in 1–3 lines, as the piece each line starts with.
function candidates(n) {
  if (!n) return [[]];
  const out = [[0]];
  for (let a = 1; a < n; a++) {
    out.push([0, a]);
    for (let b = a + 1; b < n; b++) out.push([0, a, b]);
  }
  return out;
}
// Ends a line that runs past `room` em in "…", a whole letter at a time.
function clip(text, room) {
  if (emOf(text, serifEm) <= room) return text;
  const cl = clusters(text).map((x) => x.segment);
  while (cl.length > 1 && emOf(`${cl.join("").trimEnd()}…`, serifEm) > room) cl.pop();
  return `${cl.join("").trimEnd()}…`;
}
// The last resort, when no layout fits even at NAME_FLOOR (70 characters with
// no spaces, one 50-letter word): the lines fill in reading order at the
// floor, and a line that still runs over ends in "…".
function squeeze(toks, W, need) {
  const f = NAME_FLOOR;
  for (let n = Math.min(3, toks.length); ; n--) {
    const s = stack(n, f, need.place, need.date);
    const room = (i) => (2 * halfAt(s.names[i] - 0.74 * f, s.names[i] + 0.22 * f)) / f;
    const lines = [];
    for (let i = 0, a = 0; i < n && a < toks.length; i++) {
      let b = a + 1;
      while (b < toks.length && (i === n - 1 || W[a][b + 1] <= room(i))) b++;
      lines.push(clip(lineText(toks, a, b), room(i)));
      a = b;
    }
    if (lines.length === n) return { lines, f };
  }
}

// The whole layout for one stamp: the line breaks and size that print the
// name biggest (a further line has to earn it), then the place and the date
// fitted under it. A layout that fits at NAME_MIN always wins; when none
// does, the one that fits biggest below it (2026-10-12: it used to print the
// whole name on one line at NAME_MIN, running over the rings). The place
// drops the country before it gets too small to read, then shrinks, then clips.
function planStamp(name, city, country, dateStr) {
  const toks = nameTokens(name);
  const W = lineWidths(toks);
  const cityU = String(city || "").trim().toUpperCase();
  const ctryU = String(country || "").trim().toUpperCase();
  const full = [cityU, ctryU !== cityU ? ctryU : ""].filter(Boolean).join(" · ");
  const short = cityU || full;
  const need = {
    place: !!full, date: !!dateStr,
    placeW: Math.min(capsWidth(short, PLACE.min, PLACE.ls), 130),
    dateW: capsWidth(dateStr, DATE.size, DATE.ls),
  };
  let best = null;
  for (const starts of candidates(toks.length)) {
    const ends = [...starts.slice(1), toks.length];
    const ems = starts.map((a, i) => W[a][ends[i]]);
    const mids = starts.filter((a, i) => i && toks[a].mid).length;
    const max = NAME_MAX[starts.length] || NAME_MIN;
    const widest = Math.max(0, ...ems);
    const rank = (f) => f * MID_WORD ** mids - (f >= NAME_MIN ? 0.75 * (starts.length - 1) : 100) - 0.001 * widest;
    // No line sets wider than the clear circle: skip a layout that can't win.
    if (best && rank(Math.min(max, (2 * (R_CLEAR - 3)) / widest)) <= best.rank) continue;
    const f = fits(ems, max, need) ? max : sizeIn(ems, need, NAME_MIN, max) ?? sizeIn(ems, need, NAME_FLOOR, NAME_MIN);
    if (f != null && (!best || rank(f) > best.rank)) best = { lines: starts.map((a, i) => lineText(toks, a, ends[i])), f, rank: rank(f) };
  }
  if (!best) best = squeeze(toks, W, need);
  const s = stack(best.lines.length, best.f, need.place, need.date);
  let place = null;
  if (need.place) {
    const room = 2 * halfAt(s.placeY - 0.72 * PLACE.size, s.placeY);
    let text = full, size = capsFit(full, PLACE.size, 11.5, PLACE.ls, room);
    if (size == null) { text = short; size = capsFit(short, PLACE.size, PLACE.min, PLACE.ls, room) ?? capsFit(short, PLACE.size, 6, PLACE.ls, room); }
    if (size == null) {
      let cut = short;
      while (cut.length > 3 && capsFit(`${cut}…`, PLACE.size, 6, PLACE.ls, room) == null) cut = cut.slice(0, -1).trimEnd();
      text = `${cut}…`;
      size = capsFit(text, PLACE.size, 6, PLACE.ls, room) || 6;
    }
    place = { text, size, y: s.placeY };
  }
  const date = need.date
    ? { text: dateStr, size: capsFit(dateStr, DATE.size, 8, DATE.ls, 2 * halfAt(s.dateY - 0.72 * DATE.size, s.dateY)) || 8, y: s.dateY }
    : null;
  return { f: best.f, lines: best.lines.map((t, i) => ({ t, y: s.names[i] })), place, date };
}

export default function LocalFavoriteStamp({ name = "", city = null, country = null, date = null, width = 150, strength = STAMP_INK_STRENGTH }) {
  const S = STAMP_STRENGTH[Math.max(0, Math.min(STAMP_STRENGTH.length - 1, Number(strength) || 0))];
  const raw = useId();
  const uid = String(raw).replace(/:/g, "");
  const worn = `lfw-${uid}`, press = `lfp-${uid}`, arcT = `lfT-${uid}`, arcB = `lfB-${uid}`;
  // MMM DD YYYY ("OCT 12 2026"), parsed exactly as the other stamps parse it.
  const dateStr = (() => { const [dd, mon, yyyy] = fmtStampDate(date).split(" "); return yyyy ? `${mon} ${dd} ${yyyy}` : ""; })();
  const plan = useMemo(() => planStamp(name, city, country, dateStr), [name, city, country, dateStr]);
  const r1 = (v) => +v.toFixed(1);
  // Letter-spacing trails the last letter too; half of it back keeps a line centred.
  const caps = (line, ls, weight) => (
    <text x={r1(C + (ls * line.size) / 2)} y={r1(line.y)} textAnchor="middle" fontFamily={SANS} fontSize={+line.size.toFixed(2)}
      fontWeight={weight} letterSpacing={+(ls * line.size).toFixed(2)} fill="currentColor">{line.text}</text>
  );
  return (
    <svg viewBox="0 0 300 300" width={width} height={width} style={{ color: TEAL, display: "block" }}
      role="img" aria-label={`Local favorite stamp: ${String(name || "").trim()}`}>
      <defs>
        <path id={arcT} d={`M${C - R_TOP},${C} A${R_TOP},${R_TOP} 0 0 1 ${C + R_TOP},${C}`} />
        <path id={arcB} d={`M${C - R_BOT},${C} A${R_BOT},${R_BOT} 0 0 0 ${C + R_BOT},${C}`} />
        <filter id={worn} x="-18%" y="-18%" width="136%" height="136%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.3" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="11" result="g" />
          <feColorMatrix in="g" type="matrix" values={`0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${S.wear}`} result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
        {/* Full-ink press: a hand-stamped edge, no erosion. */}
        <filter id={press} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
      <g transform={`rotate(-6 ${C} ${C})`}>
        <g filter={`url(#${worn})`}>
          <circle cx={C} cy={C} r={R_RING} fill="none" stroke="currentColor" strokeWidth="4.4" />
          <circle cx={C} cy={C} r={R_DASH} fill="none" stroke="currentColor" strokeWidth="2.1" strokeDasharray={DASH} />
          {/* startOffset: the arc's midpoint, plus half the trailing letter-spacing. */}
          <text fontFamily={SANS} fontSize={KICKER.size} fontWeight="700" letterSpacing={KICKER.ls} fill="currentColor">
            <textPath href={`#${arcT}`} startOffset={r1((Math.PI * R_TOP) / 2 + KICKER.ls / 2)} textAnchor="middle">LOCAL FAVORITE</textPath>
          </text>
          <text fontFamily={SANS} fontSize={FOOTER.size} fontWeight="600" letterSpacing={FOOTER.ls} fill="currentColor">
            <textPath href={`#${arcB}`} startOffset={r1((Math.PI * R_BOT) / 2 + FOOTER.ls / 2)} textAnchor="middle">RECOMMENDED BY LOCALS</textPath>
          </text>
          {STARS.map((pts) => <polygon key={pts} points={pts} fill="currentColor" />)}
        </g>
        {(plan.place || plan.date) && (
          <g filter={`url(#${press})`}>
            {plan.place && caps(plan.place, PLACE.ls, 700)}
            {plan.date && caps(plan.date, DATE.ls, 600)}
          </g>
        )}
        {/* The name prints solid: no wear, no fade. */}
        <g>
          {plan.lines.map((l, i) => (
            <text key={i} x={C} y={r1(l.y)} textAnchor="middle" fontFamily={SERIF} fontSize={+plan.f.toFixed(2)} fill={NAME_INK}>{l.t}</text>
          ))}
        </g>
      </g>
    </svg>
  );
}
