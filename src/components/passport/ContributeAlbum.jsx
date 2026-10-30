// ContributeAlbum — "Contribute to City Boards" (founder, 2026-10-27): the first album on the
// profile, at the top right of the albums. Photos added here are public and go to the City Board
// of the city each one was taken in, from "a traveler" (no username); any photo can be deleted
// any time. Up to 20 to a pick, sent one at a time. A photo needs its own location; the worker
// checks each one and never takes a photo where a child is clearly recognizable. The door is open
// until June 30, 2027; after that the album stays so members can still delete their photos.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe2, ImageUp, Loader2, Play, Trash2, X } from "lucide-react";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import { showToast } from "@/components/Toast";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { isClip, readClipLocation, contributeClip, clipLength, CLIP_SECONDS } from "@/lib/clips";
import { useDismissable } from "@/lib/dismissStack";
import { CONTRIBUTE_PICK, contributeOpen, contributePhoto, listContributions, deleteContribution, captionContribution } from "@/lib/boardContrib";
import { collectibleOf, listCollectibles, progressOf } from "@/lib/collectibles";
import CollectibleReward, { CollectibleNudge } from "@/components/passport/CollectibleReward";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const AIR_BLUE = "#1F4E8C", AIR_RED = "#B0472F";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const placeOf = (p) => [p.city, p.country].filter(Boolean).join(", ");

// The envelope on the shelf: airmail stripes, the 🌍 public mark, an upload sign on its corner,
// and under it what to do (founder, 2026-10-28: "make it clear what we want users to do … contribute
// your travel/city photos to city boards. place an upload sign").
function AirmailEnvelope({ count, peek, onOpen }) {
  return (
    <button type="button" onClick={onOpen}
      aria-label={`Your photos on City Boards. Public.${count ? ` ${plural(count, "photo", "photos")} shared so far.` : " None yet."} Upload travel photos`}
      className="block w-full active:scale-95 transition-transform" style={{ background: "transparent", border: 0, padding: 0 }}>
      <div style={{ position: "relative", height: 118 }}>
        {peek ? (
          <div aria-hidden style={{ position: "absolute", left: 12, right: 12, top: 0, height: 72, borderRadius: 6, overflow: "hidden", background: "#8FB2C8", transform: "rotate(-3deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
            <img src={peek} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          // No photos yet: an empty print waiting for one.
          <div aria-hidden style={{ position: "absolute", left: 14, right: 14, top: 2, height: 70, borderRadius: 6, background: "rgba(31,78,140,.07)", border: `1.5px dashed ${AIR_BLUE}`, transform: "rotate(-3deg)", display: "grid", placeItems: "start center", paddingTop: 8 }}>
            <ImageUp size={20} color={AIR_BLUE} strokeWidth={2} />
          </div>
        )}
        {/* The upload sign, where the albums keep their + (a picture only: the whole envelope is the button). */}
        <span aria-hidden="true" style={{ position: "absolute", top: -6, right: -6, zIndex: 3, width: 30, height: 30, borderRadius: 999, background: AIR_BLUE, display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,.22)", border: "2px solid #fff" }}>
          <ImageUp size={15} color="#fff" strokeWidth={2.4} />
        </span>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderRadius: 10, overflow: "hidden", background: "#FFFDF8", border: `1.5px solid ${AIR_BLUE}`, boxShadow: "0 4px 10px -6px rgba(0,0,0,.3)", zIndex: 2 }}>
          {/* the airmail border */}
          <div aria-hidden style={{ position: "absolute", inset: 0, padding: 4, background: `repeating-linear-gradient(135deg, ${AIR_RED} 0 8px, #FFFDF8 8px 14px, ${AIR_BLUE} 14px 22px, #FFFDF8 22px 28px)` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 6, background: "#FFFDF8" }} />
          </div>
          <span aria-hidden="true" style={{ position: "absolute", right: 9, top: 8, fontSize: fs(11), lineHeight: 1 }}>🌍</span>
          <div className="absolute inset-x-0 text-center px-2" style={{ bottom: 9 }}>
            <div className="truncate" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs(13.5), color: AIR_BLUE, letterSpacing: ".03em" }}>MY PHOTOS</div>
            <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(8), color: AIR_RED, letterSpacing: ".12em" }}>
              ON CITY BOARDS · {count ? `${count} SHARED` : "NONE YET"}
            </div>
          </div>
        </div>
      </div>
      {/* What to do, in words, where the albums say who sees them. */}
      {/* Inline icon, so a narrow phone wraps it like a sentence. */}
      <span aria-hidden="true" className="block text-center" style={{ marginTop: 6, color: AIR_BLUE, fontSize: fs(12), fontWeight: 700, lineHeight: 1.25 }}>
        <ImageUp size={14} strokeWidth={2.4} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
        {count ? "Upload more photos or clips" : "Upload your travel photos and clips"}
      </span>
      <span aria-hidden="true" className="block text-center" style={{ marginTop: 1, color: INK3, fontSize: fs(10.5), lineHeight: 1.3 }}>
        Photos you upload, each to its city’s board
      </span>
    </button>
  );
}

