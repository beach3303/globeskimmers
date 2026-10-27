// ContributeAlbum — "Contribute to City Boards" (founder, 2026-10-27): the first album on the
// profile, at the top right of the albums. Photos added here are public and go to the City Board
// of the city each one was taken in, from "a traveler" (no username); any photo can be deleted
// any time. Up to 20 to a pick, sent one at a time. A photo needs its own location; the worker
// checks each one and never takes a photo where a child is clearly recognizable. The door is open
// until June 30, 2027; after that the album stays so members can still delete their photos.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe2, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import { showToast } from "@/components/Toast";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { useDismissable } from "@/lib/dismissStack";
import { CONTRIBUTE_PICK, contributeOpen, contributePhoto, listContributions, deleteContribution, captionContribution } from "@/lib/boardContrib";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const AIR_BLUE = "#1F4E8C", AIR_RED = "#B0472F";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const placeOf = (p) => [p.city, p.country].filter(Boolean).join(", ");

// The envelope on the shelf: airmail stripes, the 🌍 public mark, the count.
function AirmailEnvelope({ count, peek, onOpen }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Contribute to City Boards. Public. ${plural(count, "photo", "photos")}`}
      className="block w-full active:scale-95 transition-transform">
      <div style={{ position: "relative", height: 118 }}>
        {peek ? (
          <div aria-hidden style={{ position: "absolute", left: 12, right: 12, top: 0, height: 72, borderRadius: 6, overflow: "hidden", background: "#8FB2C8", transform: "rotate(-3deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
            <img src={peek} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderRadius: 10, overflow: "hidden", background: "#FFFDF8", border: `1.5px solid ${AIR_BLUE}`, boxShadow: "0 4px 10px -6px rgba(0,0,0,.3)", zIndex: 2 }}>
          {/* the airmail border */}
          <div aria-hidden style={{ position: "absolute", inset: 0, padding: 4, background: `repeating-linear-gradient(135deg, ${AIR_RED} 0 8px, #FFFDF8 8px 14px, ${AIR_BLUE} 14px 22px, #FFFDF8 22px 28px)` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 6, background: "#FFFDF8" }} />
          </div>
          <span aria-hidden="true" style={{ position: "absolute", right: 9, top: 8, fontSize: fs(11), lineHeight: 1 }}>🌍</span>
          <div className="absolute inset-x-0 text-center px-2" style={{ bottom: 9 }}>
            <div className="truncate" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs(13.5), color: AIR_BLUE, letterSpacing: ".03em" }}>CITY BOARDS</div>
            <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(8), color: AIR_RED, letterSpacing: ".12em" }}>
              CONTRIBUTE · {count ? plural(count, "PHOTO", "PHOTOS") : "PUBLIC"}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ContributeAlbum() {
  const [photos, setPhotos] = useState(null);   // the member's contributions, newest first
  const [open, setOpen] = useState(false);
  const load = () => listContributions().then((r) => { if (!r.error) setPhotos(r.photos); });
  useEffect(() => { load(); }, []);
  const count = photos?.length || 0;
  // After June 30, 2027 the album stays only for members who have photos to look at or delete.
  if (!contributeOpen() && !count) return null;
  return (
    <>
      <AirmailEnvelope count={count} peek={photos?.find((p) => !p.hidden)?.url || null} onOpen={() => setOpen(true)} />
      {open && <ContributeSheet photos={photos || []} onChanged={load} onClose={() => setOpen(false)} />}
    </>
  );
}

