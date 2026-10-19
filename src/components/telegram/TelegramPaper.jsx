// TelegramPaper — the telegram blank, drawn like the real thing (founder, 2026-10-19: "realistic
// and super cool"). Buff paper torn off a pad (a perforated top edge), telegraph wires with a
// bird across the head, the GlobeSkimmers bolt seal, TELEGRAM in heavy capitals between double
// rules, the CLASS OF SERVICE boxes, a ruled form row (NO. / CHECK / FILED), the TO and FROM
// lines, the TOLLS box ("3 WORDS MAX!", extra words 4¢ — stamped ON THE HOUSE: nobody is ever
// charged, founder 2026-10-19), a Morse rule that spells GLOBESKIMMERS, and the fine print. A received telegram's words
// arrive the way they did on paper: typed on strips of tape pasted onto the blank, with the
// office's red RECEIVED stamp. A blank being written takes its message area from children.
//
//   <TelegramPaper mode body to from at number words maxWords>{children}</TelegramPaper>
//   mode      'received' (tape + stamp) | 'blank' (children in the message area)
//   body      the wire text (telegramText), for 'received'
//   to, from  { name, handle } — either may be missing
//   at        ISO time it was sent (SENT; a blank shows NOW)
//   receivedAt ISO time it first reached the recipient's Mailbox (the RECEIVED stamp; else at)
//   number    the form's NO. (telegramNumber(id))
//   words     words counted (CHECK); maxWords the ceiling — over it, CHECK reads red
import React from "react";
import { fs } from "@/components/redesign/constants";
import { WORD_NAMES } from "@/lib/telegram";

export const PAPER = "#F2E4BC";
export const TINK = "#2A2219";      // printer's ink on the blank
export const TINK3 = "#7A6A4E";
export const TRED = "#B33A26";      // the office's stamp pad
const VIOLET = "#5A3E8E";           // the cashier's stamp pad
export const TYPE = "'Special Elite', 'American Typewriter', 'Courier New', Courier, monospace";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const HEAVY = "'Inter Tight', system-ui, sans-serif";

// Perforated where it was torn off the pad: half-circles bitten out of the top edge.
const PERF = "radial-gradient(circle at 7px 0, transparent 3.6px, #000 4.1px) 0 0 / 14px 9px repeat-x, linear-gradient(#000, #000) 0 9px / 100% calc(100% - 9px) no-repeat";
const PAPER_BG = [
  "radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.42), transparent 55%)",
  "radial-gradient(90% 60% at 100% 100%, rgba(150,100,25,.17), transparent 62%)",
  "radial-gradient(40% 30% at 78% 22%, rgba(160,110,30,.07), transparent 70%)",
  "repeating-linear-gradient(90deg, rgba(110,80,20,.028) 0 1px, transparent 1px 5px)",
  "repeating-linear-gradient(0deg, rgba(110,80,20,.02) 0 1px, transparent 1px 3px)",
  PAPER,
].join(", ");

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// "2026 OCT 19 AM 8 42", the way an office stamped the time on the date line.
export function wireTime(at) {
  const d = at ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  return { line: `${d.getFullYear()} ${MON[d.getMonth()]} ${d.getDate()} ${h < 12 ? "AM" : "PM"} ${h % 12 || 12} ${String(d.getMinutes()).padStart(2, "0")}`, day: `${MON[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`, time: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` };
}

// The words on tape: lines of up to ~22 characters, each its own strip.
function tapeLines(body, max = 22) {
  const out = [];
  let line = "";
  for (const w of String(body || "").split(" ").filter(Boolean)) {
    if (line && (line + " " + w).length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
const TILT = [-0.7, 0.45, -0.3, 0.6, -0.5, 0.25];
const NUDGE = [0, 3, -2, 4, 1, -3];

const name = (p) => {
  if (!p) return "";
  const n = String(p.name || "").trim().toUpperCase();
  const h = p.handle ? `@${String(p.handle).replace(/^@+/, "").toUpperCase()}` : "";
  return n && h ? `${n} · ${h}` : n || h;
};

function Wires() {
  // Two poles, three sagging wires, and a bird that stopped for a rest.
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 30" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 26, opacity: 0.34 }}>
      <g stroke={TINK} strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke">
        <path d="M14 2 V30 M6 6 H22 M8 11 H20" />
        <path d="M306 2 V30 M298 6 H314 M300 11 H312" />
        <path d="M6 6 Q160 20 298 6" />
        <path d="M22 6 Q160 22 314 6" />
        <path d="M8 11 Q160 26 300 11" />
      </g>
    </svg>
  );
}
function Bird() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 12" style={{ position: "absolute", top: 13, left: "57%", width: 13, height: 10, opacity: 0.55 }}>
      <path d="M2 8 C3 5 6 4 8 5 C9 3 11 2 13 3 L11 4 C12 6 11 8 9 9 L9 11 M7 9 L7 11 M2 8 L0 7" fill={TINK} stroke={TINK} strokeWidth=".6" strokeLinejoin="round" />
    </svg>
  );
}
function Seal({ size = 40 }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" width={size} height={size} style={{ flex: "none" }}>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={TINK} strokeWidth="1.4" />
      <circle cx="20" cy="20" r="15" fill="none" stroke={TINK} strokeWidth=".7" strokeDasharray="1.2 1.6" />
      <path d="M22.5 7 L12.5 22 H19 L16.5 33 L27.5 17 H21 Z" fill={TRED} stroke={TINK} strokeWidth=".8" strokeLinejoin="round" />
    </svg>
  );
}
// G L O B E S K I M M E R S in Morse: dots and dashes along a rule.
const MORSE = "--. .-.. --- -... . ... -.- .. -- -- . .-. ...";
function MorseRule() {
  let x = 0;
  const marks = [];
  for (const ch of MORSE) {
    if (ch === " ") { x += 6; continue; }
    if (ch === ".") { marks.push(<circle key={x} cx={x + 1.6} cy="3" r="1.5" />); x += 6; } else { marks.push(<rect key={x} x={x} y="1.6" width="7" height="2.8" rx="1.4" />); x += 10; }
  }
  return (
    <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${x} 6`} style={{ display: "block", width: "min(100%, 300px)", height: 6, margin: "0 auto" }}>
      <g fill={TINK} opacity=".5">{marks}</g>
    </svg>
  );
}

