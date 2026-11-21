// PlacePage — one tap on a stamp opens its PLACE (founder decision 3B, 2026-11-20: "when I click
// my stamp I wanna be able to read a brief information about that place"). Three parts, top to
// bottom: the place (its stamp, the story the worker already writes for Things to Do from public
// records — /attractions/why-visit — and the hard facts Wikidata holds — /attractions/facts),
// then "You were here" (the date, the memory photos, the note), then two buttons: Send as a
// postcard, and More, which opens the old options sheet trimmed to five rows (StampActions
// compact). Nothing the old sheet did is lost; the first tap just shows you the place.
//
//   <PlacePage stamp pages fits readOnly onClose onChanged onDetails onEnlarge />
//   the same props Passport.jsx gave StampActions; onDetails opens the date editor (StampCard).
//
// A city or visit stamp (entity visit:…) has no catalog row, so it shows the memory alone.
import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Plus, Send, MoreHorizontal, PencilLine } from "lucide-react";
import { showToast } from "@/components/Toast";
import { callWorker } from "@/lib/callWorker";
import { fs } from "@/components/redesign/constants";
import { stampArtUrl } from "@/lib/stampArt";
import { isPlainArt } from "@/lib/respectPlaces";
import { isVerified, uploadStampPhoto, setStampNote, socialFollow } from "@/lib/passport";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { useDismissable } from "@/lib/dismissStack";
import { useAuth } from "@/lib/AuthContext";
import { openPartner } from "@/lib/openPartner";
import { useWhyVisit } from "@/components/attraction/AttractionExtras";
import TypographicStamp from "@/components/passport/TypographicStamp";
import LocalFavoriteStamp, { isLocalFavorite } from "@/components/passport/LocalFavoriteStamp";
import PostcardCompose from "@/components/passport/PostcardCompose";
import StampActions from "@/components/passport/StampActions";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const IVORY = "#FFFCF7", CREAM = "#FBF6EC", INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657";
const RULE = "rgba(22,17,13,.12)", TEAL = "#0E7C73", STAMP = "#B0472F";
const MAX_PHOTOS = 30;