function ContributeSheet({ photos, onChanged, onClose }) {
  useDismissable(true, onClose);
  const fileRef = useRef(null);
  const [run, setRun] = useState(null);      // { done, total, place } while sending
  const [summary, setSummary] = useState(null);
  const [view, setView] = useState(null);    // index into `shown` in the viewer
  const isOpen = contributeOpen();

  const send = async (e) => {
    const all = [...(e.target.files || [])];
    e.target.value = "";
    if (!all.length || run) return;
    const files = all.slice(0, CONTRIBUTE_PICK);
    const tally = { posted: {}, noLocation: 0, child: 0, refused: 0, failed: 0, extra: all.length - files.length, firstError: null };
    setSummary(null);
    for (let i = 0; i < files.length; i += 1) {
      setRun((r) => ({ done: i, total: files.length, place: r?.place || null }));
      try {
        const exif = await readPhotoExif(files[i]);   // before resizing strips it
        if (!Number.isFinite(exif?.lat) || !Number.isFinite(exif?.lng)) { tally.noLocation += 1; continue; }
        const image = await resizePhoto(files[i]);
        const r = await contributePhoto({ image, exif });
        if (r.ok) {
          const name = r.board ? [r.board.city, r.board.country].filter(Boolean).join(", ") : "a City Board";
          tally.posted[name] = (tally.posted[name] || 0) + 1;
          setRun({ done: i + 1, total: files.length, place: r.board?.city || null });
        } else if (r.code === "no_location" || r.code === "no_city") tally.noLocation += 1;
        else if (r.code === "child") tally.child += 1;
        else if (r.code === "not_allowed") tally.refused += 1;
        else { tally.failed += 1; tally.firstError = tally.firstError || r.error; if (r.code === "slow_down" || r.code === "closed" || r.code === "day_full") break; }
      } catch (err) { tally.failed += 1; tally.firstError = tally.firstError || err?.message || "Upload failed"; }
    }
    setRun(null);
    setSummary(tally);
    const n = Object.values(tally.posted).reduce((a, b) => a + b, 0);
    if (n) { showToast(`${plural(n, "photo", "photos")} added to City Boards 🌍`, "success"); onChanged(); }
  };

  // The member's photos by city, newest city first.
  const groups = useMemo(() => {
    const by = new Map();
    for (const p of photos) { const k = placeOf(p) || "Somewhere"; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
    return [...by.entries()];
  }, [photos]);
  const shown = useMemo(() => groups.flatMap(([, list]) => list), [groups]);
  const posted = summary ? Object.entries(summary.posted) : [];
  const postedCount = posted.reduce((a, [, n]) => a + n, 0);

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Contribute to City Boards" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "14px 18px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: AIR_RED }}>City Boards · Public</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(26), fontWeight: 400, lineHeight: 1.1, color: INK }}>Contribute to City Boards</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "transparent", border: 0, color: INK2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* The note the founder asked for (2026-10-27): public, delete any time, no children. */}
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${RULE}` }}>
          <p className="flex items-start gap-2" style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: INK, fontWeight: 600 }}>
            <Globe2 size={18} color={AIR_BLUE} strokeWidth={2} aria-hidden="true" style={{ flex: "none", marginTop: 1 }} />
            Contributions to City Boards are public.
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 44, listStyle: "disc", fontSize: fs(13), lineHeight: 1.5, color: INK2 }}>
            <li>Each photo goes to the board of the city where it was taken, from “a traveler”. Your name isn’t shown.</li>
            <li>You can delete any photo, any time.</li>
            <li>We don’t accept photos where a child is clearly recognizable.</li>
            <li>Everyone in your photo should be OK with it being public.</li>
          </ul>
          <p style={{ margin: "8px 0 0", fontSize: fs(12), lineHeight: 1.45, color: INK3 }}>
            The photo’s own location tells us the city, so screenshots and saved photos can’t be used. {isOpen ? "Open until June 30, 2027." : "Contributions closed on June 30, 2027. You can still delete your photos."}
          </p>
        </div>

        {isOpen && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={send} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!run}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ marginTop: 12, minHeight: 52, borderRadius: 14, border: 0, background: AIR_BLUE, color: "#fff", fontFamily: "inherit", fontSize: fs(15), fontWeight: 650, cursor: run ? "progress" : "pointer" }}>
              {run ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={18} strokeWidth={2} aria-hidden="true" />}
              {run ? `Posting ${Math.min(run.done + 1, run.total)} of ${run.total}${run.place ? ` · ${run.place}` : ""}…` : `Add photos (up to ${CONTRIBUTE_PICK} at a time)`}
            </button>
            {run ? (
              <div aria-hidden="true" style={{ marginTop: 8, height: 4, borderRadius: 999, background: "rgba(31,78,140,.15)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round((run.done / run.total) * 100)}%`, height: "100%", background: AIR_BLUE, transition: "width .3s" }} />
              </div>
            ) : null}
          </>
        )}

        {summary && (
          <div role="status" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(13), lineHeight: 1.5, color: INK2 }}>
            {postedCount ? (
              <p style={{ margin: 0, color: INK, fontWeight: 600 }}>
                {plural(postedCount, "photo", "photos")} posted: {posted.map(([place, n]) => `${place} (${n})`).join(" · ")}
              </p>
            ) : <p style={{ margin: 0, color: INK, fontWeight: 600 }}>Nothing was posted.</p>}
            {summary.noLocation ? <p style={{ margin: "4px 0 0" }}>{plural(summary.noLocation, "photo has", "photos have")} no location, so we can’t tell the city. Screenshots and saved photos usually don’t.</p> : null}
            {summary.child ? <p style={{ margin: "4px 0 0" }}>{plural(summary.child, "photo stays", "photos stay")} off the boards: a child is clearly recognizable.</p> : null}
            {summary.refused ? <p style={{ margin: "4px 0 0" }}>{plural(summary.refused, "photo", "photos")} can’t be shared on a City Board.</p> : null}
            {summary.failed ? <p style={{ margin: "4px 0 0" }}>{plural(summary.failed, "photo", "photos")} didn’t go up{summary.firstError ? ` (${summary.firstError})` : ""}. Try {summary.failed === 1 ? "it" : "them"} again.</p> : null}
            {summary.extra > 0 ? <p style={{ margin: "4px 0 0" }}>We took the first {CONTRIBUTE_PICK}. Add the other {summary.extra} next.</p> : null}
          </div>
        )}

        {groups.length ? (
          groups.map(([place, list]) => (
            <section key={place} aria-label={`${place}, ${plural(list.length, "photo", "photos")}`} style={{ marginTop: 16 }}>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: SERIF, fontSize: fs(18), color: INK }}>{place}</span>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".14em", color: INK3 }}>{plural(list.length, "photo", "photos")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6, marginTop: 8 }}>
                {list.map((p) => (
                  <button key={p.id} type="button" onClick={() => setView(shown.indexOf(p))} aria-label={`Open your photo from ${place}${p.hidden ? ", taken down" : ""}`}
                    style={{ position: "relative", aspectRatio: "1 / 1", padding: 0, border: 0, borderRadius: 8, overflow: "hidden", background: "#E4DCC8", cursor: "pointer" }}>
                    <img src={p.url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: p.hidden ? 0.35 : 1 }} />
                    {p.hidden ? <span style={{ position: "absolute", inset: "auto 4px 4px 4px", fontFamily: MONO, fontSize: fs(8), letterSpacing: ".08em", color: INK, background: "rgba(255,255,255,.85)", borderRadius: 4, padding: "1px 3px" }}>TAKEN DOWN</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p style={{ marginTop: 16, fontSize: fs(13), lineHeight: 1.5, color: INK3, textAlign: "center" }}>Your photos will show here, by city.</p>
        )}
      </div>

      {view != null && shown[view] && (
        <div onClick={(e) => e.stopPropagation()}>
          <PhotoLightbox
            photos={shown.map((p) => ({ id: p.id, src: p.url, caption: p.caption || undefined }))}
            index={view}
            onClose={() => setView(null)}
            onIndexChange={setView}
            title={placeOf(shown[view])}
            credit={shown[view].hidden ? "Taken down after reports" : "Public on the City Board"}
            renderFooter={(ph) => <OwnPhotoFooter key={ph?.id} photo={shown.find((p) => p.id === ph?.id)} onChanged={onChanged} onGone={() => setView(null)} />}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}

// Under one of the member's own photos: its caption, and Delete.
function OwnPhotoFooter({ photo, onChanged, onGone }) {
  const [caption, setCaption] = useState(photo?.caption || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!photo) return null;
  const light = "rgba(255,252,247,0.9)";
  const saveCaption = async () => {
    if (busy || caption.trim() === (photo.caption || "")) return;
    setBusy(true);
    const r = await captionContribution(photo.id, caption.trim());
    setBusy(false);
    if (r.error) { showToast(r.error, "error"); return; }
    showToast(r.caption ? "Caption saved" : "Caption removed", "success");
    onChanged();
  };
  const remove = async () => {
    setBusy(true);
    const r = await deleteContribution(photo.id);
    setBusy(false);
    if (r.error) { showToast(r.error, "error"); return; }
    showToast("Deleted. It's off the City Board.", "success");
    onGone();
    onChanged();
  };
  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <div className="flex gap-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 200))} maxLength={200} placeholder="Add a caption (optional)" aria-label="Caption"
          onKeyDown={(e) => { if (e.key === "Enter") saveCaption(); }}
          style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.1)", color: "#FFFCF7", padding: "0 12px", fontFamily: "inherit", fontSize: fs(14) }} />
        <button type="button" onClick={saveCaption} disabled={busy || caption.trim() === (photo.caption || "")}
          className="disabled:opacity-50" style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, border: 0, background: "rgba(255,252,247,.92)", color: INK, fontWeight: 650, fontSize: fs(13.5) }}>Save</button>
      </div>
      {confirm ? (
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setConfirm(false)} disabled={busy} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: light, fontSize: fs(13.5) }}>Keep it</button>
          <button type="button" onClick={remove} disabled={busy} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 0, background: AIR_RED, color: "#fff", fontWeight: 650, fontSize: fs(13.5) }}>{busy ? "Deleting…" : "Delete for good"}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="w-full flex items-center justify-center gap-1.5"
          style={{ marginTop: 8, minHeight: 44, background: "transparent", border: 0, color: light, fontSize: fs(13), textDecoration: "underline", textUnderlineOffset: 2 }}>
          <Trash2 size={15} aria-hidden="true" /> Delete this photo
        </button>
      )}
    </div>
  );
}
