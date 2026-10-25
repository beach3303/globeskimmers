// DeleteConfirm — the one confirm a postcard or telegram in your Mailbox asks before it's deleted
// (founder, 2026-10-25: "allow users to delete post cards and telegrams in inboxes"). The card's trash
// button opens it under the card's actions: what deleting does, then Delete / Keep it.
//
//   <TrashButton onClick label />                     the 44px trash button for a card's action row
//   <DeleteConfirm what name onDelete onCancel style /> what: 'postcard' | 'telegram'
import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";

export function TrashButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ flex: "none", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, cursor: "pointer" }}>
      <Trash2 size={17} strokeWidth={2} aria-hidden="true" focusable="false" />
    </button>
  );
}

export default function DeleteConfirm({ what = "postcard", name = null, onDelete, onCancel, style = undefined }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onDelete();
    if (!ok) setBusy(false);
  };
  return (
    <div role="group" aria-label={`Delete this ${what}?`} style={{ padding: 10, borderRadius: 12, background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailLine}`, ...style }}>
      <p style={{ margin: 0, fontSize: fs(13), lineHeight: 1.4, color: NEUTRAL.ink2 }}>
        <b style={{ color: NEUTRAL.ink }}>Delete this {what}?</b> {what === "telegram" ? "It’s erased for good." : "It leaves your Mailbox."} {name ? `${name} isn’t told.` : "The sender isn’t told."}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={go} aria-busy={busy || undefined}
          style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: 0, background: NEUTRAL.stamp, color: NEUTRAL.white, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>{busy ? "Deleting…" : "Delete"}</button>
        <button type="button" onClick={onCancel}
          style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, font: "inherit", fontSize: fs(13.5), fontWeight: 600, cursor: "pointer" }}>Keep it</button>
      </div>
    </div>
  );
}
