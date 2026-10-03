// StampActions — what you can do with a stamp, one tap on it in the booklet
// (founder, 2026-09-26): add memory photos (now or later), see them large,
// give the stamp its own page or send it back to share one, open its details
// (date, tag a friend), delete it, or just close. Photos can be removed here
// too. A friend's read-only view and the admin sample only get "view photos".
//
// Every write goes through src/lib/passport.js; onChanged() reloads the
// passport so the booklet repacks (a solo stamp moves to its own page at once).
import React, { useRef, useState } from "react";
import { Plus, Trash2, X, Images, BookOpen, Columns2, PencilLine, Loader2, BadgeCheck, ScanSearch, ArrowUpDown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openAttraction } from "@/lib/openAttraction";
import { showToast } from "@/components/Toast";
import { addStamp, metersBetween, uploadStampPhoto, deleteStamp, deleteStampPhoto, setStampLayout, setStampPos, isPhotoFirst, checkStampPhotos, isVerified, proofToast } from "@/lib/passport";
import { readPhotoExif } from "@/lib/photoExif";
import { logEvent } from "@/lib/analytics";
import { stampRadiusFor } from "@/lib/stampRadius";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { resizePhoto } from "@/lib/resizePhoto";
import { useDismissable } from "@/lib/dismissStack";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { socialFollow, setStampNote } from "@/lib/passport";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", IVORY = "#FFFCF7", IVORY_2 = "#F6F0E4";
const MAX_PHOTOS = 30; // the page prints the first 4; the album (lightbox/packets) holds them all
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

