// AchievementEarnedSheet — shown ONCE, right after the card stamp that crossed a tier or earned a
// seal (founder, approved 2026-11-20). The seal, large; the plain line of what it took; what comes
// next, with no hurry; Keep stamping. Never a notification, never a streak. Several at once: the
// first is the big one, the rest are named under it.
//
//   <AchievementEarnedSheet earned={[{ kind:'tier', category, label, name, tier, at, count, next } | { kind:'seal', id, name, line }]} onClose />
import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Seal, ROMAN } from "@/components/citycards/AchievementsShelf";
import { CATEGORY } from "@/lib/cityCards";
import { useDismissable } from "@/lib/dismissStack";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export default function AchievementEarnedSheet({ earned = [], onClose }) {
  useDismissable(true, onClose);
  const list = Array.isArray(earned) ? earned.filter(Boolean) : [];
  if (!list.length) return null;
  const first = list[0];
  const rest = list.slice(1);
  const tier = first.kind === "tier";
  const ink = tier ? (CATEGORY[first.category]?.ink || "#24316B") : "#24316B";
  const numeral = tier ? ROMAN[(first.tier || 1) - 1] : "★";
  const what = tier ? `${first.at} ${String(first.label || "").toLowerCase()}` : first.line;
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Achievement earned" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl" style={{ background: "#FFFCF7", borderRadius: "24px 24px 0 0", padding: "14px 20px calc(24px + env(safe-area-inset-bottom))", boxShadow: "0 -12px 40px rgba(22,17,13,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: "#B0472F" }}>Achievement{tier ? ` · tier ${numeral}` : ""}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(22,17,13,.14)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={18} strokeWidth={2.1} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
          <Seal ink={ink} numeral={numeral} earned size={150} label={tier ? first.name : "earned"} style={{ transform: "rotate(-5deg)" }} />
          <h2 style={{ margin: "8px 0 0", fontFamily: SERIF, fontSize: fs(28), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink, textAlign: "center" }}>
            {first.name}
          </h2>
          <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2, textAlign: "center", maxWidth: "34ch" }}>{what}{tier && first.count > first.at ? `, ${first.count} so far` : ""}.</p>
          {tier && first.next ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "#F7F4EC", fontSize: fs(12.5), color: NEUTRAL.ink2 }}>
              <span style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: ink }}>Next</span>{first.next.name} at {first.next.at} · no hurry
            </span>
          ) : null}
          {rest.length ? (
            <p style={{ margin: 0, fontSize: fs(12.5), color: NEUTRAL.ink3, textAlign: "center" }}>Also earned: {rest.map((r) => r.name).join(" · ")}</p>
          ) : null}
          <button type="button" onClick={onClose} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: 0, background: "#0E7C73", color: "#fff", font: "inherit", fontSize: fs(15), fontWeight: 800, cursor: "pointer", marginTop: 6 }}>Keep stamping</button>
          <p style={{ margin: 0, fontSize: fs(11.5), color: NEUTRAL.ink3, textAlign: "center" }}>The seal sits on your Cards page. Shown once, never a notification.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
