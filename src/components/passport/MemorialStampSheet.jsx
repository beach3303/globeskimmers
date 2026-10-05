// MemorialStampSheet — shown once for a memorial stamp (src/lib/memorials.js,
// founder 2026-10-04): a short message that honors the victims, then the
// traveler's choice of how the stamp appears — its illustration, or text only
// (the typographic stamp). Neither is pre-selected. When the place has no
// illustration, the stamp is already text only and the sheet just honors.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { stampArtUrl } from "@/lib/stampArt";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import { useDismissable } from "@/lib/dismissStack";
import TypographicStamp from "@/components/passport/TypographicStamp";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const IVORY = "#FFFCF7";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

function Choice({ label, sub, onClick, busy, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex flex-col items-center rounded-[16px] px-2 pt-3 pb-2.5 disabled:opacity-60"
      style={{ background: "#fff", border: `1px solid ${RULE}`, fontFamily: "inherit" }}>
      <div className="flex items-center justify-center" style={{ height: 104 }}>{children}</div>
      <span className="font-semibold mt-1.5 flex items-center gap-1.5" style={{ color: INK, fontSize: fs(14.5) }}>
        {busy && <Loader2 size={14} className="animate-spin" />}{label}
      </span>
      <span style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.3, marginTop: 1, textAlign: "center" }}>{sub}</span>
    </button>
  );
}

export default function MemorialStampSheet({ stamp, memorial, onChoose, onLater }) {
  const [busy, setBusy] = useState(null);
  const [hasArt, setHasArt] = useState(true);
  useDismissable(true, onLater);
  const art = stampArtUrl(stamp.name);
  const choose = async (value) => {
    if (busy) return;
    setBusy(value);
    await onChoose(value);
    setBusy(null);
  };

  return (
    <div onClick={onLater} className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true"
      aria-label={`${memorial.title}, a place of remembrance`} style={{ background: "rgba(22,17,13,.6)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[22px] px-5 pt-3 overflow-y-auto"
        style={{ background: IVORY, maxHeight: "88vh", paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: RULE }} aria-hidden="true" />
        <p style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".14em", color: INK3, textTransform: "uppercase" }}>A place of remembrance</p>
        <p style={{ fontFamily: SERIF, fontSize: fs(26), color: INK, lineHeight: 1.1, marginTop: 4 }}>{memorial.title}</p>
        <p style={{ color: INK2, fontSize: fs(14.5), lineHeight: 1.5, marginTop: 8 }}>{memorial.message}</p>
        <div style={{ height: 1, background: RULE, margin: "16px 0 14px" }} aria-hidden="true" />

        {hasArt ? (
          <>
            <p style={{ color: INK, fontSize: fs(14.5), fontWeight: 600 }}>How should this stamp appear in your passport?</p>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <Choice label="Illustrated" sub="The engraved drawing of the place" onClick={() => choose("art")} busy={busy === "art"} disabled={!!busy}>
                <img src={art} alt="" onError={() => setHasArt(false)} style={{ width: 100, height: 100, objectFit: "contain" }} />
              </Choice>
              <Choice label="Text only" sub="Just the name, place and date" onClick={() => choose("plain")} busy={busy === "plain"} disabled={!!busy}>
                <TypographicStamp name={stamp.name} city={stamp.city} country={stamp.country} entityId={stamp.entity_id || stamp.name} width={100} strength={STAMP_INK_STRENGTH} />
              </Choice>
            </div>
            <p style={{ color: INK3, fontSize: fs(12), textAlign: "center", marginTop: 10 }}>You can change this anytime in the stamp&rsquo;s options.</p>
            <button type="button" onClick={onLater} disabled={!!busy} className="w-full mt-1.5 py-2" style={{ color: INK3, fontSize: fs(13), fontFamily: "inherit" }}>Decide later</button>
          </>
        ) : (
          <button type="button" onClick={() => choose("plain")} disabled={!!busy} className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
            style={{ background: INK, color: "#fff", fontSize: fs(14.5), fontFamily: "inherit" }}>
            {busy && <Loader2 size={15} className="animate-spin" />}Thank you
          </button>
        )}
      </div>
    </div>
  );
}