function Row({ icon: Icon, label, sub, onClick, disabled, tone }) {
  const color = tone === "danger" ? "#C2392F" : INK;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-left disabled:opacity-50"
      style={{ background: "#fff", border: `1px solid ${RULE}`, fontFamily: "inherit" }}>
      <span className="flex-none w-9 h-9 rounded-full flex items-center justify-center" style={{ background: tone === "danger" ? "#FBE0DC" : IVORY_2 }}>
        <Icon size={17} color={color} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold" style={{ color, fontSize: fs(14.5) }}>{label}</span>
        {sub && <span className="block" style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.35, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

export default function StampActions({ stamp, onClose, onChanged, onDetails, onEnlarge, readOnly }) {
  const navigate = useNavigate();
  // An attraction stamp opens its place's Things to Do card (prices, guestbook…).
  const canSeePlace = stamp.kind === "attraction" && !!stamp.entity_id;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // "photos" | "layout" | "delete" | null
  const [confirmDel, setConfirmDel] = useState(false);
  // Trip note (airport / border arrivals): "what was this trip for?" — private
  // unless the traveler shows it on their shared passport.
  const arrival = stamp.kind === "airport" || stamp.entity_type === "border";
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteDraft, setNoteDraft] = useState(stamp.note || "");
  const [notePublic, setNotePublic] = useState(stamp.note_public === true);
  const [noteBusy, setNoteBusy] = useState(false);
  const saveNote = async () => {
    setNoteBusy(true);
    const { error } = await setStampNote(stamp.id, { note: noteDraft.trim(), isPublic: notePublic });
    setNoteBusy(false);
    if (error) { showToast(error, "error"); return; }
    setNoteEdit(false);
    showToast(noteDraft.trim() ? (notePublic ? "Note shared on your passport 🌍" : "Saved privately 🔒") : "Note removed", "success");
    onChanged?.();
  };
  const [compose, setCompose] = useState(false);
  const [following, setFollowing] = useState([]);
  const openCompose = async () => {
    const { data } = await socialFollow("list");
    setFollowing(data?.following || []);
    setCompose(true);
  };
  useDismissable(true, onClose);
  const photos = Array.isArray(stamp.photos) ? stamp.photos : [];
  const room = Math.max(0, MAX_PHOTOS - photos.length);
  const solo = stamp.layout === "solo";
  // A scene stamp with photos prints photo-first on a page of its own, so the
  // page-sharing row gives way to where the stamp sits on the photo.
  const photoFirst = isPhotoFirst(stamp);
  const stampPos = stamp.meta?.stamp_pos === "top" || stamp.meta?.stamp_pos === "bottom" ? stamp.meta.stamp_pos : "auto";
  const place = [stamp.city, stamp.region, stamp.country].filter(Boolean).join(", ");

  const onPick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, room);
    e.target.value = "";
    if (!files.length) return;
    setBusy("photos");
    let added = 0, proof = null;
    for (const f of files) {
      try {
        const exif = await readPhotoExif(f);   // before resizing strips it
        logEvent("passport_photo_exif", { has_gps: !!(exif && exif.lat != null), has_time: !!(exif && exif.taken_at) }, "Passport");
        const image = await resizePhoto(f);
        const { data, error } = await uploadStampPhoto({ stamp_id: stamp.id, image, visited_on: stamp.visited_on || undefined, exif });
        if (error) showToast(error, "error"); else { added += 1; if (data?.proof && !proof) proof = data.proof; }
      } catch (err) { showToast(err?.message || "Upload failed", "error"); }
    }
    setBusy(null);
    if (added) { showToast(proofToast(proof) || `${added} photo${added === 1 ? "" : "s"} added 📸`, "success"); onChanged?.(); }
  };
  const removePhoto = async (photoId) => {
    const { error } = await deleteStampPhoto(photoId);
    if (error) showToast(error, "error"); else { showToast("Photo removed", "success"); onChanged?.(); }
  };
  const toggleLayout = async () => {
    setBusy("layout");
    const { error } = await setStampLayout(stamp.id, solo ? "auto" : "solo");
    setBusy(null);
    if (error) { showToast(error, "error"); return; }
    showToast(solo ? "This stamp now shares a page" : "This stamp has its own page", "success");
    onChanged?.();
  };
  const movePos = async (next) => {
    if (next === stampPos) return;
    setBusy("pos");
    const { error } = await setStampPos(stamp.id, next);
    setBusy(null);
    if (error) { showToast(error, "error"); return; }
    showToast(next === "top" ? "The stamp sits above the photo" : next === "bottom" ? "The stamp sits below the photo" : "GlobeSkimmers picks the clear edge of each photo", "success");
    onChanged?.();
  };
  // "Verify I'm here" (founder, 2026-09-28): a stamp that isn't GPS-verified
  // can earn the ✓ while you're standing there — one fix, within the place's
  // stamp radius (an airport's perimeter is wide, 3 km). The re-stamp upgrades
  // it in place (gps > photo > self); the worker still cross-checks country and
  // travel speed, so a VPN or a spoofed fix leaves it as it was.
  const canVerify = !readOnly && stamp.verified !== "gps" && !!stamp.entity_id && Number.isFinite(+stamp.lat) && Number.isFinite(+stamp.lng) && (+stamp.lat !== 0 || +stamp.lng !== 0);
  const verifyHere = async () => {
    setBusy("verify");
    const pos = await new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    });
    if (!pos) { setBusy(null); showToast("Turn on location for GlobeSkimmers to verify this stamp", "error"); return; }
    const m = metersBetween(pos.coords.latitude, pos.coords.longitude, +stamp.lat, +stamp.lng);
    const radius = stamp.kind === "airport" ? 3000 : stampRadiusFor({ name: stamp.name });
    if (m > radius) {
      setBusy(null);
      showToast(`You're about ${m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`} from ${stamp.name} — verify while you're there`, "error");
      return;
    }
    const c = String(stamp.country || "");
    const cc = /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : (countryCode(c) || undefined);
    const { data, error } = await addStamp({
      kind: stamp.kind, tier: stamp.tier, entity_type: stamp.entity_type, entity_id: stamp.entity_id,
      name: stamp.name, city: stamp.city, region: stamp.region, country: stamp.country, cc,
      lat: +stamp.lat, lng: +stamp.lng, visited_on: stamp.visited_on || localISODate(),
      local_hour: new Date().getHours(), verified: "gps",
    });
    setBusy(null);
    if (error) { showToast(error, "error"); return; }
    if (data?.verified === "gps") { showToast("✓ Verified — you're really here", "success"); onChanged?.(); }
    else showToast("Couldn't confirm your location (VPN or roaming?) — the stamp stays as it was", "error");
  };
  // Place recognition on photos already on the stamp (stored without their
  // location tags, so recognition is the proof left for them).
  const canCheckPhotos = !readOnly && photos.length > 0 && !isVerified(stamp.verified);
  const checkPhotos = async () => {
    setBusy("check");
    const { data, error } = await checkStampPhotos(stamp.id);
    setBusy(null);
    if (error) { showToast(error, "error"); return; }
    if (isVerified(data?.verified)) { showToast(proofToast("photo_ai"), "success"); onChanged?.(); }
    else showToast("Your photos don't show the place clearly enough to verify it — Verify I'm here works next time you're there", "error");
  };
  const removeStamp = async () => {
    setBusy("delete");
    const { error } = await deleteStamp(stamp.id);
    setBusy(null); setConfirmDel(false);
    if (error) { showToast(error, "error"); return; }
    showToast("Stamp removed", "success");
    onChanged?.(); onClose?.();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Options for ${stamp.name}`}
      style={{ background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[22px] px-4 pt-3 overflow-y-auto"
        style={{ background: IVORY, maxHeight: "88vh", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: RULE }} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(21), color: INK, lineHeight: 1.15 }}>{stamp.name}</p>
            {place && <p className="truncate" style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK3, marginTop: 2 }}>{place}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-none w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            <X size={17} color={INK} strokeWidth={2.2} />
          </button>
        </div>

        {arrival && !readOnly && (
          <div className="mt-3 rounded-[14px] px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
            {!noteEdit ? (
              <button type="button" onClick={() => setNoteEdit(true)} className="w-full text-left">
                <span className="block uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", color: "#8A5410" }}>
                  ✈️ Trip note · {stamp.note && stamp.note_public ? "🌍 Shared" : "🔒 Private"}
                </span>
                <span className="block" style={{ fontFamily: SERIF, fontSize: fs(16), color: stamp.note ? INK : INK3, marginTop: 3, lineHeight: 1.3 }}>
                  {stamp.note || "What was this trip for? Add a note only you can see."}
                </span>
              </button>
            ) : (
              <>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value.slice(0, 280))} rows={3} autoFocus
                  placeholder="Visiting family, a conference, our honeymoon…" aria-label="Trip note"
                  className="w-full rounded-xl px-3 py-2 outline-none resize-none" style={{ border: `1px solid ${RULE}`, background: IVORY, fontSize: fs(14.5), color: INK }} />
                <label className="flex items-center gap-2 mt-2" style={{ fontSize: fs(12.5), color: INK3 }}>
                  <input type="checkbox" checked={notePublic} onChange={(e) => setNotePublic(e.target.checked)} />
                  Show on my shared passport
                </label>
                <div className="flex gap-2 mt-2.5">
                  <button type="button" onClick={() => { setNoteEdit(false); setNoteDraft(stamp.note || ""); setNotePublic(stamp.note_public === true); }} className="flex-1 rounded-xl py-2 font-semibold" style={{ background: "#fff", color: INK3, border: `1px solid ${RULE}`, fontSize: fs(13) }}>Cancel</button>
                  <button type="button" onClick={saveNote} disabled={noteBusy} className="flex-1 rounded-xl py-2 font-semibold disabled:opacity-60" style={{ background: "#B0472F", color: "#fff", fontSize: fs(13) }}>{noteBusy ? "Saving…" : "Save"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Memory photos — tap to enlarge (swipe through them), × removes one */}
        {photos.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {photos.map((p, i) => (
              <div key={p.id} className="relative shrink-0">
                <button type="button" onClick={() => onEnlarge?.(i)} aria-label={`Open photo ${i + 1}`} className="block active:scale-95 transition-transform" style={{ padding: 0, border: "none", background: "transparent" }}>
                  <img src={p.photo_url} alt="" loading="lazy" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}`, display: "block" }} />
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => removePhoto(p.id)} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.72)", border: "1.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}>
                    <X size={13} color="#fff" strokeWidth={2.75} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-3">
          {!readOnly && (
            <Row icon={busy === "photos" ? Loader2 : Plus} label={photos.length ? "Add more memory photos" : "Add memory photos"}
              sub={room ? (stamp.meta?.film ? `Up to ${room} more · your first photo opens full on the page` : `Up to ${room} more · 4 print under the stamp, the rest fill the album`) : "This album is full (30 photos)"}
              onClick={() => room && fileRef.current?.click()} disabled={busy === "photos" || !room} />
          )}
          {photos.length > 0 && (
            <Row icon={Images} label={`View photo${photos.length === 1 ? "" : "s"} (${photos.length})`} sub="Full screen — swipe through, tap × to close" onClick={() => onEnlarge?.(0)} />
          )}
          {!readOnly && photoFirst && (
            <div className="w-full rounded-[14px] px-3.5 py-3" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <div className="flex items-center gap-3">
                <span className="flex-none w-9 h-9 rounded-full flex items-center justify-center" style={{ background: IVORY_2 }}>
                  {busy === "pos" ? <Loader2 size={17} color={INK} strokeWidth={2.1} className="animate-spin" /> : <ArrowUpDown size={17} color={INK} strokeWidth={2.1} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold" style={{ color: INK, fontSize: fs(14.5) }}>Where the stamp sits</span>
                  <span className="block" style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.35, marginTop: 1 }}>So it never hides the view in your photo</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2.5" role="radiogroup" aria-label="Where the stamp sits">
                {[["auto", "Auto"], ["top", "Above photo"], ["bottom", "Below photo"]].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={stampPos === v} disabled={busy === "pos"} onClick={() => movePos(v)}
                    className="rounded-lg py-2 font-semibold disabled:opacity-60"
                    style={{ fontSize: fs(12.5), fontFamily: "inherit", background: stampPos === v ? INK : IVORY, color: stampPos === v ? "#fff" : INK2, border: `1px solid ${stampPos === v ? INK : RULE}` }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!readOnly && !photoFirst && (
            <Row icon={solo ? Columns2 : BookOpen}
              label={solo ? "Share a page with other stamps" : "Give this stamp its own page"}
              sub={solo ? "Back into the flow — it packs in beside other stamps" : "A solo page, nothing else on it"}
              onClick={toggleLayout} disabled={busy === "layout"} />
          )}
          {canVerify && (
            <Row icon={busy === "verify" ? Loader2 : BadgeCheck} label="Verify I'm here"
              sub="Uses your location once to earn the green ✓ — works while you're at the place"
              onClick={verifyHere} disabled={busy === "verify"} />
          )}
          {canCheckPhotos && (
            <Row icon={busy === "check" ? Loader2 : ScanSearch} label="Check my photos for proof"
              sub="Looks for the place itself in your photos — selfies alone can't prove it"
              onClick={checkPhotos} disabled={busy === "check"} />
          )}
          {canSeePlace && (
            <Row icon={MapPin} label="See this place" sub="Prices, parking, tips and its guestbook"
              onClick={() => { onClose?.(); openAttraction(navigate, { id: stamp.entity_id, name: stamp.name, lat: stamp.lat, lng: stamp.lng }, "From your passport"); }} />
          )}
          {!readOnly && (
            <Row icon={PencilLine} label="Send as a postcard" sub="This place's photo on the front, your words on the back" onClick={openCompose} />
          )}
          {!readOnly && (
            <Row icon={PencilLine} label="Details, date & tag a friend" sub="Set the real visit date, invite who you were with" onClick={onDetails} />
          )}
          {!readOnly && !confirmDel && (
            <Row icon={Trash2} label="Delete this stamp" sub="Its photos go with it" tone="danger" onClick={() => setConfirmDel(true)} />
          )}
          {!readOnly && confirmDel && (
            <div className="rounded-[14px] p-3" style={{ background: "#FBE0DC", border: "1px solid #F1B8B0" }}>
              <p style={{ color: "#A82C24", fontSize: fs(13), fontWeight: 600, lineHeight: 1.4 }}>Delete {stamp.name}? Its photos are removed too.</p>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setConfirmDel(false)} disabled={busy === "delete"} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>Keep it</button>
                <button type="button" onClick={removeStamp} disabled={busy === "delete"} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: "#C2392F", color: "#fff", fontSize: fs(13) }}>{busy === "delete" ? "Removing…" : "Delete"}</button>
              </div>
            </div>
          )}
          <button type="button" onClick={onClose} className="w-full rounded-[14px] py-2.5 font-semibold mt-1" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5), fontFamily: "inherit" }}>
            Close
          </button>
        </div>
        <PostcardCompose open={compose} onClose={() => setCompose(false)} onSent={() => setCompose(false)} following={following}
        preset={{ image: null, place_name: stamp.name, city: stamp.city, country: stamp.country }} />
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        {!readOnly && <p className="text-center mt-2" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".04em" }}>Stamp ink: {STAMP === "#B0472F" ? "passport red" : STAMP}</p>}
      </div>
    </div>
  );
}
