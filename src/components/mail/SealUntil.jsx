// Seal it until a date (founder, 2026-11-03): a postcard or telegram that opens on a day the sender
// picks — a birthday, an anniversary, the day they land — up to a year ahead. The envelope shows at
// once with the sender's name and the date; the words open that morning. The sender can take it back
// until then and can't open it early. One control for both compose sheets: `dark` for the telegram's.
//
//   <SealUntil value onChange dark />   value: "YYYY-MM-DD" or ""
import React, { useId } from "react";
import { Lock } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
export const SEAL_MAX_DAYS = 366;

// Local calendar dates as "YYYY-MM-DD" (the phone's own day, never UTC's).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function sealBounds(now = new Date()) {
  const min = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SEAL_MAX_DAYS);
  return { min: ymd(min), max: ymd(max) };
}
// "Nov 20, 2026" from "2026-11-20", read as a local date (no timezone slip).
export function sealLabel(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function SealUntil({ value = "", onChange, dark = false }) {
  const id = useId();
  const { min, max } = sealBounds();
  const on = !!value;
  const ink = dark ? "#EADBBE" : NEUTRAL.ink;
  const ink2 = dark ? "#A8977A" : NEUTRAL.ink2;
  const line = dark ? "rgba(201,163,90,.45)" : NEUTRAL.airmailLine;
  const accent = dark ? "#C9A35A" : NEUTRAL.airmailBlue;
  const field = dark ? "rgba(0,0,0,.25)" : NEUTRAL.white;
  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, border: `1px solid ${on ? accent : line}`, background: dark ? "rgba(0,0,0,.14)" : NEUTRAL.ivory2 }}>
      <label htmlFor={`${id}-on`} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input id={`${id}-on`} type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? min : "")} style={{ width: 18, height: 18, margin: 0, accentColor: accent }} />
        <Lock size={15} strokeWidth={2} color={accent} aria-hidden="true" focusable="false" />
        <span style={{ flex: 1, minWidth: 0, fontSize: fs(13.5), fontWeight: 650, color: ink }}>Seal it until a date</span>
      </label>
      {on ? (
        <div style={{ marginTop: 8 }}>
          <label htmlFor={`${id}-date`} style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: ink2 }}>Opens on</label>
          <input id={`${id}-date`} type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value || min)}
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, minHeight: 44, padding: "0 12px", borderRadius: 12, border: `1px solid ${line}`, background: field, color: ink, font: "inherit", fontSize: fs(15) }} />
          <p style={{ margin: "6px 0 0", fontSize: fs(12), lineHeight: 1.45, color: ink2 }}>
            They see a sealed envelope with your name and the date right away; it opens that morning. You can take it back until then. Nobody can open it early.
          </p>
        </div>
      ) : (
        <p style={{ margin: "4px 0 0 28px", fontSize: fs(12), lineHeight: 1.45, color: ink2 }}>A birthday, an anniversary, the day they land — up to a year ahead.</p>
      )}
    </div>
  );
}
