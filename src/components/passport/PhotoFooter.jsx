// PhotoFooter — what lives under one passport photo in the full-screen viewer:
// the owner's caption (add / edit, moderated) and that photo's own reaction
// stamps and comments — the Blotter, pointed at the photo instead of the page.
import React, { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { setPhotoCaption } from "@/lib/passport";
import { BlotterStrip } from "@/components/passport/Blotter";

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function PhotoFooter({ photo, slug, blotter, ownerView, onChanged, onCaption }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(photo?.caption || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEditing(false); setDraft(photo?.caption || ""); }, [photo?.id, photo?.caption]);
  if (!photo?.id) return null;

  const save = async () => {
    setBusy(true);
    const { caption, error } = await setPhotoCaption(photo.id, draft.trim());
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    setEditing(false);
    onCaption?.(photo.id, caption);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {ownerView && (editing ? (
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 200))} maxLength={200} autoFocus
            placeholder="Say something about this moment…" aria-label="Photo caption"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="flex-1 rounded-xl px-3 h-10 outline-none" style={{ background: "rgba(255,255,255,.95)", fontSize: fs(13.5), color: "#16110D" }} />
          <button type="button" onClick={save} disabled={busy} className="rounded-xl px-3.5 h-10 font-semibold disabled:opacity-60"
            style={{ background: "#0E7C86", color: "#fff", fontSize: fs(12.5) }}>{busy ? "…" : "Save"}</button>
          <button type="button" onClick={() => { setEditing(false); setDraft(photo.caption || ""); }}
            className="rounded-xl px-2.5 h-10" style={{ color: "rgba(255,255,255,.7)", fontSize: fs(12) }}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="self-center rounded-full px-3 py-1.5"
          style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", textTransform: "uppercase" }}>
          ✎ {photo.caption ? "Edit caption" : "Add a caption"}
        </button>
      ))}
      <BlotterStrip slug={slug} blotter={blotter} ownerView={ownerView} onChanged={onChanged} photoId={photo.id} food={!!photo.food} />
    </div>
  );
}