// The postage (founder, 2026-10-27: "2 cents"): like a telegram's tolls, each photo's airmail
// postage is printed and stamped ON THE HOUSE, across the box's bottom edge by the price, clear of
// the words. Nobody ever pays; GlobeSkimmers covers it.
function PostageBox({ sent = 0 }) {
  return (
    <div style={{ position: "relative", marginTop: 10, padding: "6px 10px 7px", border: `1px solid ${AIR_BLUE}`, borderRadius: 4, background: "#FFFDF8" }}>
      <div className="flex justify-between gap-2" style={{ fontFamily: MONO, fontSize: fs(8.5), fontWeight: 600, letterSpacing: ".16em", lineHeight: 1.5, color: INK3 }}>
        <span>POSTAGE</span><span style={{ color: AIR_RED }}>PAR AVION · AIRMAIL</span>
      </div>
      <div className="flex justify-between gap-2" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", lineHeight: 1.6, color: INK2 }}>
        <span>{sent ? `${sent} PHOTO${sent === 1 ? "" : "S"} SENT` : "EACH PHOTO TO ITS CITY"}</span><span>{sent ? `${sent} × 2¢` : "2¢"}</span>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", right: 34, bottom: -9, transform: "rotate(-7deg)", padding: "2px 8px", border: `1.5px solid ${AIR_RED}`, borderRadius: 3, boxShadow: `inset 0 0 0 1px #FFFDF8, inset 0 0 0 2px ${AIR_RED}`, color: AIR_RED, opacity: 0.75, mixBlendMode: "multiply", fontFamily: MONO, fontSize: fs(9.5), fontWeight: 700, letterSpacing: ".2em", whiteSpace: "nowrap" }}>
        ON THE HOUSE
      </div>
      <span className="sr-only">Postage is 2 cents a photo, on the house: you never pay.</span>
    </div>
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

// The same sheet from a board (founder, 2026-10-28: "Post to this board" offers photos as well as a
// postcard, on city, state and country boards): titled for the board, listing the member's photos
// on it, and saying when a photo landed elsewhere (it hangs where it was taken).
export function BoardContributeSheet({ board, onClose, onPosted = undefined }) {
  const [photos, setPhotos] = useState([]);
  const load = () => listContributions().then((r) => { if (!r.error) setPhotos(r.photos); });
  useEffect(() => { load(); }, []);
  return <ContributeSheet photos={photos} board={board} onChanged={() => { load(); onPosted?.(); }} onClose={onClose} />;
}

// Does a photo's city sit on this board? (names, folded; a US city board also matches the state)
const fold = (v) => String(v || "").trim().toLowerCase();
const onBoard = (board, b) => {
  if (!board || !b) return true;
  if (fold(b.country) !== fold(board.country)) return false;
  if (board.kind === "country") return true;
  if (board.kind === "state") return fold(b.region) === fold(board.region);
  return fold(b.city) === fold(board.city) && (!board.region || !b.region || fold(b.region) === fold(board.region));
};
const kindWord = (board) => (board?.kind === "state" ? "state" : board?.kind === "country" ? "country" : "city");

function ContributeSheet({ photos, onChanged, onClose, board = null }) {
  useDismissable(true, onClose);
  const fileRef = useRef(null);
  const [run, setRun] = useState(null);      // { done, total, place } while sending
  const [summary, setSummary] = useState(null);
  const [view, setView] = useState(null);    // index into `shown` in the viewer
  const isOpen = contributeOpen();
  // The collectible stamp (founder, 2026-10-28): one, for 10 photos from 3 different cities.
  const [col, setCol] = useState(null);       // { items: [] or [theirs], progress }
  const [reward, setReward] = useState(null);  // the stamp, just earned
  const [nudge, setNudge] = useState(null);    // progress, for "so close" (photos, not yet the cities)
  const [manage, setManage] = useState(null);  // their stamp, opened from the card
  const loadCol = () => listCollectibles().then((r) => { if (!r.error && !r.unavailable) setCol(r); });
  useEffect(() => { loadCol(); }, []);

  const send = async (e) => {
    const all = [...(e.target.files || [])];
    e.target.value = "";
    if (!all.length || run) return;
    const files = all.slice(0, CONTRIBUTE_PICK);
    const tally = { posted: {}, elsewhere: {}, noLocation: 0, child: 0, tooLong: 0, refused: 0, failed: 0, extra: all.length - files.length, firstError: null };
    let earned = null, last = null;
    setSummary(null);
    for (let i = 0; i < files.length; i += 1) {
      setRun((r) => ({ done: i, total: files.length, place: r?.place || null }));
      try {
        // A clip (2026-10-30) comes through the same door: its own location decides the board too.
        const clip = isClip(files[i]);
        const exif = clip ? await readClipLocation(files[i]) : await readPhotoExif(files[i]);   // before resizing strips it
        if (!Number.isFinite(exif?.lat) || !Number.isFinite(exif?.lng)) { tally.noLocation += 1; continue; }
        const r = clip ? await contributeClip({ file: files[i], exif }) : await contributePhoto({ image: await resizePhoto(files[i]), exif });
        if (r.ok) {
          const name = r.board ? [r.board.city, r.board.country].filter(Boolean).join(", ") : "a City Board";
          // From a board: a photo taken somewhere else hangs there instead, and the summary says so.
          if (board && r.board && !onBoard(board, r.board)) tally.elsewhere[r.board.city || name] = (tally.elsewhere[r.board.city || name] || 0) + 1;
          else tally.posted[name] = (tally.posted[name] || 0) + 1;
          setRun({ done: i + 1, total: files.length, place: r.board?.city || null });
          if (r.progress) { last = progressOf(r.progress); setCol((c) => (c ? { ...c, progress: last } : c)); }
          if (r.reward) earned = r.reward;
        } else if (r.code === "no_location" || r.code === "no_city") tally.noLocation += 1;
        else if (r.code === "child") tally.child += 1;
        else if (r.code === "too_long" || r.code === "too_big" || r.code === "unreadable") tally.tooLong += 1;
        else if (r.code === "not_allowed") tally.refused += 1;
        else { tally.failed += 1; tally.firstError = tally.firstError || r.error; if (r.code === "slow_down" || r.code === "closed" || r.code === "day_full") break; }
      } catch (err) { tally.failed += 1; tally.firstError = tally.firstError || err?.message || "Upload failed"; }
    }
    setRun(null);
    setSummary(tally);
    const n = Object.values(tally.posted).reduce((a, b) => a + b, 0) + Object.values(tally.elsewhere).reduce((a, b) => a + b, 0);
    // The stamp, or "so close", says it all (no toast over its title); otherwise the toast. Both
    // come after the pick finishes, not over the progress bar.
    const close = !earned && last && !last.earned && last.posted >= last.needPhotos && last.cities < last.needCities;
    if (n && !earned && !close) showToast(`${plural(n, "photo", "photos")} added to City Boards 🌍`, "success");
    if (n) onChanged();
    if (earned) { setReward(earned); loadCol(); }
    else if (close) setNudge(last);
  };

  // The member's photos by city, newest city first; from a board, only the ones on it.
  const groups = useMemo(() => {
    const by = new Map();
    for (const p of photos) { if (board && !onBoard(board, p)) continue; const k = placeOf(p) || "Somewhere"; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
    return [...by.entries()];
  }, [photos, board]);
  const shown = useMemo(() => groups.flatMap(([, list]) => list), [groups]);
  const posted = summary ? Object.entries(summary.posted) : [];
  const postedCount = posted.reduce((a, [, n]) => a + n, 0);
  const elsewhere = summary ? Object.entries(summary.elsewhere || {}) : [];
  const elsewhereCount = elsewhere.reduce((a, [, n]) => a + n, 0);

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={board ? `Add photos to ${board.name}` : "Contribute to City Boards"} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "14px 18px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: AIR_RED }}>{board ? `${kindWord(board)} board · Public` : "City Boards · Public"}</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(26), fontWeight: 400, lineHeight: 1.1, color: INK }}>{board ? <>Add photos to <em style={{ fontStyle: "italic", color: AIR_BLUE }}>{board.name}</em></> : "Contribute to City Boards"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: fs(14), lineHeight: 1.4, color: INK2 }}>
              {board
                ? <>Photos you took in {board.name} go up on this board: streets, food, sights, festivals. A photo from somewhere else goes to its own city’s board.</>
                : <>Share your travel and city photos: streets, food, sights, festivals. Each one goes up on the board of the city where you took it.</>}
            </p>
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

        {col ? <CollectiblesCard col={col} onOpen={setManage} /> : null}

        {isOpen && (
          <>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple className="hidden" onChange={send} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!run}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ marginTop: 12, minHeight: 52, borderRadius: 14, border: 0, background: AIR_BLUE, color: "#fff", fontFamily: "inherit", fontSize: fs(15), fontWeight: 650, cursor: run ? "progress" : "pointer" }}>
              {run ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ImageUp size={18} strokeWidth={2} aria-hidden="true" />}
              {run ? `Posting ${Math.min(run.done + 1, run.total)} of ${run.total}${run.place ? ` · ${run.place}` : ""}…` : `Upload photos (up to ${CONTRIBUTE_PICK} at a time)`}
            </button>
            {run ? (
              <div aria-hidden="true" style={{ marginTop: 8, height: 4, borderRadius: 999, background: "rgba(31,78,140,.15)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round((run.done / run.total) * 100)}%`, height: "100%", background: AIR_BLUE, transition: "width .3s" }} />
              </div>
            ) : null}
            <PostageBox sent={summary ? postedCount : 0} />
          </>
        )}

        {summary && (
          <div role="status" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(13), lineHeight: 1.5, color: INK2 }}>
            {postedCount ? (
              <p style={{ margin: 0, color: INK, fontWeight: 600 }}>
                {board ? `${plural(postedCount, "photo", "photos")} posted to ${board.name}` : `${plural(postedCount, "photo", "photos")} posted: ${posted.map(([place, n]) => `${place} (${n})`).join(" · ")}`}
              </p>
            ) : elsewhereCount ? null : <p style={{ margin: 0, color: INK, fontWeight: 600 }}>Nothing was posted.</p>}
            {elsewhereCount ? <p style={{ margin: postedCount ? "4px 0 0" : 0, color: INK, fontWeight: postedCount ? 400 : 600 }}>{elsewhere.map(([place, n]) => `${plural(n, "photo was", "photos were")} taken in ${place}, so ${n === 1 ? "it hangs" : "they hang"} on ${place}’s board instead`).join(". ")}.</p> : null}
            {summary.noLocation ? <p style={{ margin: "4px 0 0" }}>{plural(summary.noLocation, "photo has", "photos have")} no location, so we can’t tell the city. Screenshots and saved photos usually don’t.</p> : null}
            {summary.child ? <p style={{ margin: "4px 0 0" }}>{plural(summary.child, "photo stays", "photos stay")} off the boards: a child is clearly recognizable.</p> : null}
            {summary.tooLong ? <p style={{ margin: "4px 0 0" }}>{plural(summary.tooLong, "clip is", "clips are")} longer than {CLIP_SECONDS} seconds, over 25 MB, or couldn’t be read — trim it in Photos first.</p> : null}
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
                    {/* How often it was opened on the boards (2026-10-30): counts only, never who. */}
                    {p.views > 0 && !p.hidden ? <span style={{ position: "absolute", left: 4, top: 4, fontFamily: MONO, fontSize: fs(8), letterSpacing: ".08em", color: "#fff", background: "rgba(22,17,13,.55)", padding: "2px 6px", borderRadius: 999 }}>{p.views} {p.views === 1 ? "VIEW" : "VIEWS"}</span> : null}
                    {p.video ? <span style={{ position: "absolute", right: 4, top: 4, display: "inline-flex", alignItems: "center", gap: 3, fontFamily: MONO, fontSize: fs(8), letterSpacing: ".06em", color: "#fff", background: "rgba(22,17,13,.55)", padding: "2px 6px", borderRadius: 999 }}><Play size={9} strokeWidth={2.5} fill="currentColor" aria-hidden="true" focusable="false" />{clipLength(p.duration)}</span> : null}
                    {p.hidden ? <span style={{ position: "absolute", inset: "auto 4px 4px 4px", fontFamily: MONO, fontSize: fs(8), letterSpacing: ".08em", color: INK, background: "rgba(255,255,255,.85)", borderRadius: 4, padding: "1px 3px" }}>TAKEN DOWN</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p style={{ marginTop: 16, fontSize: fs(13), lineHeight: 1.5, color: INK3, textAlign: "center" }}>{board ? `Your photos on ${board.name}’s board will show here.` : "Your photos will show here, by city."}</p>
        )}
      </div>

      {reward ? <CollectibleReward key={reward.id} item={reward} fresh onClose={() => setReward(null)} onSaved={loadCol} /> : null}
      {manage ? <CollectibleReward key={manage.id} item={manage} fresh={false} onClose={() => setManage(null)} onSaved={loadCol} /> : null}
      {nudge ? <CollectibleNudge progress={nudge} onClose={() => setNudge(null)} onUpload={isOpen ? () => { setNudge(null); fileRef.current?.click(); } : undefined} /> : null}

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

// The reward, in sight while sharing (founder, 2026-10-28): 10 photos from 3 different cities earn
// one collectible stamp. Before: what it takes and how far along they are (photos, cities). After:
// their stamp, a tap away to place it on their passport or change who sees it.
function CollectiblesCard({ col, onOpen }) {
  const p = col.progress || progressOf(null);
  const mine = col.items?.[0] || null;
  const art = mine ? collectibleOf(mine.badge) : null;
  const gold = "#E8CC86";
  const bar = (label, have, need) => (
    <div style={{ marginTop: 8 }}>
      <div className="flex justify-between" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".06em", color: gold }}>
        <span>{label}</span><span>{Math.min(have, need)} / {need}{have >= need ? " ✓" : ""}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)} aria-label={`${label}: ${Math.min(have, need)} of ${need}`}
        style={{ marginTop: 4, height: 8, borderRadius: 999, background: "rgba(255,255,255,.16)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.round((have / need) * 100))}%`, height: "100%", borderRadius: 999, background: have >= need ? "linear-gradient(90deg,#3FA26B,#7FD3A0)" : "linear-gradient(90deg,#C9A227,#F2D878)", transition: "width .4s" }} />
      </div>
    </div>
  );
  return (
    <div style={{ marginTop: 12, padding: "12px 14px 13px", borderRadius: 14, background: "#0C2B50", color: "#fff", boxShadow: "inset 0 0 0 1.5px rgba(201,162,39,.55)" }}>
      <div style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", color: gold }}>🏅 {mine ? "Your collectible stamp" : "Earn a collectible stamp"}</div>
      {mine && art ? (
        <button type="button" onClick={() => onOpen(mine)} aria-label={`${mine.title}, your collectible stamp${mine.placed ? ", on your passport" : ", not placed yet"}`}
          className="w-full flex items-center gap-3" style={{ marginTop: 8, padding: 0, background: "transparent", border: 0, textAlign: "left", color: "#fff", cursor: "pointer" }}>
          <img src={art.art} alt="" style={{ flex: "none", width: 76, height: 76, objectFit: "contain" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: fs(21), lineHeight: 1.1 }}>{mine.title}</span>
            <span style={{ display: "block", marginTop: 3, fontSize: fs(12.5), lineHeight: 1.4, color: "rgba(255,255,255,.85)" }}>
              Thank you for contributing to City Boards. {mine.placed ? "It’s on your passport’s first page." : "Place it on your passport’s first page."}
            </span>
            <span style={{ display: "block", marginTop: 4, fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".1em", color: "#F2D878", fontWeight: 700 }}>{mine.placed ? "WHO SEES IT ›" : "PLACE IT ›"}</span>
          </span>
        </button>
      ) : (
        <>
          <p style={{ margin: "6px 0 0", fontSize: fs(13.5), lineHeight: 1.45, color: "rgba(255,255,255,.92)" }}>
            Share {p.needPhotos} photos from at least {p.needCities} different cities and earn a collectible stamp for your passport: <b style={{ color: "#fff" }}>Official Traveler</b>, <b style={{ color: "#fff" }}>Certified Explorer</b> or <b style={{ color: "#fff" }}>Adventure Pro</b>, picked at random.
          </p>
          {bar("📷 PHOTOS", p.posted, p.needPhotos)}
          {bar("🏙️ DIFFERENT CITIES", p.cities, p.needCities)}
        </>
      )}
    </div>
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
