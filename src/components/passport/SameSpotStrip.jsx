// The same-spot strip (founder, 2026-11-03: "i love same spot strip"): under an upload in the board
// viewer, everything on that board shot within fifty metres of it, oldest to newest on one timeline,
// the open one ringed; a tap opens another. Built from where each upload was shot, never from a
// hashtag; the worker keeps the spots and answers with items only (src/lib/sameSpot.js). Uploads from
// before 2026-11-03 kept no spot, so the strip grows from that day. Nothing shows until there are two.
//
//   <SameSpotStrip row onOpen(item) />
import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { sameSpot } from "@/lib/sameSpot";
import { clipFilterCss } from "@/lib/clipFilters";
import { clipLength } from "@/lib/clips";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const BLUE = "#1F4E8C", RED = "#B0472F", CREAM = "#FBF6EC";
const monthYear = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase() : ""; };

export default function SameSpotStrip({ row, onOpen }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    setData(null);
    if (!row?.id) return undefined;
    sameSpot(row.id).then((r) => { if (live) setData(r); });
    return () => { live = false; };
  }, [row?.id]);
  const rows = data?.rows || [];
  if (rows.length < 2) return null;
  const n = data.travelers || 0;
  return (
    <section aria-label="Shot at the same spot" style={{ marginTop: 12, padding: "12px 0", borderRadius: 14, background: CREAM, border: "1px solid rgba(22,17,13,.1)", color: NEUTRAL.ink }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 12px" }}>
        <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".18em", textTransform: "uppercase", color: RED }}>Same spot · within 50 m</span>
        <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", textTransform: "uppercase", color: NEUTRAL.ink3, whiteSpace: "nowrap" }}>{n} {n === 1 ? "traveler" : "travelers"}</span>
      </div>
      <h3 style={{ margin: "2px 12px 0", fontFamily: SERIF, fontWeight: 400, fontSize: fs(20), lineHeight: 1.15, color: NEUTRAL.ink }}>The same spot, <em style={{ fontStyle: "italic", color: BLUE }}>{rows.length} times</em></h3>
      <div style={{ position: "relative", marginTop: 12 }}>
        {/* the timeline rule behind the dates */}
        <div aria-hidden="true" style={{ position: "absolute", left: 12, right: 12, top: 110, height: 1, background: "rgba(22,17,13,.14)" }} />
        <div style={{ display: "flex", gap: 10, padding: "0 12px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {rows.map((it) => {
            const on = it.current || it.id === row.id;
            const kindWord = it.video ? "clip" : "photo";
            return (
              <button key={it.id} type="button" onClick={() => { if (!on) onOpen(it); }} aria-current={on ? "true" : undefined}
                aria-label={`${it.video ? "Clip" : "Photo"} from ${monthYear(it.when) || "here"}${on ? ", the one open now" : ""}`}
                style={{ flex: "none", width: 76, padding: 0, border: 0, background: "transparent", cursor: on ? "default" : "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ position: "relative", display: "block", width: 76, height: 101, borderRadius: 8, overflow: "hidden", background: "#16110D", boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${BLUE}` : "none" }}>
                  <img src={it.photo} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", filter: clipFilterCss(it.filter) }} />
                  {it.video ? (
                    <span style={{ position: "absolute", right: 5, top: 5, display: "inline-flex", alignItems: "center", gap: 2, padding: "2px 5px", borderRadius: 999, background: "rgba(22,17,13,.55)", color: "#fff", fontFamily: MONO, fontSize: fs(7.5), letterSpacing: ".06em" }}>
                      <Play size={8} strokeWidth={2.5} fill="currentColor" aria-hidden="true" focusable="false" />{clipLength(it.duration)}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" style={{ display: "block", width: on ? 9 : 7, height: on ? 9 : 7, borderRadius: 999, background: on ? BLUE : NEUTRAL.ink3, boxShadow: on ? "0 0 0 2px #fff" : "none", marginTop: on ? 1 : 2 }} />
                <span style={{ display: "block", fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".1em", textTransform: "uppercase", color: on ? BLUE : NEUTRAL.ink3, fontWeight: on ? 500 : 400, textAlign: "center", lineHeight: 1.3 }}>
                  {monthYear(it.when) || "—"}<br />{on ? `this ${kindWord}` : kindWord}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p style={{ margin: "10px 12px 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>Tap one to see it. Built from where each one was shot, metre by metre — never from a hashtag.</p>
    </section>
  );
}
