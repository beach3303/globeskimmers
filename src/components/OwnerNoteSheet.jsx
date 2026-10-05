// OwnerNoteSheet — a private message to the owner of a place (founder,
// 2026-10-05): restaurants, cafés, stores and attractions. Never posted; the
// worker screens it for threats and abuse and keeps it until the owner claims
// and verifies the place. Anonymous unless the traveler chooses to sign it.
// Rendered on document.body so it opens over wherever the traveler is.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Loader2, X } from "lucide-react";
import { sendOwnerNote } from "@/lib/ownerNotes";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const IVORY = "#FFFCF7";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function OwnerNoteSheet({ entityType, entityId, entityName, onClose }) {
  const [body, setBody] = useState("");
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useDismissable(true, onClose);

  const send = async () => {
    const text = body.trim();
    if (text.length < 2 || busy) return;
    setBusy(true); setNote(null);
    const { data, error } = await sendOwnerNote({ entityType, entityId, entityName, body: text, includeName: signed });
    setBusy(false);
    if (error) { setNote(error); return; }
    showToast(data?.held ? "Sent privately — our team reads it before the owner does" : "Sent privately to the owner 🔒", "success");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Private message to the owner"
      style={{ background: "rgba(22,17,13,.55)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl p-4" style={{ background: IVORY }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", textTransform: "uppercase", color: INK3 }}>
              {entityName ? `Private · ${entityName}` : "Private"}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK, lineHeight: 1.15 }}>A message for the owner</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-none rounded-full p-1.5" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <X size={15} color={INK} />
          </button>
        </div>
        <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.45, marginTop: 6 }}>
          Private messages, compliments and requests — straight to the owner, never posted.
        </p>

        <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} rows={5} maxLength={1000} aria-label="Your message"
          placeholder="A compliment, a request, or something only they should hear…"
          className="w-full mt-3 rounded-xl px-3 py-2.5 outline-none resize-none" style={{ background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(14.5), color: INK }} />

        <label className="flex items-center gap-2.5 mt-2.5 cursor-pointer" style={{ fontSize: fs(13.5), color: INK }}>
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK }} />
          Sign it with my first name
        </label>
        <p style={{ fontSize: fs(11.5), color: INK3, lineHeight: 1.45, marginTop: 8 }}>
          <Lock size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
          Sent privately to the owner when they join GlobeSkimmers. {signed ? "Signed with your first name." : "Sent anonymously."} We screen messages for threats and abuse before delivering them.
        </p>
        {note && <p role="alert" style={{ fontSize: fs(12.5), color: "#B0472F", lineHeight: 1.4, marginTop: 6 }}>{note}</p>}

        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
          <button type="button" onClick={send} disabled={body.trim().length < 2 || busy} className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: INK, color: "#fff", fontSize: fs(14) }}>
            {busy && <Loader2 size={15} className="animate-spin" />}Send privately
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
