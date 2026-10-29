// PhotoPackets — the envelopes of prints, one per destination (founder,
// 2026-09-29: "for your people: the photo packet"). A horizontal shelf of
// kraft envelopes — the first photo peeks out of the flap, the label reads
// ATLANTA · 34 PRINTS · SEP 25–28 — and tapping one opens the shared
// PhotoLightbox to flip through. Derived entirely from the stamps the parent
// already holds (src/lib/packets.js), so the friend view is automatically
// moderation-safe and the owner view is instant.
import React, { useMemo, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { derivePackets, packetsByYear } from "@/lib/packets";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import { uploadStampPhoto } from "@/lib/passport";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { showToast } from "@/components/Toast";
import PhotoFooter from "@/components/passport/PhotoFooter";
import AudienceSheet from "@/components/privacy/AudienceSheet";
import { setAlbumPrivacy } from "@/lib/passport";
import { ALBUM_OPTS, AUD, audWord, capTo, usePassportAudience, RANK } from "@/lib/audience";
import PrivacyChip from "@/components/privacy/PrivacyChip";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK3 = "#736657";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// The stamp's mark, as the passport wears it (founder, 2026-10-16: label albums "not so subtle
// that it destroys the creativity"): one small glyph per audience the envelope holds.
const MARK = { me: "🔒", inner: "🤝", followers: "👥", public: "🌍" };
const marksOf = (tiers) => (tiers || []).map((t) => MARK[t]).filter(Boolean).join(" ");

// stampLevel (the owner's view, founder 2026-10-28): the stamp's privacy inside the envelope as a
// coloured chip — "STAMP 🔒 Only me", "2 STAMPS 🌍 Everyone". The owner's envelopes each hold one
// privacy (derivePackets byLevel); the album's own setting is the line under the envelope.
function Envelope({ packet, onOpen, stampLevel = null }) {
  const peek = packet.photos[0]?.src;
  const marks = marksOf(packet.tiers);
  const nStamps = packet.stampList?.length || 1;
  const stampWord = nStamps === 1 ? "STAMP" : `${nStamps} STAMPS`;
  return (
    <button type="button" onClick={onOpen}
      aria-label={`Open the ${packet.city} photo packet — ${packet.photos.length} prints${stampLevel ? `. ${nStamps === 1 ? "Stamp" : `${nStamps} stamps`}: ${AUD[stampLevel]?.label || stampLevel}` : ""}`}
      className="block w-full active:scale-95 transition-transform">
      <div style={{ position: "relative", height: 118 }}>
        {/* prints peeking out -->*/}
        {/* lazy <img> peeks, not CSS backgrounds: a lifetime of envelopes loads as it scrolls */}
        {peek && (
          <div aria-hidden style={{ position: "absolute", left: 12, right: 12, top: 0, height: 72, borderRadius: 6, overflow: "hidden", background: "#8FB2C8", transform: "rotate(-3deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
            <img src={peek} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}
        {packet.photos[1] && (
          <div aria-hidden style={{ position: "absolute", left: 22, right: 6, top: 6, height: 64, borderRadius: 6, overflow: "hidden", background: "#D9C9A8", transform: "rotate(4deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.15)", zIndex: 0 }}>
            <img src={packet.photos[1].src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}
        {/* the envelope */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderRadius: 10, background: "linear-gradient(180deg,#EBDDB6,#E2D1A4)", border: "1.5px solid #C9B583", boxShadow: "0 4px 10px -6px rgba(0,0,0,.3)", zIndex: 2 }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 24, background: "rgba(201,181,131,.55)", clipPath: "polygon(0 0, 100% 0, 50% 100%)", borderRadius: "10px 10px 0 0" }} />
          {stampLevel
            // Wraps under the word on a narrow phone rather than clipping "Friends & followers".
            ? <span aria-hidden="true" style={{ position: "absolute", right: 6, top: 4, maxWidth: "calc(100% - 12px)", display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "1px 3px" }}>
                <span style={{ flex: "none", fontFamily: MONO, fontSize: fs(7), letterSpacing: ".12em", color: "#8A6E33" }}>{stampWord}</span>
                <PrivacyChip level={stampLevel} size="xs" />
              </span>
            : marks ? <span aria-hidden="true" style={{ position: "absolute", right: 7, top: 5, fontSize: fs(10.5), lineHeight: 1, opacity: 0.8 }}>{marks}</span> : null}
          <div className="absolute inset-x-0 bottom-2 text-center px-2">
            <div className="truncate" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs(14), color: "#6B4F1E", letterSpacing: ".04em" }}>{packet.city.toUpperCase()}</div>
            <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(8), color: "#8A6E33", letterSpacing: ".12em" }}>
              {packet.photos.length} PRINT{packet.photos.length === 1 ? "" : "S"}{packet.range ? ` · ${packet.range.toUpperCase()}` : ""}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// albums: the owner's "Who sees my photo albums" dial ('passport' | 'inner' | 'me'); a 🌍 print
// hangs on the city board only while the dial is open to passport viewers.
// corner (2026-10-27): an album pinned at the top right of the shelf. boards (2026-10-28, founder:
// "line them up side by side … clarify what that album is for"): the profile's two City Board
// albums — photos uploaded, postcards posted — in their own row under the header, with the words
// that say what each is. With either the shelf shows even before any stamp has photos.
export default function PhotoPackets({ stamps, title = "Photo packets", owner = false, albums = "passport", onChanged = null, social = null, className = "max-w-md mx-auto px-4 mt-8", corner = null, boards = null }) {
  // social: { slug, blotter, onBlotterChanged } — the per-photo guestbook inside an open album.
  // className: the column (the profile passes its own, which widens on iPad).
  const packets = useMemo(() => derivePackets(stamps, { byLevel: owner }), [stamps, owner]);
  const [open, setOpen] = useState(null); // { photos, index, city }
  // Who sees each album, one tap from its envelope (founder, 2026-10-26: "albums should have a
  // quick way to change privacy per album"). An album can only narrow its photos.
  const [albumFor, setAlbumFor] = useState(null);   // the packet whose privacy sheet is open
  // The four words everywhere (2026-10-27): an album shows what its photos really reach, never
  // more than its stamps or the passport.
  const [passportAud] = usePassportAudience(owner);
  const levelsOf = (p) => [...new Set((p.albumTiers || []).map((t) => capTo(t, passportAud)))];
  // Levels read narrowest first; screen readers get the words (spoken).
  const sortL = (levels) => [...levels].sort((a, b) => (RANK[a] ?? 1) - (RANK[b] ?? 1));
  const spoken = (levels) => sortL(levels).map((k) => AUD[k]?.label || k).join(" and ");
  const stampLevels = (p) => new Set((p.stampTiers || []).map((t) => capTo(t, passportAud)));
  // The owner's envelopes hold one privacy each (byLevel): the stamp's, and the album's.
  const stampLevelOf = (p) => capTo(p.stampTiers?.[0] || "inner", passportAud);
  const albumLevelOf = (p) => capTo(p.albumTiers?.[0] || "inner", passportAud);
  const saveAlbum = async (v) => {
    const r = await setAlbumPrivacy(albumFor.stampIds, v);
    if (r.error) { showToast(r.error, "error"); return false; }
    showToast(`${albumFor.city}: ${AUD[v]?.label || v}`, "success");
    onChanged?.();
    return true;
  };
  // Add prints straight from a packet (founder, 2026-10-05): they land on the
  // destination's newest stamp and go through the same photo review.
  const fileRef = useRef(null);
  const [addTo, setAddTo] = useState(null);   // the packet receiving prints
  const [busyKey, setBusyKey] = useState(null);
  const pickFor = (packet) => { setAddTo(packet); fileRef.current?.click(); };
  const onPick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 10);
    e.target.value = "";
    const packet = addTo;
    setAddTo(null);
    if (!files.length || !packet?.stampId) return;
    setBusyKey(packet.key);
    let added = 0;
    for (const f of files) {
      try {
        const exif = await readPhotoExif(f);   // before resizing strips it
        const image = await resizePhoto(f);
        const { error } = await uploadStampPhoto({ stamp_id: packet.stampId, image, exif });
        if (error) showToast(error, "error"); else added += 1;
      } catch (err) { showToast(err?.message || "Upload failed", "error"); }
    }
    setBusyKey(null);
    if (added) { showToast(`${added} print${added === 1 ? "" : "s"} added to ${packet.city} 📸`, "success"); onChanged?.(); }
  };
  if (!packets.length && !corner && !boards) return null;
  // The shelf used to scroll sideways; a lifetime of prints reads top to bottom, a year at
  // a time (founder, 2026-10-14 night). Newest year first, two envelopes across on a phone:
  // the envelopes size to the column (they were a fixed 176 px, and inside the Passport's own
  // padding only one fit a row — founder, 2026-10-17: "a waste of space").
  const years = packetsByYear(packets);
  return (
    <div className={className}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>{title}</div>
          <div style={{ fontFamily: SERIF, fontSize: fs(22), color: "#16110D", lineHeight: 1.1 }}>Prints from every place</div>
          {owner && packets.length ? (
            <p style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".06em", lineHeight: 1.5, color: INK3 }}>
              {/* Short (founder, 2026-10-17), but 🌍 prints showing on the city board is never left out. */}
              Each envelope holds one privacy: its stamp’s inside, its album’s under it. 🌍 Everyone albums also hang on the city board.
            </p>
          ) : null}
        </div>
        {/* The first album, at the top right (founder, 2026-10-27). */}
        {corner ? <div style={{ flex: "none", width: "44%", maxWidth: 190 }}>{corner}</div> : null}
      </div>
      {/* On City Boards: the two public albums, side by side, and what each is for. */}
      {boards ? (
        <section aria-label="On City Boards" style={{ marginTop: 16 }}>
          <div className="flex items-baseline gap-2.5">
            <span style={{ fontFamily: SERIF, fontSize: fs(18), color: "#16110D" }}>City Boards</span>
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".14em", color: INK3 }}>PUBLIC · TWO ALBUMS</span>
            <span aria-hidden="true" className="flex-1" style={{ borderTop: "1px dashed rgba(22,17,13,.18)", transform: "translateY(-3px)" }} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: fs(12), lineHeight: 1.45, color: INK3 }}>
            What you’ve put on City Boards: the photos you uploaded, and the postcards you posted there. Both are public; delete any of it any time. Postcards to friends stay in your Mailbox.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, paddingTop: 12 }}>{boards}</div>
        </section>
      ) : null}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
      {years.map(({ year, prints, places, packets: list }) => (
        <section key={year} aria-label={`${year} — ${prints} prints`}>
          <div className="flex items-baseline gap-2.5" style={{ marginTop: 16 }}>
            <span style={{ fontFamily: SERIF, fontSize: fs(18), color: "#16110D" }}>{year}</span>
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".14em", color: INK3 }}>
              {places} PLACE{places === 1 ? "" : "S"} · {prints} PRINT{prints === 1 ? "" : "S"}
            </span>
            <span aria-hidden="true" className="flex-1" style={{ borderTop: "1px dashed rgba(22,17,13,.18)", transform: "translateY(-3px)" }} />
          </div>
          <div className="grid justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px 12px", paddingTop: 12 }}>
            {list.map((p) => (
              <div key={p.key} style={{ position: "relative", width: "100%", maxWidth: 190 }}>
                <Envelope packet={p} stampLevel={owner ? stampLevelOf(p) : null} onOpen={() => setOpen({ photos: p.photos, index: 0, city: p.city, range: p.range, packet: p })} />
                {owner && p.stampIds?.length ? (
                  <button type="button" onClick={() => setAlbumFor(p)} aria-label={`Who sees the ${p.city} album: ${spoken(levelsOf(p))}. Its stamps: ${spoken(stampLevels(p))}. Change`}
                    // Wraps rather than clips: a long word ("Friends & followers") puts Change on a second line.
                    className="w-full flex flex-wrap items-center justify-center" style={{ minHeight: 34, marginTop: 4, columnGap: 4, rowGap: 2, background: "transparent", border: 0, fontSize: fs(11.5), color: "#5A4A33" }}>
                    <span aria-hidden="true" style={{ flex: "none" }}>Album</span>
                    <PrivacyChip level={albumLevelOf(p)} size="xs" style={{ flex: "none" }} />
                    <span aria-hidden="true" style={{ flex: "none", color: "#2B4A7E", fontWeight: 650 }}>Change</span>
                  </button>
                ) : null}
                {owner && p.stampId && (
                  // A 44px target around the 28px badge on the envelope's corner.
                  <button type="button" onClick={() => pickFor(p)} disabled={!!busyKey} aria-label={`Add prints to ${p.city}`}
                    style={{ position: "absolute", top: -12, right: -12, zIndex: 3, width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", border: 0, padding: 0 }}>
                    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: "#fff", border: "1.5px solid #C9B583", display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
                      {busyKey === p.key ? <Loader2 size={14} className="animate-spin" color="#8A6E33" /> : <Plus size={15} color="#8A6E33" strokeWidth={2.6} />}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {packets.length ? (
        <p style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".03em", marginTop: 10 }}>
          {owner ? "Tap + to add prints." : "Every destination gathers their memory photos, a year at a time."}
        </p>
      ) : null}
      {albumFor && (
        <AudienceSheet title="Who sees this album" kicker={`${albumFor.city}${albumFor.year && albumFor.year !== "Undated" ? ` · ${albumFor.year}` : ""} · ${albumFor.photos.length} print${albumFor.photos.length === 1 ? "" : "s"}`}
          value={levelsOf(albumFor).length === 1 ? levelsOf(albumFor)[0] : null} options={ALBUM_OPTS}
          ceiling={capTo(albumFor.widest || "inner", passportAud)}
          // The limit comes from the stamps when they are narrower than the passport.
          ceilingNote={passportAud && (RANK[albumFor.widest] ?? 1) < (RANK[passportAud] ?? 3)
            ? `${albumFor.stampIds.length === 1 ? "Its stamp is" : "Its stamps are"} ${audWord(albumFor.widest)} at most, so these photos can’t reach more than that.`
            : undefined}
          onPick={saveAlbum} onClose={() => setAlbumFor(null)}
          // Which stamp is which (founder, 2026-10-28): every stamp in the album by name, its own
          // setting, and what its photos reach when the album keeps them narrower.
          extra={(
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.10)" }}>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".14em", textTransform: "uppercase", color: INK3 }}>{(albumFor.stampList || []).length === 1 ? "Stamp in this album" : "Stamps in this album"}</div>
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                {(albumFor.stampList || []).map((st, i) => {
                  const own = capTo(st.own, passportAud), ph = capTo(st.photos, passportAud);
                  return (
                    <li key={st.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? "1px solid rgba(22,17,13,.08)" : 0 }}>
                      <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: fs(13.5), color: "#16110D" }}>{st.name}</span>
                      <PrivacyChip level={own} size="xs" />
                      {ph !== own ? <><span style={{ fontSize: fs(11), color: INK3 }}>photos</span><PrivacyChip level={ph} size="xs" /></> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          note="An album can make its photos more private than their stamps, never more public than their stamps or your passport." />
      )}
      {open && (
        <PhotoLightbox
          photos={open.photos}
          index={open.index}
          onClose={() => setOpen(null)}
          onIndexChange={(i) => setOpen((o) => (o ? { ...o, index: i } : o))}
          title={open.city}
          credit={open.range || undefined}
          renderFooter={(ph) => (
            <div>
              {/* Whose eyes this photo reaches, with its stamp's name (founder, 2026-10-28). */}
              {owner && ph?.tier ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, margin: "0 auto 8px", fontSize: fs(12.5), color: "rgba(255,252,247,.9)" }}>
                  {ph.place ? <span className="truncate" style={{ maxWidth: 220 }}>{ph.place}</span> : null}
                  <span>· Who sees it</span>
                  <PrivacyChip level={capTo(ph.tier, passportAud)} size="xs" />
                </div>
              ) : null}
              {/* Inside the album too (founder, 2026-10-05): add prints without
                  leaving it, and every photo keeps its own guestbook. */}
              {owner && open.packet?.stampId && (
                <button type="button" onClick={() => pickFor(open.packet)} disabled={!!busyKey}
                  style={{ display: "block", margin: "0 auto 8px", borderRadius: 999, padding: "7px 16px", fontWeight: 600, fontSize: "calc(12.5px*var(--fs))", background: "rgba(255,255,255,.92)", border: "none", color: "#16110D" }}>
                  {busyKey ? "Adding…" : `＋ Add prints to ${open.city}`}
                </button>
              )}
              {(social?.slug || owner) && ph?.id && (
                <PhotoFooter photo={ph} slug={social?.slug || null} blotter={social?.blotter || null} ownerView={owner} onChanged={social?.onBlotterChanged}
                  albumsOpen={albums !== "inner" && albums !== "me"}
                  onBoard={(id, hidden) => setOpen((o) => (o ? { ...o, photos: o.photos.map((x) => (x.id === id ? { ...x, board_hidden: hidden } : x)) } : o))}
                  onCaption={(id, caption) => setOpen((o) => (o ? { ...o, photos: o.photos.map((x) => (x.id === id ? { ...x, caption } : x)) } : o))} />
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
