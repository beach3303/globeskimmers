// AchievementsShelf — the fifty seals for stamping City Cards (founder, approved 2026-11-20: "i love
// this"). Six categories × five tiers at 5 · 15 · 30 · 60 · 100 distinct places, plus twenty for the
// way you stamp. The worker counts (POST /city-cards/achievements); this only draws: each category's
// current seal in its ink with the count toward the next tier, then, on "All 50", the twenty
// behaviour seals. Quiet chips, never a guilt bar: nothing expires, nothing nags, no notification.
//
//   <AchievementsShelf style />
//   <Seal ink numeral earned size label />   the round seal, shared with the earned sheet
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cityCardAchievements, CATEGORY } from "@/lib/cityCards";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const CREAM = "#FBF6EC";
export const ROMAN = ["I", "II", "III", "IV", "V"];
const inkFor = (key) => CATEGORY[key]?.ink || "#24316B";

export function Seal({ ink = "#24316B", numeral = "I", earned = false, size = 56, label = null, style = undefined }) {
  const color = earned ? ink : "#A8997F";
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 999, flex: "none", display: "grid", placeItems: "center", textAlign: "center",
      fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: Math.round(size * 0.27), lineHeight: 1, color,
      background: earned ? CREAM : "#fff", border: `${earned ? 2.5 : 1.5}px ${earned ? "solid" : "dashed"} ${color}`,
      boxShadow: earned ? `inset 0 0 0 ${Math.round(size * 0.07)}px ${CREAM}, inset 0 0 0 ${Math.round(size * 0.07) + 1}px ${color}` : "none",
      boxSizing: "border-box", ...style,
    }}>
      <span style={{ display: "block" }}>{numeral}</span>
      {label ? <span style={{ display: "block", fontFamily: MONO, fontWeight: 500, fontSize: Math.max(6, Math.round(size * 0.11)), letterSpacing: ".12em", textTransform: "uppercase", marginTop: 2 }}>{label}</span> : null}
    </span>
  );
}

export default function AchievementsShelf({ style = undefined }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [all, setAll] = useState(false);
  useEffect(() => {
    let gone = false;
    cityCardAchievements().then(({ data: d, error }) => {
      if (gone) return;
      if (error || !d?.ok) { setState("error"); return; }
      setData(d); setState("ready");
    });
    return () => { gone = true; };
  }, []);
  if (state === "error") return null;
  const cats = data?.categories || [];
  const seals = data?.seals || [];
  return (
    <section aria-label="Achievements" style={{ marginTop: 18, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: "#8A5410" }}>Achievements</div>
          <div style={{ fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.1, color: NEUTRAL.ink, marginTop: 2 }}>
            {state === "loading" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: fs(14), fontFamily: "inherit", color: NEUTRAL.ink3 }}><Loader2 size={14} className="animate-spin" /> Counting your stamps…</span> : <>{data.total} of {data.of} <em style={{ fontStyle: "italic" }}>earned</em></>}
          </div>
        </div>
        {state === "ready" ? (
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
            style={{ background: "transparent", border: 0, padding: "6px 0", font: "inherit", fontSize: fs(12.5), fontWeight: 700, color: "#0E7C73", cursor: "pointer" }}>
            {all ? "Fewer ‹" : `All ${data.of} ›`}
          </button>
        ) : null}
      </div>

      {state === "ready" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {cats.map((c) => {
            const ink = inkFor(c.key);
            const target = c.next ? c.next.at : c.tiers[c.tiers.length - 1];
            const pct = Math.max(0, Math.min(100, Math.round((c.count / target) * 100)));
            const shown = c.earned ? c.earned.name : c.next.name;
            return (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#fff", border: "1px solid rgba(22,17,13,.12)", borderRadius: 14 }}>
                <Seal ink={ink} numeral={ROMAN[(c.earned ? c.earned.tier : c.next.tier) - 1]} earned={!!c.earned} label={CATEGORY[c.key]?.label?.split(" ")[0] || c.label.split(" ")[0]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: fs(14.5), fontWeight: 700, color: NEUTRAL.ink, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    {shown}{c.earned ? <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: "#2E6B4E" }}>earned</span> : null}
                  </div>
                  <div style={{ fontSize: fs(12), color: NEUTRAL.ink3, marginTop: 1 }}>
                    {c.next ? `${c.count} of ${c.next.at} ${c.label.toLowerCase()}${c.earned ? ` · next: ${c.next.name}` : ""}` : `${c.count} ${c.label.toLowerCase()} · every tier earned`}
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: "#F0EADF", overflow: "hidden", marginTop: 6 }} aria-hidden="true">
                    <i style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: ink }} />
                  </div>
                </div>
              </div>
            );
          })}
          {all ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>For the way you stamp</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
                {seals.map((sl) => (
                  <div key={sl.id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "9px 11px", borderRadius: 12, background: sl.earned ? CREAM : "#fff", border: `1px solid ${sl.earned ? "#24316B" : "rgba(22,17,13,.12)"}` }}>
                    <span style={{ fontSize: fs(13), fontWeight: 700, color: sl.earned ? "#24316B" : NEUTRAL.ink }}>{sl.name}</span>
                    <span style={{ fontSize: fs(11), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{sl.line}</span>
                    <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".1em", textTransform: "uppercase", color: sl.earned ? "#2E6B4E" : NEUTRAL.ink3, marginTop: 2 }}>{sl.earned ? "earned" : `${sl.n} of ${sl.of}`}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: fs(11.5), lineHeight: 1.45, color: NEUTRAL.ink3 }}>Distinct places count for the ladders; a café stamped twice counts once there and twice for The Regular. Nothing expires.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
