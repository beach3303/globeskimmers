// PhotoSorter — photos from the gallery, sorted into the places they were taken (founder,
// 2026-10-17: travelers upload several photos at once, taken on different days in different
// places, and "people get so confused"). Each photo's own location tag and capture time put it
// with the others taken within PLACE_M and DAYS of it: the reach of a stamp's photo proof (the
// worker's ppPhotoLocProves: 400 m from the stamp's spot, 2 days from its date), so every group
// proves its own stamp. A group at a stamp you already have adds its photos there; photos with no
// location stamp by search; photos from before stamps begin are shown, not stamped. The Passport
// then opens Stamp a place for each new place in turn ("Place 1 of 3").
//
//   <PhotoSorter files stamps shared onClose onStamp onChanged />
//   files      File[] from Upload photos, or shared from the phone's gallery (src/lib/sharedPhotos.js)
//   stamps     the owner's stamps (listPassport), to find one a group belongs to
//   shared     a share from the gallery asks first: stamp the places, or send a postcard
//   onStamp    ([{ files, placeHint }]) — one per new place, in order; placeHint is the place
//              lookup already made for its first photo, so Stamp a place doesn't ask again
//   onChanged  photos were added to a stamp you have (the Passport reloads)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Mail, MapPin, Stamp } from "lucide-react";
import { IVORY, IVORY_2 } from "@/components/redesign/constants";
import { showToast } from "@/components/Toast";
import PostcardCompose from "@/components/passport/PostcardCompose";
import { metersBetween, photoOptions, photoPlace, uploadStampPhoto, STAMP_EARLIEST } from "@/lib/passport";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { LOOKS, isPlain, lookFor, renderLook } from "@/lib/photoLook";
import { localISODate } from "@/lib/localDate";
import { useDismissable } from "@/lib/dismissStack";
import useCircle from "@/lib/useCircle";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// A stamp sits where its first photo was taken, kept to about a city block (3 decimals, up to
// ~80 m off), so a group stays inside 300 m of that photo to keep every photo within the 400 m proof.
const PLACE_M = 300;
const PROOF_M = 400;
const DAYS = 2;
// A stamp's album holds 30 photos (StampActions' MAX_PHOTOS).
const ALBUM_MAX = 30;

