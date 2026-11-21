// BoardFromStamp — put one of a stamp's photos on its city's board (2026-11-21). A friend's report:
// the photo stamped the passport (the picture proved the place) but City Boards refused it, "no
// location" — iOS's web picker had stripped the tag. The stamp is the proof here: it was verified
// by GPS or by the picture, it has the place, so the worker takes the photo from the stamp's own
// copy and hangs it on that place's board, from "a traveler". The same review as any board photo.
//
//   <BoardFromStamp stamp onClose />
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { showToast } from "@/components/Toast";
import { contributeStampPhoto } from "@/lib/boardContrib";
import { useDismissable } from "@/lib/dismissStack";
import { fs } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";

export default function BoardFromStamp({ stamp, onClose }) {
  useDismissable(true, onClose);
  const [busy, setBusy] = useState(null);
  const photos = (Array.isArray(stamp?.photos) ? stamp.photos : []).filter((p) => p && p.id && p.photo_url && !p.video);
  const city = String(stamp?.city || stamp?.name || "").trim();
  const post = async (p) => {
    if (busy) return;
    setBusy(p.id);
    const r = await contributeStampPhoto(p.id);
    setBusy(null);
    if (r.ok) {
      showToast(`On the ${r.board?.name || city || "city"} board, from a traveler`, "success");
      onClose?.();
      return;
    }
    showToast(r.code === "child" ? "A child is clearly recognizable in this photo, so it stays off the boards"
      : r.code === "not_allowed" ? "This photo can’t be shared on a City Board"
      : r.error || "Couldn’t post it — try again", "error");
  };
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9998, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Share a photo with the city board" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md" style={{ background: "#FFFCF7", borderRadius: "22px 22px 0 0", padding: "14px 16px calc(24px + env(safe-area-inset-bottom))", boxShadow: "0 -12px 40px rgba(22,17,13,.25)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: INK3 }}>City Boards</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.05, color: INK }}>Share one with the <em style={{ fontStyle: "italic", color: "#0E7C73" }}>{city || "city"}</em> board</h2>
            <p style={{ margin: "6px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: INK2 }}>Public, from “a traveler”, no @username. Your stamp is the proof of the place. Tap a photo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ flex: "none", width: 40, height: 40, borderRadius: 999, border: `1px solid ${RULE}`, background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={18} strokeWidth={2.1} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => post(p)} disabled={!!busy} aria-label="Share this photo with the board"
              style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", padding: 0, border: `1px solid ${RULE}`, background: "#F7F4EC", cursor: "pointer", opacity: busy && busy !== p.id ? 0.5 : 1 }}>
              <img src={p.photo_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {busy === p.id ? <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,252,247,.6)" }}><Loader2 size={20} className="animate-spin" color={INK} /></span> : null}
            </button>
          ))}
        </div>
        {!photos.length ? <p style={{ margin: "14px 0 0", fontSize: fs(13), color: INK3 }}>Add a photo to this stamp first.</p> : null}
        <p style={{ margin: "12px 0 0", fontSize: fs(11), lineHeight: 1.4, color: INK3 }}>Photos are reviewed before they hang; one with a recognizable child stays off. Take any photo down later from your albums.</p>
      </div>
    </div>,
    document.body,
  );
}
