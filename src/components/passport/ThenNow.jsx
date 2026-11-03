// Then and now (founder, 2026-11-03: "i like then and now"): under an upload on a board that has a
// curated archive photo of the place (kits/<slug>/then.jpg + then.json on R2), the archive photo with
// its year, caption and credit — film it now, see it then. Public-domain or licensed archive pictures
// only, one per board, chosen by hand; a board without one shows nothing here.
//
//   <ThenNow then={{ image, year, caption, credit, source }} nowDate />
import React, { useState } from "react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { markDate } from "@/lib/clipMarks";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const RED = "#B0472F", BLUE = "#1F4E8C", CREAM = "#FBF6EC";

export default function ThenNow({ then = null, nowDate = null }) {
  const [open, setOpen] = useState(false);
  if (!then || !then.image) return null;
  const year = then.year ? String(then.year) : null;
  return (
    <section aria-label="Then and now" style={{ marginTop: 12, borderRadius: 14, background: CREAM, border: "1px solid rgba(22,17,13,.1)", color: NEUTRAL.ink, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", border: 0, background: "transparent", textAlign: "left", font: "inherit", cursor: "pointer" }}>
        <span aria-hidden="true" style={{ flex: "none", width: 56, height: 40, borderRadius: 4, overflow: "hidden", background: "#D8CFBE", filter: "sepia(.35) contrast(.95)" }}>
          <img src={then.image} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".18em", textTransform: "uppercase", color: RED }}>Then{year ? ` · ${year}` : ""}</span>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(18), lineHeight: 1.15, color: NEUTRAL.ink }}>{open ? "The same place, " : "See it "}<em style={{ fontStyle: "italic", color: BLUE }}>{open ? "back then" : "then"}</em></span>
        </span>
        <span style={{ flex: "none", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ borderRadius: 8, overflow: "hidden", background: "#D8CFBE", border: "6px solid #FFFFFF", boxShadow: "0 8px 18px -12px rgba(22,17,13,.45)" }}>
            <img src={then.image} alt={then.caption || `The place${year ? ` in ${year}` : ""}`} decoding="async" style={{ display: "block", width: "100%", maxHeight: "48vh", objectFit: "contain", background: "#2A2420" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>
            <span>Then{year ? ` · ${year}` : ""}</span>
            <span>Now{nowDate ? ` · ${markDate(nowDate)}` : ""}</span>
          </div>
          {then.caption ? <p style={{ margin: "6px 0 0", fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), lineHeight: 1.3, color: NEUTRAL.ink2 }}>{then.caption}</p> : null}
          {then.credit ? (
            <p style={{ margin: "4px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>
              {then.source ? <a href={then.source} target="_blank" rel="noreferrer" style={{ color: NEUTRAL.ink3 }}>{then.credit}</a> : then.credit}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