// A tariff line: the label, a dotted leader, the price.
function Toll({ label, value, red = false }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: TYPE, fontSize: fs(11.5), letterSpacing: ".05em", lineHeight: 1.5, color: red ? TRED : TINK }}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span aria-hidden="true" style={{ flex: 1, minWidth: 12, margin: "0 5px", borderBottom: `1.5px dotted ${red ? TRED : "rgba(42,34,25,.5)"}`, transform: "translateY(-3px)" }} />
      <span style={{ whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Box({ label, children, red = false, style = undefined }) {
  return (
    <div style={{ padding: "3px 7px 4px", borderLeft: `1px solid ${TINK}`, minWidth: 0, ...style }}>
      <div style={{ fontFamily: MONO, fontSize: fs(7.5), letterSpacing: ".14em", lineHeight: 1.3, color: TINK3 }}>{label}</div>
      <div style={{ fontFamily: TYPE, fontSize: fs(13), lineHeight: 1.25, color: red ? TRED : TINK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</div>
    </div>
  );
}

export default function TelegramPaper({ mode = "received", body = "", to = null, from = null, at = null, receivedAt = null, number = "0000", words = null, maxWords = 3, children = null, style = undefined }) {
  const received = mode === "received";
  const when = wireTime(at);
  const got = wireTime(receivedAt) || when;
  const over = words != null && words > maxWords;
  return (
    <div style={{ filter: "drop-shadow(0 10px 12px rgba(70,45,10,.16)) drop-shadow(0 1px 1px rgba(70,45,10,.22))", ...style }}>
      <div style={{ position: "relative", padding: "12px 14px 10px", background: PAPER_BG, WebkitMask: PERF, mask: PERF, boxShadow: "inset 0 0 0 1px rgba(120,85,25,.16), inset 0 0 36px rgba(150,105,30,.16)", color: TINK }}>
        <div style={{ position: "relative" }}>
          <Wires />
          <Bird />
        </div>

        {/* the head: the seal, the word, the class of service */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <Seal />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: fs(8), letterSpacing: ".3em", lineHeight: 1.2, color: TINK3 }}>GLOBESKIMMERS</div>
            <div style={{ fontFamily: HEAVY, fontWeight: 800, fontSize: fs(25), letterSpacing: ".13em", lineHeight: 1.02, color: TINK }}>TELEGRAM</div>
          </div>
          <div aria-hidden="true" style={{ flex: "none", border: `1px solid ${TINK}`, padding: "3px 6px 4px", fontFamily: MONO, fontSize: fs(7), letterSpacing: ".08em", lineHeight: 1.45, color: TINK }}>
            <div style={{ fontWeight: 600, letterSpacing: ".14em", borderBottom: `1px solid ${TINK}`, marginBottom: 2, paddingBottom: 1 }}>CLASS OF SERVICE</div>
            {[["FULL RATE", true], ["DAY LETTER", false], ["NIGHT LETTER", false]].map(([l, on]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ position: "relative", width: 7, height: 7, border: `1px solid ${TINK}`, flex: "none" }}>
                  {on ? <span style={{ position: "absolute", inset: -3, fontFamily: TYPE, fontSize: 11, lineHeight: "11px", textAlign: "center", color: TINK }}>×</span> : null}
                </span>{l}
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden="true" style={{ height: 4, borderTop: `2px solid ${TINK}`, borderBottom: `1px solid ${TINK}`, margin: "8px 0 0" }} />

        {/* the form row */}
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 2fr", borderBottom: `1px solid ${TINK}`, marginLeft: -1 }}>
          <Box label="NO.">{number}</Box>
          <Box label="CHECK" red={over}>{words == null ? "—" : `${words}/${maxWords} WDS`}</Box>
          <Box label="SENT">{when ? when.line : "NOW"}</Box>
        </div>

        {/* to */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 600, letterSpacing: ".16em", color: TINK3 }}>TO</span>
          <span style={{ flex: 1, minWidth: 0, borderBottom: `1px dotted rgba(42,34,25,.55)`, fontFamily: TYPE, fontSize: fs(14), lineHeight: 1.35, color: TINK, overflowWrap: "anywhere" }}>{name(to) || " "}</span>
        </div>

        {/* the words */}
        <div style={{ position: "relative", minHeight: received ? 44 : 56, margin: "12px 0 8px" }}>
          {received ? (
            <p aria-label={body} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7 }}>
              {tapeLines(body).map((l, i) => (
                <span key={i} aria-hidden="true"
                  style={{
                    display: "inline-block", padding: "4px 10px 3px", background: "linear-gradient(#FDFBF3, #F5F1E3)",
                    boxShadow: "0 1px 1.5px rgba(80,58,20,.28), 0 0 0 .5px rgba(80,58,20,.12)",
                    clipPath: "polygon(0 6%, 2% 0, 97% 4%, 100% 0, 100% 94%, 98% 100%, 3% 96%, 0 100%)",
                    transform: `translateX(${NUDGE[i % NUDGE.length]}px) rotate(${TILT[i % TILT.length]}deg)`,
                    fontFamily: TYPE, fontSize: fs(16), letterSpacing: ".07em", lineHeight: 1.25, color: "#1E1913", textShadow: "0 0 .5px rgba(30,25,19,.55)", whiteSpace: "nowrap",
                  }}>
                  {l}
                </span>
              ))}
            </p>
          ) : children}
        </div>

        {/* from, and the office's stamp on it */}
        <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 600, letterSpacing: ".16em", color: TINK3 }}>FROM</span>
          <span style={{ flex: 1, minWidth: 0, borderBottom: `1px dotted rgba(42,34,25,.55)`, fontFamily: TYPE, fontSize: fs(14), lineHeight: 1.35, color: TINK, overflowWrap: "anywhere", paddingRight: received ? 92 : 0 }}>{name(from) || "\u00A0"}</span>
          {received && got ? (
            <div aria-hidden="true" style={{ position: "absolute", right: 0, top: -24, transform: "rotate(-9deg)", padding: "3px 8px 4px", border: `2px solid ${TRED}`, borderRadius: 7, boxShadow: `inset 0 0 0 1.5px ${PAPER}, inset 0 0 0 2.5px ${TRED}`, color: TRED, opacity: 0.82, mixBlendMode: "multiply", textAlign: "center", fontFamily: MONO, lineHeight: 1.15 }}>
              <div style={{ fontSize: fs(7.5), fontWeight: 700, letterSpacing: ".24em" }}>RECEIVED</div>
              <div style={{ fontSize: fs(11), fontWeight: 700, letterSpacing: ".06em" }}>{got.day}</div>
              <div style={{ fontSize: fs(7.5), letterSpacing: ".14em" }}>{got.time}</div>
            </div>
          ) : null}
        </div>

        {/* the tolls: three words, and what more would cost — on the house */}
        <div style={{ position: "relative", marginTop: 12, padding: "4px 8px 5px", border: `1px solid ${TINK}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: MONO, fontSize: fs(7.5), fontWeight: 600, letterSpacing: ".16em", lineHeight: 1.4, color: TINK3 }}>
            <span>TOLLS</span><span style={{ color: TRED }}>{String(WORD_NAMES[maxWords] || maxWords).toUpperCase()} WORDS MAX!</span>
          </div>
          <Toll label={`FIRST ${maxWords} WORDS`} value="FREE" />
          <Toll label="EACH EXTRA WORD" value={over ? `${words - maxWords} × 4¢` : "4¢"} red={over} />
          <div aria-hidden="true" style={{ position: "absolute", left: "40%", top: 20, transform: "rotate(-7deg)", padding: "2px 7px", border: `1.5px solid ${VIOLET}`, borderRadius: 3, boxShadow: `inset 0 0 0 1px ${PAPER}, inset 0 0 0 2px ${VIOLET}`, color: VIOLET, opacity: 0.72, mixBlendMode: "multiply", fontFamily: MONO, fontSize: fs(8.5), fontWeight: 700, letterSpacing: ".2em", whiteSpace: "nowrap" }}>
            ON THE HOUSE
          </div>
        </div>

        <div style={{ marginTop: 10 }}><MorseRule /></div>
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontFamily: MONO, fontSize: fs(6.5), letterSpacing: ".1em", color: TINK3 }}>
          <span>FORM GS-10 · NO PHOTOS BY WIRE</span>
          <span>GLOBESKIMMERS TELEGRAPH</span>
        </div>
      </div>
    </div>
  );
}
