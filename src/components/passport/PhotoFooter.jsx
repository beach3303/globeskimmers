// PhotoFooter — what lives under one passport photo in the full-screen viewer:
// the owner's caption (add / edit, moderated) and that photo's own reaction
// stamps and comments — the Blotter, pointed at the photo instead of the page.
import React, { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { setPhotoCaption, setPhotoOnBoard } from "@/lib/passport";
import { BlotterStrip } from "@/components/passport/Blotter";

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// albumsOpen: the owner's albums dial allows passport viewers (so a 🌍 print hangs on the city
// board); onBoard(id, hidden) hears a print taken down or put back (City Billboards, 2026-10-16).
export default function PhotoFooter({ photo, slug, blotter, ownerView, onChanged, onCaption, albumsOpen = true, onBoard = undefined }) {
  const [editing, setEditing] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);
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

  const toggleBoard = async () => {
    setBoardBusy(true);
    const { data, error } = await setPhotoOnBoard(photo.id, !photo.board_hidden);
    setBoardBusy(false);
    if (error) { showToast(error, "error"); return; }
    showToast(data?.board_hidden ? "Taken off the city board" : "Back on the city board", "success");
    onBoard?.(photo.id, data?.board_hidden === true);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {ownerView && photo.tier === "public" ? (
        <div className="flex items-center justify-center gap-2" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>
          <span>{photo.board_hidden ? "Off the city board" : albumsOpen ? "🌍 On the city board" : "Albums closed — not on the board"}</span>
          {albumsOpen ? (
            <button type="button" onClick={toggleBoard} disabled={boardBusy} className="rounded-full px-2.5 h-7 disabled:opacity-60"
              style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", color: "#fff", fontSize: fs(10), letterSpacing: ".06em", textTransform: "none" }}>
              {boardBusy ? "…" : photo.board_hidden ? "Put it back" : "Take it down"}
            </button>
          ) : null}
        </div>
      ) : null}
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
      {/* Reactions and comments need the shared booklet (its slug); the caption is the
          owner's own and works anywhere, the Profile's albums included. */}
      {slug ? <BlotterStrip slug={slug} blotter={blotter} ownerView={ownerView} onChanged={onChanged} photoId={photo.id} /> : null}
    </div>
  );
}