const dayGap = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
const short = (d) => {
  const t = new Date(`${d}T00:00:00`);
  const sameYear = t.getFullYear() === new Date().getFullYear();
  return t.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
};
// "Oct 12–13" in one month, "Oct 30 – Nov 1" across two.
const span = (a, b) => {
  if (!a) return "";
  if (!b || b === a) return short(a);
  return a.slice(0, 7) === b.slice(0, 7) && a.slice(0, 4) === String(new Date().getFullYear()) ? `${short(a)}–${Number(b.slice(8, 10))}` : `${short(a)} – ${short(b)}`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Rows for the list: { key, kind: 'new' | 'add' | 'noloc' | 'old', items: [{ file, exif, day, at }],
// at, day, lastDay, stamp? }. New places first (by date), then additions, no location, too old.
export async function sortPhotos(files, stamps = []) {
  const today = localISODate();
  const items = await Promise.all(files.map(async (file, i) => {
    const exif = await readPhotoExif(file).catch(() => null);
    const d = String(exif?.taken_at || "").slice(0, 10);
    // A screenshot or a chat photo has no date; a camera clock set ahead dates it in the future.
    const day = /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : null;
    const at = Number.isFinite(exif?.lat) && Number.isFinite(exif?.lng) && !(exif.lat === 0 && exif.lng === 0) ? { lat: exif.lat, lng: exif.lng } : null;
    return { file, exif, day, at, i };
  }));
  const tooOld = (p) => !!p.day && p.day < STAMP_EARLIEST;
  const byDay = (a, b) => (a.day || "9999").localeCompare(b.day || "9999") || a.i - b.i;
  const rows = [];

  const placed = [];
  for (const p of items.filter((x) => x.at && !tooOld(x)).sort(byDay)) {
    const g = placed.find((r) => metersBetween(r.at.lat, r.at.lng, p.at.lat, p.at.lng) <= PLACE_M && (!p.day || !r.day || dayGap(r.day, p.day) <= DAYS));
    if (g) { g.items.push(p); if (p.day && (!g.lastDay || p.day > g.lastDay)) g.lastDay = p.day; if (!g.day) g.day = p.day; }
    else placed.push({ at: p.at, day: p.day, lastDay: p.day, items: [p] });
  }
  for (const g of placed) {
    // A stamp you already have, where and when these were taken: the photos join its album.
    const stamp = stamps.find((s) => Number.isFinite(+s.lat) && Number.isFinite(+s.lng)
      && metersBetween(+s.lat, +s.lng, g.at.lat, g.at.lng) <= PROOF_M
      && (!g.day || !s.visited_on || dayGap(String(s.visited_on).slice(0, 10), g.day) <= DAYS)
      && (s.photos?.length || 0) < ALBUM_MAX);
    rows.push({ ...g, key: `p${rows.length}`, kind: stamp ? "add" : "new", stamp: stamp || null });
  }
  // No location: one row per day, since a day's photos are most likely one place.
  const noloc = {};
  for (const p of items.filter((x) => !x.at && !tooOld(x)).sort(byDay)) {
    const k = p.day || "?";
    if (!noloc[k]) noloc[k] = [];
    noloc[k].push(p);
  }
  for (const [day, list] of Object.entries(noloc)) rows.push({ key: `n${day}`, kind: "noloc", day: day === "?" ? null : day, lastDay: null, at: null, items: list });
  const old = items.filter(tooOld).sort(byDay);
  if (old.length) rows.push({ key: "old", kind: "old", day: old[0].day, lastDay: old[old.length - 1].day, at: null, items: old });
  const rank = { new: 0, add: 1, noloc: 2, old: 3 };
  return rows.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

// The postcard sheet, with the circle it addresses (read only when a postcard is chosen).
function SharedPostcard({ image, onClose }) {
  const circle = useCircle();
  return (
    <PostcardCompose open preset={{ image }} onClose={onClose} onSent={onClose}
      following={circle.acc || []} followerCount={circle.counts?.followYou ?? null} blocked={circle.blocked} />
  );
}

// Up to `max` photos fanned out; srcs are the sorter's object URLs (one per photo, kept while it's open).
function Thumbs({ srcs, size = 44, max = 3 }) {
  const urls = srcs.slice(0, max);
  return (
    <div className="relative flex-none" style={{ width: size + (urls.length - 1) * 8, height: size }}>
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" className="absolute top-0" style={{ left: i * 8, width: size, height: size, objectFit: "cover", borderRadius: 10, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(22,17,13,.18)", zIndex: max - i }} />
      ))}
    </div>
  );
}

