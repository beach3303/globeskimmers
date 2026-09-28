// StampActions — what you can do with a stamp, one tap on it in the booklet
// (founder, 2026-09-26): add memory photos (now or later), see them large,
// give the stamp its own page or send it back to share one, open its details
// (date, tag a friend), delete it, or just close. Photos can be removed here
// too. A friend's read-only view and the admin sample only get "view photos".
//
// Every write goes through src/lib/passport.js; onChanged() reloads the
// passport so the booklet repacks (a solo stamp moves to its own page at once).
import React, { useRef, useState } from "react";
import { Plus, Trash2, X, Images, BookOpen, Columns2, PencilLine, Loader2, BadgeCheck } from "lucide-react";
import { showToast } from "@/components/Toast";
import { addStamp, metersBetween, uploadStampPhoto, deleteStamp, deleteStampPhoto, setStampLayout } from "@/lib/passport";
import { stampRadiusFor } from "@/lib/stampRadius";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { resizePhoto } from "@/lib/resizePhoto";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F", IVORY = "#FFFCF7", IVORY_2 = "#F6F0E4";
const MAX_PHOTOS = 4;
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
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // "photos" | "layout" | "delete" | null
  const [confirmDel, setConfirmDel] = useState(false);
  useDismissable(true, onClose);
  const photos = Array.isArray(stamp.photos) ? stamp.photos : [];
  const room = Math.max(0, MAX_PHOTOS - photos.length);
  const solo = stamp.layout === "solo";
  const place = [stamp.city, stamp.region, stamp.country].filter(Boolean).join(", ");

  const onPick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, room);
    e.target.value = "";
    if (!files.length) return;
    setBusy("photos");
    let added = 0;
    for (const f of files) {
      try {
        const image = await resizePhoto(f);
        const { error } = await uploadStampPhoto({ stamp_id: stamp.id, image, visited_on: stamp.visited_on || undefined });
        if (error) showToast(error, "error"); else added += 1;
      } catch (err) { showToast(err?.message || "Upload failed", "error"); }
    }
    setBusy(null);
    if (added) { showToast(`${added} photo${added === 1 ? "" : "s"} added 📸`, "success"); onChanged?.(); }
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
              sub={room ? `Up to ${room} more · they print under the stamp` : "This stamp already holds 4 photos"}
              onClick={() => room && fileRef.current?.click()} disabled={busy === "photos" || !room} />
          )}
          {photos.length > 0 && (
            <Row icon={Images} label={`View photo${photos.length === 1 ? "" : "s"} (${photos.length})`} sub="Full screen — swipe through, tap × to close" onClick={() => onEnlarge?.(0)} />
          )}
          {!readOnly && (
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
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        {!readOnly && <p className="text-center mt-2" style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".04em" }}>Stamp ink: {STAMP === "#B0472F" ? "passport red" : STAMP}</p>}
      </div>
    </div>
  );
}
