// TravelerDishes — "From travelers" on a restaurant / café card: what real
// travelers ordered here, each dish with its photo and "Ordered by N travelers",
// plus the door to add yours. A post needs proof you're here (GPS at the place
// or the photo's own location tag) and passes photo review before anyone sees
// it; posts never carry a name. Loads only when the card scrolls into view.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/Toast";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import { listDishes, addDish, deleteDish } from "@/lib/dishes";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { getCurrentPositionSmart } from "@/lib/geolocation";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const IVORY = "#FAF7F0", STAMP = "#B0472F";
const fs = (n) => `calc(${n}px*var(--fs))`;
const travelers = (n, loved, fav = 0) => `Ordered by ${n} traveler${n === 1 ? "" : "s"}${loved > 0 ? ` · ${loved === n ? (n === 1 ? "loved it" : "all loved it") : `${loved} loved it`}` : ""}${fav > 0 ? ` · ⭐ favorite of ${fav}` : ""}`;

export default function TravelerDishes({ place, kind = "restaurant" }) {
  const rootRef = useRef(null);
  const [seen, setSeen] = useState(false);
  const [state, setState] = useState(null); // { dishes, mine } once loaded
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState(null);   // { photos, index, title }
  const store = kind === "store";
  const goods = kind === "coffee" ? "drinks and treats" : store ? "finds" : "dishes";

  useEffect(() => {
    const el = rootRef.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  const load = async () => {
    const r = await listDishes(place.id);
    setState({ dishes: r.dishes, mine: r.mine });
  };
  useEffect(() => { if (seen && place?.id) load(); }, [seen, place?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dishes = state?.dishes || [];
  const mine = state?.mine || [];
  const removeMine = async (id) => {
    const { error } = await deleteDish(id);
    if (error) { showToast(error, "error"); return; }
    showToast("Removed", "success");
    load();
  };

  return (
    <div ref={rootRef}>
      {dishes.length > 0 && (
        <div className="rounded-[14px] px-3.5 py-3" style={{ background: IVORY, border: `1px solid ${RULE}` }}>
          <div style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".12em", color: INK3, textTransform: "uppercase" }}>📸 From travelers</div>
          <div className="flex flex-col gap-2.5 mt-2">
            {dishes.slice(0, 3).map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <button type="button" aria-label={`Photos of ${d.dish}`} className="flex-none"
                  onClick={() => setView({ photos: d.photos.map((p) => ({ src: p.url })), index: 0, title: d.dish })}>
                  <img src={d.photos[0]?.url} alt="" loading="lazy" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: `1px solid ${RULE}`, display: "block" }} />
                </button>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontFamily: SERIF, fontSize: fs(17), color: INK, lineHeight: 1.15 }}>{d.dish}</div>
                  <div style={{ fontSize: fs(12), color: INK3, marginTop: 2 }}>{travelers(d.travelers, d.loved || 0, d.favorites || 0)}{d.photos.length > 1 ? ` · ${d.photos.length} photos` : ""}</div>
                </div>
              </div>
            ))}
          </div>
          {dishes.length > 3 && (
            <div style={{ fontSize: fs(12), color: INK3, marginTop: 8 }}>
              Also: {dishes.slice(3, 8).map((d) => d.dish).join(" · ")}
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={() => setAdding(true)}
        className="w-full mt-2 rounded-[12px] py-2.5 font-semibold"
        style={{ background: "#fff", color: STAMP, border: `1.5px dashed ${STAMP}55`, fontSize: fs(13.5) }}>
        📸 {kind === "store" ? "Add a photo of what you got here" : "Add a photo of what you ordered"}
      </button>
      {!dishes.length && (
        <p style={{ fontSize: fs(11.5), color: INK3, textAlign: "center", marginTop: 4, lineHeight: 1.4 }}>
          {store ? "Picked up something good? Snap it and let others know how you liked it 😊" : `Help everyone find delicious ${goods} — snap what you ordered and tell us if you loved it 😋`}
        </p>
      )}
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2" style={{ fontSize: fs(11.5), color: INK3 }}>
          <span>Yours:</span>
          {mine.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: IVORY, border: `1px solid ${RULE}`, color: INK2 }}>
              {m.dish}
              <button type="button" aria-label={`Remove your ${m.dish} photo`} onClick={() => removeMine(m.id)} style={{ color: INK3, fontWeight: 700 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {adding && (
        <AddDishSheet place={place} kind={kind} goods={goods} known={dishes.map((d) => d.dish)}
          onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />
      )}
      {view && (
        <PhotoLightbox photos={view.photos} index={view.index} title={view.title} credit="Shared by travelers who were here"
          onClose={() => setView(null)} onIndexChange={(i) => setView((v) => (v ? { ...v, index: i } : v))} />
      )}
    </div>
  );
}

function AddDishSheet({ place, kind, goods, known, onClose, onAdded }) {
  useDismissable(true, onClose);
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dish, setDish] = useState("");
  const [liked, setLiked] = useState(null); // true = loved it, false = it was OK
  const [favorite, setFavorite] = useState(false); // "this is my favorite dish here"
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f); setNote(null);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !dish.trim() || busy) return;
    setBusy(true); setNote(null);
    try {
      const exif = await readPhotoExif(file);   // before resizing strips it
      const image = await resizePhoto(file);
      let gps = null;
      try {
        const pos = await getCurrentPositionSmart({ timeout: 8000 });
        if (pos?.coords) gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
      } catch { /* no GPS — the photo's own location can still prove it */ }
      const { data, error, proofNeeded } = await addDish({ place, kind, dish: dish.trim(), liked, favorite, image, gps, exif });
      if (proofNeeded) { setNote(error); return; }
      if (error) { setNote(error); return; }
      showToast(data?.replaced ? "Photo updated 📸" : "Thank you! Your order is up 🍽️", "success");
      onAdded();
    } catch (err) {
      setNote(err?.message || "Upload failed — try again");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[22px] px-5 pt-4 pb-6" style={{ background: "#F3EEE1", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ fontFamily: SERIF, fontSize: fs(24), color: INK, lineHeight: 1.1 }}>{kind === "store" ? "Add a photo of what you got" : "Add a photo of what you ordered"}</div>
        <div className="truncate" style={{ fontSize: fs(12.5), color: INK3, marginTop: 2 }}>{place.name}</div>
        <p style={{ fontSize: fs(13), color: INK2, lineHeight: 1.45, marginTop: 6 }}>
          {kind === "store" ? "Could be anything — a snack, a drink, a find. We\u2019ll let others know how you liked it 😊" : `Help everyone find delicious ${goods}! Add a photo of what you ordered — and let us know if you loved it 😊`}
        </p>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full mt-3 rounded-[16px] overflow-hidden flex items-center justify-center"
          style={{ height: 180, background: preview ? "#000" : "#fff", border: preview ? "none" : `1.5px dashed ${RULE}` }}>
          {preview
            ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: fs(14), color: INK2 }}>📷 Take or choose a photo</span>}
        </button>

        <input value={dish} onChange={(e) => setDish(e.target.value.slice(0, 60))} maxLength={60}
          placeholder={kind === "coffee" ? "What did you order? e.g. Iced oat latte" : kind === "store" ? "What did you get? e.g. Matcha Kit Kat" : "What did you order? e.g. Al pastor tacos"} aria-label={kind === "store" ? "What you got" : "What you ordered"}
          className="w-full mt-3 rounded-xl px-3 h-11 outline-none" style={{ background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(15), color: INK }} />
        {known.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {known.slice(0, 6).map((k) => (
              <button key={k} type="button" onClick={() => setDish(k)} className="rounded-full px-2.5 py-1"
                style={{ background: dish === k ? INK : "#fff", color: dish === k ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(12) }}>{k}</button>
            ))}
          </div>
        )}

        <div style={{ fontSize: fs(13), color: INK2, marginTop: 12 }}>Did you like it?</div>
        <div className="flex gap-2 mt-1.5">
          {[[true, "😋 Loved it"], [false, "🙂 It was OK"]].map(([v, label]) => (
            <button key={label} type="button" onClick={() => setLiked(liked === v ? null : v)} aria-pressed={liked === v}
              className="flex-1 rounded-full py-2 font-semibold"
              style={{ background: liked === v ? INK : "#fff", color: liked === v ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>{label}</button>
          ))}
        </div>

        {/* Founder, 2026-10-05: "a check box … this is my favorite dish in this
            restaurant". One per traveler per place — a new pick replaces the old. */}
        <label className="flex items-center gap-2.5 mt-3 rounded-xl px-3 py-2.5 cursor-pointer" style={{ background: "#fff", border: `1px solid ${favorite ? STAMP : RULE}` }}>
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} style={{ width: 18, height: 18, accentColor: STAMP }} />
          <span style={{ fontSize: fs(13.5), color: INK }}>
            ⭐ This is my favorite {kind === "restaurant" ? "dish at this restaurant" : "here"}
          </span>
        </label>

        <p style={{ fontSize: fs(11.5), color: INK3, lineHeight: 1.45, marginTop: 10 }}>
          📍 We check that you're here — your location now, or where the photo was taken. Shared without your name, after a quick photo review.
        </p>
        {note && <p role="alert" style={{ fontSize: fs(12.5), color: STAMP, lineHeight: 1.4, marginTop: 6 }}>{note}</p>}

        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
          <button type="button" onClick={submit} disabled={!file || !dish.trim() || busy} className="flex-1 rounded-xl py-3 font-semibold disabled:opacity-50"
            style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>{busy ? "Checking…" : "Share"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