export default function PhotoSorter({ files, stamps = [], shared = false, onClose, onStamp, onChanged }) {
  // ask (a share: stamp or postcard) → reading → list; or pick (which photo goes on the postcard) → postcard.
  const [phase, setPhase] = useState(shared ? "ask" : "reading");
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});        // row key → { name, sub, data }
  const [picked, setPicked] = useState(() => new Set());
  const [look, setLook] = useState("none");   // one of our looks for every photo here (2026-10-19)
  const [busy, setBusy] = useState(null);        // "Adding photos to Eiffel Tower…"
  const [postcardImage, setPostcardImage] = useState(null);
  const startedRef = useRef(false);
  useDismissable(phase !== "postcard" && !busy, onClose);
  const srcOf = useMemo(() => new Map(files.map((f) => [f, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => srcOf.forEach((u) => URL.revokeObjectURL(u)), [srcOf]);
  const srcs = (list) => list.map((f) => srcOf.get(f)).filter(Boolean);
  // The reading outlives the Passport's re-renders; only closing the sheet drops its answer.
  const onStampRef = useRef(onStamp);
  onStampRef.current = onStamp;
  const openRef = useRef(true);
  useEffect(() => () => { openRef.current = false; }, []);

  // Read every photo, group them, and name each new place (one lookup per place, at its first photo).
  useEffect(() => {
    if (phase !== "reading" || startedRef.current) return;
    startedRef.current = true;
    const t0 = Date.now();
    (async () => {
      const sorted = await sortPhotos(files, stamps);
      const looked = await Promise.all(sorted.map(async (r) => {
        if (r.kind !== "new") return [r.key, null];
        const at = { lat: Math.round(r.at.lat * 1000) / 1000, lng: Math.round(r.at.lng * 1000) / 1000 };
        const data = await Promise.race([photoPlace(at.lat, at.lng), new Promise((res) => setTimeout(() => res(null), 10000))]).catch(() => null);
        const o = photoOptions(data)[0];
        return [r.key, o ? { name: o.name, sub: o.sub, data } : { name: "A place to confirm", sub: "", data: null }];
      }));
      // The reading takes a visible beat (founder, 2026-10-14: "you need time … to sense it").
      await new Promise((res) => setTimeout(res, Math.max(0, 1100 - (Date.now() - t0))));
      if (!openRef.current) return;
      const stampable = sorted.filter((r) => r.kind !== "old");
      // One place, nothing else to decide: straight to Stamp a place.
      if (stampable.length === 1 && sorted.length === 1 && stampable[0].kind !== "add") {
        const r = stampable[0];
        const n = Object.fromEntries(looked)[r.key];
        onStampRef.current([{ files: r.items.map((p) => p.file), placeHint: n?.data || null }]);
        return;
      }
      setRows(sorted);
      setNames(Object.fromEntries(looked.filter(([, v]) => v)));
      setPicked(new Set(stampable.map((r) => r.key)));
      setPhase("list");
    })();
  }, [phase, files, stamps]);

  const choosePostcard = async (file) => {
    try { setPostcardImage(await resizePhoto(file)); setPhase("postcard"); }
    catch { showToast("Couldn't read that photo", "error"); }
  };

  const chosen = rows.filter((r) => picked.has(r.key));
  const toStamp = chosen.filter((r) => r.kind === "new" || r.kind === "noloc");
  const toAdd = chosen.filter((r) => r.kind === "add");
  const places = rows.filter((r) => r.kind !== "old").length;
  const go = async () => {
    for (const r of toAdd) {
      let added = 0;
      const room = Math.max(0, ALBUM_MAX - (r.stamp.photos?.length || 0));
      const list = r.items.slice(0, room);
      for (let i = 0; i < list.length; i++) {
        setBusy(list.length > 1 ? `Adding photo ${i + 1} of ${list.length} to ${r.stamp.name}…` : `Adding your photo to ${r.stamp.name}…`);
        try {
          const plain = await resizePhoto(list[i].file);
          const image = isPlain(lookFor(look)) ? plain : await renderLook(plain, lookFor(look));
          const up = await uploadStampPhoto({ stamp_id: r.stamp.id, image, exif: list[i].exif || undefined });
          if (!up?.error) added += 1;
        } catch { /* skip a bad photo */ }
      }
      showToast(added ? `${plural(added, "photo", "photos")} added to your ${r.stamp.name} stamp` : `Couldn't add the photos to ${r.stamp.name}`, added ? "success" : "error");
    }
    setBusy(null);
    if (toAdd.length) onChanged?.();
    if (toStamp.length) onStamp(toStamp.map((r) => ({ files: r.items.map((p) => p.file), placeHint: names[r.key]?.data || null, look: look === "none" ? null : lookFor(look) })));
    else onClose();
  };
  const goLabel = toStamp.length && !toAdd.length ? `Stamp ${plural(toStamp.length, "place", "places")}`
    : toAdd.length && !toStamp.length ? (toAdd.length === 1 ? "Add the photos" : `Add to ${toAdd.length} stamps`)
    : "Continue";

  if (phase === "postcard") return <SharedPostcard image={postcardImage} onClose={onClose} />;

  const toggle = (key) => setPicked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const rowText = (r) => {
    const n = r.items.length;
    if (r.kind === "add") return { title: r.stamp.name, sub: `Add ${plural(n, "photo", "photos")} to your stamp${r.stamp.visited_on ? ` from ${short(String(r.stamp.visited_on).slice(0, 10))}` : ""}` };
    if (r.kind === "noloc") return { title: "No location saved", sub: `${r.day ? `${short(r.day)} · ` : ""}${plural(n, "photo", "photos")} · you'll search for the place` };
    if (r.kind === "old") return { title: "Before stamps begin", sub: `${plural(n, "photo", "photos")} from ${span(r.day, r.lastDay)} · stamps go back to ${short(STAMP_EARLIEST)}` };
    const nm = names[r.key];
    const extra = n > 4 ? ` · first 4 on the stamp, the rest in its album` : "";
    return { title: nm?.name || "A place to confirm", sub: [nm?.sub, span(r.day, r.lastDay), plural(n, "photo", "photos")].filter(Boolean).join(" · ") + extra };
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Your photos">
      <button aria-label="Close" onClick={busy ? undefined : onClose} className="absolute inset-0" style={{ background: "rgba(22,17,13,.5)" }} />
      <div className="relative w-full max-w-md rounded-t-3xl px-4 pt-4 pb-6 flex flex-col" style={{ background: IVORY, maxHeight: "86vh" }}>
        {phase === "ask" && (
          <>
            <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK }}>{files.length === 1 ? "Your photo" : `Your ${files.length} photos`}</p>
            <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 2 }}>What would you like to do?</p>
            <div className="mt-3"><Thumbs srcs={srcs(files)} size={52} max={5} /></div>
            <button type="button" onClick={() => setPhase("reading")} className="w-full text-left flex items-center gap-3 rounded-2xl mt-4" style={{ padding: 14, background: "#fff", border: `1px solid ${RULE}` }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: IVORY_2, display: "grid", placeItems: "center", flexShrink: 0 }}><Stamp size={19} color={STAMP} /></span>
              <span>
                <span style={{ display: "block", fontSize: fs(15), fontWeight: 700, color: INK }}>{files.length === 1 ? "Get a stamp" : "Get stamps"}</span>
                <span style={{ display: "block", fontSize: fs(12), color: INK3, marginTop: 2, lineHeight: 1.35 }}>{files.length === 1 ? "Where this photo was taken." : "Where each photo was taken, one place at a time."}</span>
              </span>
            </button>
            <button type="button" onClick={() => (files.length === 1 ? choosePostcard(files[0]) : setPhase("pick"))} className="w-full text-left flex items-center gap-3 rounded-2xl mt-2" style={{ padding: 14, background: "#fff", border: `1px solid ${RULE}` }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: IVORY_2, display: "grid", placeItems: "center", flexShrink: 0 }}><Mail size={19} color={STAMP} /></span>
              <span>
                <span style={{ display: "block", fontSize: fs(15), fontWeight: 700, color: INK }}>Send as a postcard</span>
                <span style={{ display: "block", fontSize: fs(12), color: INK3, marginTop: 2, lineHeight: 1.35 }}>A photo and a note to your circle.</span>
              </span>
            </button>
            <button onClick={onClose} className="w-full rounded-xl py-2.5 font-semibold mt-3" style={{ background: "transparent", color: INK3, fontSize: fs(14) }}>Not now</button>
          </>
        )}

        {phase === "pick" && (
          <PostcardPick files={files} srcs={srcs(files)} onPick={choosePostcard} onBack={() => setPhase("ask")} />
        )}

        {phase === "reading" && (
          <div className="flex flex-col items-center text-center py-6">
            <Thumbs srcs={srcs(files)} size={56} max={5} />
            <p className="mt-4 flex items-center gap-2" style={{ fontSize: fs(15), fontWeight: 600, color: INK }}>
              <Loader2 size={16} className="animate-spin" color={STAMP} /> Reading your photos…
            </p>
            <p style={{ color: INK3, fontSize: fs(12.5), marginTop: 4 }}>Finding where and when each one was taken.</p>
          </div>
        )}

        {phase === "list" && (
          <>
            <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK }}>
              {places > 1 ? `These photos are from ${places} places` : places === 1 ? "These photos are from one place" : "These photos can't be stamped"}
            </p>
            <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 2 }}>
              {places > 1 ? "We stamp one place at a time. Untick any you'd rather skip." : places === 1 ? "Untick it if you'd rather not." : `Stamps go back to ${short(STAMP_EARLIEST)}.`}
            </p>
            <div className="mt-3 overflow-y-auto rounded-xl" style={{ border: `1px solid ${RULE}`, background: "#fff", flex: 1 }}>
              {rows.map((r, i) => {
                const t = rowText(r);
                const on = picked.has(r.key);
                const off = r.kind === "old";
                return (
                  <button key={r.key} type="button" disabled={off || !!busy} onClick={() => toggle(r.key)} role="checkbox" aria-checked={on}
                    className="w-full text-left flex items-center gap-3 px-3" style={{ minHeight: 66, borderTop: i ? "1px solid rgba(22,17,13,.07)" : "none", opacity: off ? 0.55 : 1 }}>
                    <Thumbs srcs={srcs(r.items.map((p) => p.file))} />
                    <span className="min-w-0 flex-1 py-2">
                      <span className="flex items-center gap-1.5" style={{ fontSize: fs(14), fontWeight: 650, color: INK }}>
                        {r.kind === "add" ? <ImageIcon size={13} color={INK3} /> : r.kind === "new" ? <MapPin size={13} color={STAMP} /> : null}
                        <span className="truncate">{t.title}</span>
                      </span>
                      <span className="block" style={{ fontSize: fs(11.5), color: INK3, lineHeight: 1.35, marginTop: 1 }}>{t.sub}</span>
                    </span>
                    {!off && (
                      <span aria-hidden="true" className="flex-none rounded-md flex items-center justify-center" style={{ width: 22, height: 22, background: on ? STAMP : "#fff", border: on ? "none" : `1.5px solid ${RULE}` }}>
                        {on && <Check size={14} color="#fff" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div role="group" aria-label="A look for these photos" className="flex gap-2 overflow-x-auto mt-2" style={{ scrollbarWidth: "none" }}>
              {LOOKS.map((l) => (
                <button key={l.key} type="button" onClick={() => setLook(l.key)} aria-pressed={look === l.key} disabled={!!busy}
                  className="flex-none rounded-full px-3" style={{ minHeight: 36, border: `1px solid ${look === l.key ? STAMP : RULE}`, background: look === l.key ? STAMP : "#fff", color: look === l.key ? "#fff" : INK2, fontSize: fs(12.5), fontWeight: 600, whiteSpace: "nowrap" }}>
                  {l.name}
                </button>
              ))}
            </div>
            {busy && <p className="mt-2 flex items-center gap-2" style={{ fontSize: fs(12.5), color: INK2 }}><Loader2 size={14} className="animate-spin" /> {busy}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={onClose} disabled={!!busy} className="flex-1 rounded-xl py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
              <button onClick={go} disabled={!!busy || !chosen.length} className="flex-1 rounded-xl py-2.5 font-semibold disabled:opacity-50" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>{goLabel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// A postcard carries one photo: tap the one to send.
function PostcardPick({ files, srcs, onPick, onBack }) {
  return (
    <>
      <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK }}>Pick the photo for your postcard</p>
      <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 2 }}>A postcard carries one photo.</p>
      <div className="grid grid-cols-3 gap-2 mt-3 overflow-y-auto" style={{ flex: 1 }}>
        {srcs.map((u, i) => (
          <button key={u} type="button" onClick={() => onPick(files[i])} aria-label={`Photo ${i + 1}`} className="rounded-xl overflow-hidden" style={{ aspectRatio: "1 / 1", border: `1px solid ${RULE}` }}>
            <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
      <button onClick={onBack} className="w-full rounded-xl py-2.5 font-semibold mt-3" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Back</button>
    </>
  );
}