const fmtDate = (iso) => {
  if (!iso) return null;
  try { return new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
};
const kicker = { fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: INK3 };

export default function PlacePage({ stamp, pages = null, fits = null, readOnly = false, onClose, onChanged, onDetails, onEnlarge }) {
  useDismissable(true, onClose);
  const { socialTier } = useAuth();
  const minor = ["teen", "confirm"].includes(String(socialTier || ""));
  // The place in the catalog: an attraction stamp carries its D1 id; a city visit has none.
  const placeId = stamp?.kind === "attraction" && stamp.entity_id && !/^visit:/.test(stamp.entity_id) ? stamp.entity_id : null;
  const wv = useWhyVisit(placeId);
  const [facts, setFacts] = useState(null);
  useEffect(() => {
    if (!placeId) { setFacts(null); return undefined; }
    let gone = false;
    callWorker("attractions/facts", { id: placeId }, { timeoutMs: 20000 }).then(({ data }) => { if (!gone) setFacts(data && data.ok ? data : null); });
    return () => { gone = true; };
  }, [placeId]);

  // The stamp itself: the drawn art when there is one, else the typographic stamp.
  const isLocalFav = isLocalFavorite(stamp);
  const art = isLocalFav || stamp.kind === "country" || isPlainArt(stamp) ? null : stampArtUrl(stamp.name, { entityId: stamp.entity_id, country: stamp.country });
  const [artFail, setArtFail] = useState(false);
  const showArt = !!art && !artFail;
  const place = [stamp.city, stamp.region, stamp.country].filter(Boolean).join(", ");

  // You were here
  const photos = Array.isArray(stamp.photos) ? stamp.photos : [];
  const room = Math.max(0, MAX_PHOTOS - photos.length);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null);
  const onPick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, room);
    e.target.value = "";
    if (!files.length) return;
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      setBusy(files.length > 1 ? `Sending photo ${i + 1} of ${files.length}…` : "Sending your photo…");
      try {
        const exif = await readPhotoExif(files[i]).catch(() => null);
        const image = await resizePhoto(files[i]);
        const up = await uploadStampPhoto({ stamp_id: stamp.id, image, exif: exif || undefined });
        if (!up?.error) added += 1;
      } catch { /* skip a bad photo */ }
    }
    setBusy(null);
    showToast(added ? `${added} photo${added === 1 ? "" : "s"} added` : "Couldn't add those photos", added ? "success" : "error");
    if (added) onChanged?.();
  };
  const arrival = stamp.kind === "airport" || stamp.entity_type === "border";
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteDraft, setNoteDraft] = useState(stamp.note || "");
  const saveNote = async () => {
    setBusy("note");
    const r = await setStampNote(stamp.id, { note: noteDraft.trim(), isPublic: stamp.note_public === true });
    setBusy(null);
    if (r?.error) { showToast(r.error, "error"); return; }
    setNoteEdit(false);
    showToast(noteDraft.trim() ? "Memory saved" : "Memory removed", "success");
    onChanged?.();
  };

  // Send as a postcard (never for a minor), and More.
  const [compose, setCompose] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const openCompose = async () => {
    const { data } = await socialFollow("list");
    setBlocked(data?.blocked || []);
    setCompose(true);
  };
  const [more, setMore] = useState(false);
  const reportStory = async () => {
    await callWorker("attractions/why-visit", { id: placeId, report: true });
    showToast("Thanks — we'll look at this place again", "success");
  };

  const story = wv && wv !== "loading" && wv.ok ? wv : null;
  const loadingStory = !!placeId && wv === "loading";
  const verifiedWord = isVerified(stamp.verified) ? "✓ Verified" : "Self-declared";

  return (
    <div className="fixed inset-0 z-[9997] overflow-y-auto" role="dialog" aria-modal="true" aria-label={stamp.name} style={{ background: IVORY, WebkitOverflowScrolling: "touch" }}>
      <div className="mx-auto w-full max-w-md" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}>
        <div className="flex items-center gap-2.5 px-3" style={{ height: 52 }}>
          <button type="button" onClick={onClose} aria-label="Back to your passport" className="flex-none w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <span style={kicker}>Your passport</span>
        </div>

        {/* The place */}
        <div className="mx-4 rounded-[18px] px-4 pt-4 pb-3 flex flex-col items-center" style={{ background: CREAM, border: `1px solid rgba(22,17,13,.1)` }}>
          {showArt ? (
            <img src={art} alt={stamp.name} onError={() => setArtFail(true)} style={{ width: 150, height: 150, objectFit: "contain", transform: "rotate(-4deg)" }} />
          ) : isLocalFav ? (
            <LocalFavoriteStamp name={stamp.name} city={stamp.city} country={stamp.country} date={stamp.visited_on} width={150} />
          ) : (
            <TypographicStamp name={stamp.name} city={stamp.city} region={stamp.region} country={stamp.country} date={stamp.visited_on} entityId={stamp.entity_id || stamp.id} width={150} overprint film={stamp.meta?.film || null} />
          )}
          <h1 className="text-center" style={{ fontFamily: SERIF, fontSize: fs(30), lineHeight: 1.02, color: INK, marginTop: 10, fontWeight: 400 }}>{stamp.name}</h1>
          {place && <p className="text-center" style={{ fontSize: fs(13), color: INK3, marginTop: 4 }}>{place}</p>}
        </div>

        {(loadingStory || story || (facts && (facts.facts?.length || facts.wikipedia))) && (
          <div className="mx-4 mt-3.5 flex flex-col gap-2.5">
            {loadingStory && (
              <p className="flex items-center gap-2" style={{ fontSize: fs(13), color: INK3 }}><Loader2 size={14} className="animate-spin" /> Reading up on this place…</p>
            )}
            {story?.why_visit && <p style={{ fontSize: fs(15), lineHeight: 1.5, color: INK2, margin: 0 }}>{story.why_visit}</p>}
            {story?.story && (
              <div>
                <span style={kicker}>The story</span>
                {String(story.story).split(/\n\s*\n/).map((para, i) => (
                  <p key={i} style={{ fontSize: fs(14), lineHeight: 1.5, color: INK2, margin: "6px 0 0" }}>{para}</p>
                ))}
              </div>
            )}
            {Array.isArray(story?.can_do) && story.can_do.length > 0 && (
              <div>
                <span style={kicker}>What you can do here</span>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: INK2, fontSize: fs(14), lineHeight: 1.5 }}>
                  {story.can_do.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            )}
            {facts?.facts?.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Facts">
                {facts.facts.map((f) => (
                  <span key={f.key} className="rounded-full px-2.5 py-1" style={{ fontSize: fs(12), background: "rgba(14,124,115,.09)", color: "#1F4A45" }}>
                    {f.label}: {f.value}
                  </span>
                ))}
              </div>
            )}
            {(facts?.wikipedia?.url || story) && (
              <p className="flex flex-wrap items-center gap-x-3" style={{ ...kicker, fontSize: fs(9.5) }}>
                {facts?.wikipedia?.url && <button type="button" onClick={() => openPartner(facts.wikipedia.url)} style={{ padding: 0, border: 0, background: "transparent", font: "inherit", color: "#2B4C8C", letterSpacing: "inherit", textTransform: "inherit" }}>Read more on Wikipedia ›</button>}
                {story && <button type="button" onClick={reportStory} style={{ padding: 0, border: 0, background: "transparent", font: "inherit", color: INK3, letterSpacing: "inherit", textTransform: "inherit" }}>Something's wrong?</button>}
              </p>
            )}
          </div>
        )}

        {/* You were here */}
        <div className="mx-4 mt-4 pt-3.5 flex flex-col gap-2.5" style={{ borderTop: `1px solid ${RULE}` }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ ...kicker, color: STAMP }}>{arrival ? "You arrived" : "You were here"}</span>
            <span style={{ fontSize: fs(13), color: INK2 }}>{fmtDate(stamp.visited_on) || "Date not set"} · {verifiedWord}</span>
            {!readOnly && <button type="button" onClick={onDetails} style={{ padding: 0, border: 0, background: "transparent", font: "inherit", fontSize: fs(12.5), fontWeight: 650, color: "#2B4C8C" }}>Change the date ›</button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {photos.map((p, i) => (
              <button key={p.id || i} type="button" onClick={() => onEnlarge?.(i)} aria-label={`Open photo ${i + 1}`} className="flex-none active:scale-95 transition-transform" style={{ padding: 0, border: 0, background: "transparent" }}>
                <img src={p.photo_url} alt="" loading="lazy" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}`, display: "block" }} />
              </button>
            ))}
            {!readOnly && room > 0 && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} aria-label="Add photos" className="flex-none flex items-center justify-center disabled:opacity-60"
                style={{ width: 72, height: 72, borderRadius: 12, border: `1px dashed rgba(22,17,13,.3)`, background: "#fff", color: INK2 }}>
                {busy && busy !== "note" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} strokeWidth={2.2} />}
              </button>
            )}
          </div>
          {busy && busy !== "note" && <p style={{ fontSize: fs(12), color: INK3 }}>{busy}</p>}
          {!noteEdit ? (
            <button type="button" onClick={() => { if (!readOnly) { setNoteDraft(stamp.note || ""); setNoteEdit(true); } }} className="text-left" style={{ padding: 0, border: 0, background: "transparent", font: "inherit" }}>
              <span style={{ fontFamily: SERIF, fontSize: fs(17), lineHeight: 1.35, color: stamp.note ? INK2 : INK3, fontStyle: "italic" }}>
                {stamp.note ? `“${stamp.note}”` : readOnly ? "" : (arrival ? "What was this trip for? Add a note." : "Add a memory — who you were with, what made it the day.")}
              </span>
              {stamp.note && !readOnly && <PencilLine size={13} color={INK3} style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }} aria-hidden="true" />}
            </button>
          ) : (
            <div className="rounded-[14px] px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value.slice(0, 280))} rows={3} autoFocus
                placeholder={arrival ? "Visiting family, a conference, our honeymoon…" : "Best coffee ever… an important day… who you were with"} aria-label={arrival ? "Trip note" : "Memory"}
                className="w-full rounded-xl px-3 py-2 outline-none resize-none" style={{ border: `1px solid ${RULE}`, background: IVORY, fontSize: fs(14.5), color: INK, fontFamily: "inherit" }} />
              <div className="flex gap-2 mt-2.5">
                <button type="button" onClick={() => { setNoteEdit(false); setNoteDraft(stamp.note || ""); }} className="flex-1 rounded-xl py-2 font-semibold" style={{ background: "#fff", color: INK3, border: `1px solid ${RULE}`, fontSize: fs(13), fontFamily: "inherit" }}>Cancel</button>
                <button type="button" onClick={saveNote} disabled={busy === "note"} className="flex-1 rounded-xl py-2 font-semibold disabled:opacity-60" style={{ background: INK, color: "#fff", fontSize: fs(13), fontFamily: "inherit" }}>{busy === "note" ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two buttons, always in reach */}
      <div className="fixed left-0 right-0 bottom-0 flex justify-center" style={{ pointerEvents: "none" }}>
        <div className="w-full max-w-md flex gap-2 px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", pointerEvents: "auto" }}>
          {!readOnly && !minor && (
            <button type="button" onClick={openCompose} className="flex-1 flex items-center justify-center gap-2 rounded-xl font-bold" style={{ height: 48, background: TEAL, color: "#fff", fontSize: fs(14.5), fontFamily: "inherit", border: 0, boxShadow: "0 8px 20px -10px rgba(14,124,115,.7)" }}>
              <Send size={17} strokeWidth={2.2} aria-hidden="true" /> Send as a postcard
            </button>
          )}
          <button type="button" onClick={() => setMore(true)} className="flex items-center justify-center gap-1.5 rounded-xl font-bold" style={{ height: 48, minWidth: 108, padding: "0 16px", background: "#fff", color: INK, fontSize: fs(14.5), fontFamily: "inherit", border: `1px solid rgba(22,17,13,.18)`, boxShadow: "0 8px 20px -14px rgba(22,17,13,.5)" }}>
            <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" /> More
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
      {more && (
        <StampActions compact stamp={stamp} pages={pages} fits={fits} readOnly={readOnly}
          onClose={() => setMore(false)} onChanged={onChanged} onDetails={() => { setMore(false); onDetails?.(); }} onEnlarge={onEnlarge} />
      )}
      <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={() => setCompose(false)} blocked={blocked}
        preset={{ image: null, place_name: stamp.name, city: stamp.city, country: stamp.country }} />
    </div>
  );
}
