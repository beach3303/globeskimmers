// ENTRY WAITING (border grace, founder 2026-11-05): every open crossing or airport window sits above the
// passport book for its 48 hours — a stamp preview, where and when the app first saw you, the hours left,
// Stamp it (opens the sheet for that window) and Not this one. A dismissed pop-up is never the end.
import React from "react";
import { useCrossings, closeWindow, askToStamp, hoursLeft, untilLabel, seenLabel } from "@/lib/crossings";
import { localISODate } from "@/lib/localDate";
import LandStamp from "@/components/passport/LandStamp";
import AirportStamp from "@/components/passport/AirportStamp";

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const SERIF = '"Instrument Serif",Georgia,serif';

function Preview({ w }) {
  const spot = w.crossing || w.firstSeen;
  const date = localISODate(new Date(spot?.at || Date.now()));
  if (w.kind === "airport") return <AirportStamp iata={w.iata} city={w.city} countryCode={w.cc} date={date} direction="arrival" width={118} />;
  if (w.kind === "region") return <LandStamp template="state" name={w.region} sub={w.info?.nickname} date={date} direction="arrival" ink={w.ink} width={118} />;
  return <LandStamp template="country" name={w.country} countryCode={w.cc} date={date} direction="arrival" ink={w.ink} width={118} />;
}

export default function CrossingsWaiting() {
  const open = useCrossings();
  if (!open.length) return null;
  const [first, ...rest] = open;
  const spot = first.crossing || first.firstSeen;
  const where = first.kind === "airport" ? `${first.city} (${first.iata})` : first.kind === "region" ? first.region : first.country;
  const label = (w) => (w.kind === "airport" ? `${w.iata} · arrival or departure` : `${w.kind === "region" ? w.region : w.country} · entry`);
  return (
    <div style={{ marginBottom: 14, boxSizing: "border-box", padding: "14px 14px 12px", background: "#FBF6EC", border: "1px solid #EADFC9", borderRadius: 18, boxShadow: "0 10px 24px -16px rgba(22,17,13,.35)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#B0472F" }}>
          {first.kind === "airport" ? "Airport stamp waiting" : "Entry waiting"} · {hoursLeft(first)} h left
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#0E7C73" }}>48-hour grace</div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: "none", transform: "rotate(-3deg)" }}><Preview w={first} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.05, color: "#16110D" }}>{where}</div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: "#3A3128" }}>
            {first.crossing ? "Crossed" : "First seen"}{spot?.near ? ` near ${spot.near}` : ""}, {seenLabel(spot?.at)}. Press it from anywhere {first.kind === "airport" ? "— it waits" : `in ${where} —`} until {untilLabel(first)}.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => askToStamp(first.id)} style={{ flex: 1, minHeight: 44, borderRadius: 999, border: "none", background: "#B0472F", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Stamp it</button>
        <button type="button" onClick={() => closeWindow(first.id, "declined")} style={{ minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid #E6DFD2", background: "#fff", color: "#3A3128", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Not this one</button>
      </div>
      {rest.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, borderTop: "1px dashed #EADFC9" }}>
          {rest.map((w) => (
            <button key={w.id} type="button" onClick={() => askToStamp(w.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 36, padding: 0, background: "none", border: "none", fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#736657", cursor: "pointer" }}>
              <span>Next · {label(w)} · {hoursLeft(w)} h</span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
