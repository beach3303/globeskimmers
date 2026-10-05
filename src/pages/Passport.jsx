import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Loader2, Plus, Trash2, Calendar, RefreshCw, X, UserPlus } from "lucide-react";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { addStamp, metersBetween, proofToast, listPassport, uploadStampPhoto, setStampDate, deleteStamp, deleteStampPhoto, createTagInvite, getTagByToken, claimTag, blockTagger, reportShared, listTags, respondTag, getShareLink, getPublicPassport, getAgeInfo, setAgeGate, setBirthday, listCitySets, blotterRead } from "@/lib/passport";
import { placeSearch } from "@/lib/placeSearch";
import { stampArtUrl } from "@/lib/stampArt";
import { respectPlaceFor, needsRespectNote, isPlainArt } from "@/lib/respectPlaces";
import RespectPlaceSheet from "@/components/passport/RespectPlaceSheet";
import { setStampArt } from "@/lib/passport";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import TypographicStamp from "@/components/passport/TypographicStamp";
import AirportStamp from "@/components/passport/AirportStamp";
import LandStamp from "@/components/passport/LandStamp";
import PassportBook, { packBookPages, readFontScale, fitsTogether } from "@/components/passport/PassportBook";
import BlotterStrip from "@/components/passport/Blotter";
import { isAdminEmail } from "@/lib/admins";
import { countryCode } from "@/lib/countries";
import { localISODate } from "@/lib/localDate";
import { stampRadiusFor } from "@/lib/stampRadius";
import { resizePhoto } from "@/lib/resizePhoto";
import { readPhotoExif } from "@/lib/photoExif";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import NearbyStampPrompt, { NEARBY_KEY, nearbySensingOn } from "@/components/passport/NearbyStampPrompt";
import StampActions from "@/components/passport/StampActions";
import Luggage from "@/components/passport/Luggage";
import PhotoPackets from "@/components/passport/PhotoPackets";
import HeldHandleClaim from "@/components/passport/HeldHandleClaim";
import PhotoFooter from "@/components/passport/PhotoFooter";


// ============================================================================
// Passport — the personal, private travel journal. Stamps you EARN by being
// somewhere (or by proving it with a photo), kept for life, with your own
// photos. Memory-journal first: photos + captions lead; stats/map are quiet.
// See docs/PASSPORT_MEANING_MODEL.md. Data via src/lib/passport.js → Worker.
// ============================================================================
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const SANS = '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const STAMP = "#B0472F"; // warm passport-ink red (the stamp color)
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const KIND = {
  country: { icon: "🌍", label: "Country" },
  city: { icon: "🏙️", label: "City" },
  airport: { icon: "✈️", label: "Airport" },
  icon: { icon: "🗽", label: "National Icon" },
  wonder: { icon: "🏔️", label: "Natural Wonder" },
  attraction: { icon: "📍", label: "Attraction" },
};

const fmtDate = (iso) => {
  if (!iso) return null;
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
};

function VerifiedBadge({ verified }) {
  // Three proofs earn the ✓ (founder, 2026-09-28): the phone at the place,
  // a photo whose own location tag puts you there, or the place recognised in
  // your photo. A photo with no proof is a memory; self-added shows no badge.
  if (verified === "gps") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified visit</Chip>;
  if (verified === "photo_loc") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified · photo location</Chip>;
  if (verified === "photo_ai") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified · photo</Chip>;
  if (verified === "photo") return <Chip bg={IVORY_2} color={INK3}>📸 With photo</Chip>;
  return null;
}
function Chip({ children, bg, color }) {
  return <span style={{ background: bg, color, fontSize: fs(10.5), fontFamily: SANS, fontWeight: 600 }} className="px-2 py-0.5 rounded-full leading-tight inline-block">{children}</span>;
}

function Stat({ n, label }) {
  return (
    <div className="text-center">
      <div style={{ fontFamily: SERIF, fontSize: fs(26), color: STAMP, lineHeight: 1 }}>{n}</div>
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".08em", color: INK3, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Trip note — private unless the owner shared it; visitors only ever receive shared ones.
function TripNote({ stamp, readOnly }) {
  if (!stamp.note) return null;
  return (
    <div className="w-full mt-2.5 rounded-xl px-3 py-2" style={{ background: IVORY_2, border: `1px solid ${RULE}` }}>
      {!readOnly && (
        <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".06em", color: INK3, textTransform: "uppercase" }}>
          {stamp.kind === "airport" || stamp.entity_type === "border" ? "✈️ Trip note" : "📝 Memory"} · {stamp.note_public ? "🌍 Shared" : "🔒 Private"}
        </div>
      )}
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: INK, lineHeight: 1.3, marginTop: readOnly ? 0 : 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {stamp.note}
      </div>
    </div>
  );
}

function StampCard({ stamp, onChanged, onEnlarge, fromName, homeCity, readOnly }) {
  const isHome = stamp.kind === "city" && homeCity && String(stamp.city || "").toLowerCase() === String(homeCity).toLowerCase();
  const k = KIND[stamp.kind] || KIND.attraction;
  // Bespoke landmark stamp art (falls back to the category emoji if none exists).
  // Country stamps use the flag, not bespoke art.
  const artUrl = stamp.kind === "country" || isPlainArt(stamp) ? null : stampArtUrl(stamp.name, { entityId: stamp.entity_id, country: stamp.country });
  const [artFailed, setArtFailed] = useState(false);
  const showArt = !!artUrl && !artFailed;
  // Country stamps keep the flag; every other kind falls back to a typographic
  // stamp instead of the category emoji, so no stamp ever looks unfinished.
  const showTypo = stamp.kind !== "country" && !showArt;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dateVal, setDateVal] = useState(stamp.visited_on || "");
  const [tagBusy, setTagBusy] = useState(false);
  // Create a share-link invite → hand it to the native share sheet so the user
  // sends it via WhatsApp / iMessage / whatever they use. No app-sent email.
  const shareInvite = async () => {
    setTagBusy(true);
    const { data, error } = await createTagInvite({ stamp_id: stamp.id, from_name: fromName });
    setTagBusy(false);
    if (error || !data?.url) { showToast(error || "Couldn't create invite", "error"); return; }
    const text = `I tagged you at ${stamp.name} on Globeskimmers 🛂 — add it to your Virtual Passport:`;
    try {
      if (navigator.share) await navigator.share({ title: "Globeskimmers", text, url: data.url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${data.url}`); showToast("Invite link copied — paste it to your friend", "success"); }
      else showToast("Invite ready", "success");
    } catch { /* user dismissed the share sheet — no-op */ }
  };
  const place = [stamp.city, stamp.region, stamp.country].filter(Boolean).join(", ");
  const photos = stamp.photos || [];

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const exif = await readPhotoExif(file);   // before resizing strips it
      const image = await resizePhoto(file);
      const { data, error } = await uploadStampPhoto({ stamp_id: stamp.id, image, visited_on: stamp.visited_on || undefined, exif });
      if (error) showToast(error, "error"); else { showToast(proofToast(data?.proof) || "Photo added 📸", "success"); onChanged(); }
    } catch (err) { showToast(err?.message || "Upload failed", "error"); }
    finally { setBusy(false); }
  };
  const saveDate = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) { setShowDate(false); return; }
    setBusy(true);
    const { error } = await setStampDate(stamp.id, dateVal);
    setBusy(false); setShowDate(false);
    if (error) showToast(error, "error"); else { showToast("Date updated", "success"); onChanged(); }
  };
  const removeStamp = async () => {
    setBusy(true);
    const { error } = await deleteStamp(stamp.id);
    setBusy(false); setConfirmDel(false);
    if (error) showToast(error, "error"); else { showToast("Stamp removed", "success"); onChanged(); }
  };
  const removePhoto = async (photoId) => {
    const { error } = await deleteStampPhoto(photoId);
    if (error) showToast(error, "error"); else { showToast("Photo removed", "success"); onChanged(); }
  };

  // Border crossings render the land stamp (state welcome sign / checkpoint).
  if (stamp.kind === "state" || (stamp.kind === "country" && stamp.entity_type === "border" && stamp.meta?.direction)) {
    return (
      <div className="bg-white rounded-[20px] p-3 flex flex-col items-center" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
        {stamp.kind === "state"
          ? <LandStamp template="state" name={stamp.region || stamp.name} date={stamp.visited_on} direction={stamp.meta?.direction || null} mode={stamp.meta?.mode || null} width={264} />
          : <LandStamp template="country" name={String(stamp.name || "").split(" · ")[0]} countryCode={String(stamp.entity_id || "").split(":")[0]} date={stamp.visited_on} direction={stamp.meta?.direction || null} mode={stamp.meta?.mode || null} width={264} />}
        <div className="flex items-center gap-2 mt-1.5">
          <VerifiedBadge verified={stamp.verified} />
          {!readOnly && (
            <button onClick={() => setConfirmDel(true)} className="rounded-lg px-2.5 py-1" style={{ background: IVORY_2, color: INK2, fontSize: fs(11.5) }} aria-label="Remove this stamp">Remove</button>
          )}
        </div>
        {confirmDel && !readOnly && (
          <span className="inline-flex items-center gap-1.5 mt-1.5">
            <button onClick={removeStamp} disabled={busy} className="rounded-lg px-2.5 py-1 font-semibold" style={{ background: "#B0472F", color: "#fff", fontSize: fs(11.5) }}>Yes, remove</button>
            <button onClick={() => setConfirmDel(false)} className="rounded-lg px-2.5 py-1" style={{ background: IVORY_2, color: INK2, fontSize: fs(11.5) }}>Keep</button>
          </span>
        )}
      </div>
    );
  }

  // Airport arrival stamps render the authentic in-app stamp; memory photos welcome.
  if (stamp.kind === "airport") {
    return (
      <div className="bg-white rounded-[20px] p-3 flex flex-col items-center" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
        <AirportStamp iata={String(stamp.entity_id || "").split(":")[0]} city={stamp.city} country={stamp.country} countryCode={stamp.country} date={stamp.visited_on} width={264}  direction={stamp.meta?.direction || null} />
        <div className="flex items-center gap-2 mt-1.5">
          <VerifiedBadge verified={stamp.verified} />
          {!readOnly && (confirmDel ? (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={removeStamp} disabled={busy} className="rounded-lg px-2.5 py-1 font-semibold" style={{ background: "#B0472F", color: "#fff", fontSize: fs(11.5) }}>Remove</button>
              <button onClick={() => setConfirmDel(false)} className="rounded-lg px-2.5 py-1" style={{ background: IVORY_2, color: INK2, fontSize: fs(11.5) }}>Keep</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="rounded-lg px-2 py-1" style={{ background: IVORY_2, color: INK3, fontSize: fs(11.5) }} title="Remove">🗑</button>
          ))}
        </div>

        <TripNote stamp={stamp} readOnly={readOnly} />

        {/* Memory photos — thumbnails you can enlarge (same as iconic stamps) */}
        {photos.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {photos.map((p) => (
              <div key={p.id} className="relative shrink-0">
                <img src={p.photo_url} alt="" loading="lazy" onClick={() => onEnlarge(p.photo_url, stamp)}
                  className="cursor-pointer active:scale-95 transition-transform"
                  style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}` }} />
                {!readOnly && (
                  <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.72)", border: "1.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}>
                    <X size={13} color="#fff" strokeWidth={2.75} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!readOnly && (<>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
            style={{ background: IVORY_2, color: INK2, border: `1px dashed ${RULE}`, fontSize: fs(13), fontWeight: 600 }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2.4} />}
            {photos.length ? "Add another photo" : "Add a memory photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </>)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      {showTypo && (
        <div className="flex justify-center mb-3">
          <TypographicStamp
            name={stamp.name} city={stamp.city} region={stamp.region}
            country={stamp.country} date={stamp.visited_on}
            entityId={stamp.entity_id || stamp.id} width={138} overprint strength={STAMP_INK_STRENGTH} film={stamp.meta?.film || null}
          />
        </div>
      )}
      {showArt && (
        <div className="flex justify-center mb-3">
          <img src={artUrl} alt={stamp.name} onError={() => setArtFailed(true)} onClick={() => onEnlarge(artUrl, stamp)}
            className="cursor-pointer active:scale-95 transition-transform"
            style={{ width: 138, height: 138, objectFit: "contain" }} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {!showArt && !showTypo && <div className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 42, height: 42, background: IVORY_2, fontSize: 22 }}>{k.icon}</div>}
          <div className="min-w-0">
            <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(19), color: INK, lineHeight: 1.15 }}>{stamp.name}</p>
            {place && <p className="truncate" style={{ color: INK3, fontSize: fs(12), fontFamily: MONO }}>{place}</p>}
          </div>
        </div>
        {!readOnly && (
          <button onClick={() => setConfirmDel(true)} disabled={busy} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5" title="Delete stamp" aria-label="Delete stamp">
            <Trash2 size={15} color="#C2392F" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Movie scene stamp: the film behind the place */}
      {stamp.meta?.film?.title && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: IVORY_2 }}>
          <p style={{ fontFamily: SERIF, fontSize: fs(16), color: INK, lineHeight: 1.2 }}>The scene from <i>{stamp.meta.film.title}</i>{stamp.meta.film.year ? ` (${stamp.meta.film.year})` : ""}</p>
          {stamp.meta.film.scene && <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 3 }}>{stamp.meta.film.scene}</p>}
          {Array.isArray(stamp.meta.film.cast) && stamp.meta.film.cast.length > 0 && (
            <p style={{ fontFamily: MONO, color: INK3, fontSize: fs(11), lineHeight: 1.45, marginTop: 4 }}>
              {stamp.meta.film.cast.map((c) => (c.role ? `${c.actor} as ${c.role}` : c.actor)).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* In-app delete confirm (no native dialog — reliable in the iOS WebView) */}
      {confirmDel && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "#FBE0DC", border: "1px solid #F1B8B0" }}>
          <p style={{ color: "#A82C24", fontSize: fs(13), fontWeight: 600, lineHeight: 1.4 }}>Delete this stamp? Its photos are removed too.</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setConfirmDel(false)} disabled={busy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>Cancel</button>
            <button onClick={removeStamp} disabled={busy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: "#C2392F", color: "#fff", fontSize: fs(13) }}>{busy ? "Removing…" : "Delete"}</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        {isHome && <Chip bg="#F3E2C7" color={STAMP}>🏠 Home</Chip>}
        <VerifiedBadge verified={stamp.verified} />
        {readOnly ? (
          stamp.visited_on && <span className="inline-flex items-center gap-1" style={{ color: INK3, fontSize: fs(12) }}><Calendar size={12} color={INK3} /> {fmtDate(stamp.visited_on)}</span>
        ) : (
          <button onClick={() => setShowDate((s) => !s)} className="inline-flex items-center gap-1" style={{ color: INK2, fontSize: fs(12) }}>
            <Calendar size={12} color={INK3} /> {stamp.visited_on ? fmtDate(stamp.visited_on) : "Add date"}
          </button>
        )}
      </div>

      {!readOnly && showDate && (
        <div className="flex items-center gap-2 mt-2">
          <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} max={localISODate()}
            className="rounded-lg px-2 py-1" style={{ border: `1px solid ${RULE}`, fontSize: fs(13), color: INK }} />
          <button onClick={saveDate} disabled={busy} className="rounded-lg px-3 py-1 font-semibold" style={{ background: TEAL_DEEP, color: "#fff", fontSize: fs(12.5) }}>Save</button>
        </div>
      )}

      <TripNote stamp={stamp} readOnly={readOnly} />

      {/* Memory photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {photos.map((p) => (
            <div key={p.id} className="relative shrink-0">
              <img src={p.photo_url} alt="" loading="lazy" onClick={() => onEnlarge(p.photo_url, stamp)}
                className="cursor-pointer active:scale-95 transition-transform"
                style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 12, border: `1px solid ${RULE}` }} />
              {!readOnly && (
                <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.72)", border: "1.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}>
                  <X size={13} color="#fff" strokeWidth={2.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add photo + tag — owner-only (hidden in a friend's read-only view) */}
      {!readOnly && (<>
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ background: IVORY_2, color: INK2, border: `1px dashed ${RULE}`, fontSize: fs(13), fontWeight: 600 }}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2.4} />}
        {photos.length ? "Add another photo" : "Add a memory photo"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

      {/* Tag who you were with — share a link (their app of choice); they
          Allow/Decline the stamp on their own Virtual Passport */}
      <button onClick={shareInvite} disabled={tagBusy} className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13), fontWeight: 600 }}>
        <UserPlus size={15} strokeWidth={2.2} /> {tagBusy ? "Preparing…" : "Tag who you were with"}
      </button>
      </>)}
    </div>
  );
}

// "Tagged you" inbox card — someone tagged you at a place; Allow → the stamp is
// minted on your passport, Decline → nothing.
function TagInbox({ tag, onDone, onProve }) {
  const [busy, setBusy] = useState(false);
  const k = KIND[tag.kind] || KIND.attraction;
  const place = [tag.city, tag.country].filter(Boolean).join(", ");
  const who = tag.from_name || "A traveler";
  const respond = async (action) => {
    setBusy(true);
    const { data, error } = await respondTag(tag.id, action);
    setBusy(false);
    if (error) { showToast(error, "error"); return; }
    if (action === "accept" && data?.needs_proof) {
      showToast("Noted — you were there together. Add a photo from that day to earn the stamp", "success");
      onProve?.(data.place || null);
    } else showToast(action === "accept" ? "You already have this stamp 🛂" : "Declined", "success");
    onDone();
  };
  return (
    <div className="rounded-[18px] p-3.5" style={{ boxShadow: SHADOW_CARD_SOFT, border: "1px solid #EAD9AE", background: "#FFFBF0" }}>
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 40, height: 40, background: IVORY_2, fontSize: 20 }}>{k.icon}</div>
        <div className="min-w-0 flex-1">
          <p style={{ color: INK, fontSize: fs(13.5), lineHeight: 1.4 }}><b>{who}</b> tagged you at <b>{tag.name}</b>{place ? ` · ${place}` : ""}</p>
          <p style={{ color: INK3, fontSize: fs(11.5), marginTop: 1 }}>Add this stamp to your Virtual Passport?</p>
        </div>
      </div>
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => respond("decline")} disabled={busy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>Decline</button>
        <button onClick={() => respond("accept")} disabled={busy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13) }}>{busy ? "…" : "Allow ✓"}</button>
      </div>
    </div>
  );
}

// Sample stamps for the in-app "See a sample passport" preview (never saved to
// the server; view-only). Shows a range: airport arrivals + iconic stamps, GPS ✓
// vs self-declared, with/without memory photos, across three country pages.
const SAMPLE_STAMPS = [
  { id: "sample-fr-cdg", kind: "airport", tier: "page", entity_type: "airport", entity_id: "CDG", name: "Paris (CDG)", city: "Paris", country: "FR", visited_on: "2026-06-14", verified: "gps", photos: [] },
  { id: "sample-fr-eiffel", kind: "attraction", tier: "mark", name: "Eiffel Tower", city: "Paris", region: "Île-de-France", country: "France", visited_on: "2026-06-14", verified: "gps", photos: [{ id: "sp-fr1", photo_url: "https://picsum.photos/seed/gs-paris-1/220/220" }, { id: "sp-fr2", photo_url: "https://picsum.photos/seed/gs-paris-2/220/220" }, { id: "sp-fr3", photo_url: "https://picsum.photos/seed/gs-paris-3/220/220" }, { id: "sp-fr4", photo_url: "https://picsum.photos/seed/gs-paris-4/220/220" }] },
  { id: "sample-fr-arc", kind: "attraction", tier: "mark", name: "Arc de Triomphe", city: "Paris", country: "France", visited_on: "2026-06-15", verified: "self", photos: [] },
  { id: "sample-us-jfk", kind: "airport", tier: "page", entity_type: "airport", entity_id: "JFK", name: "New York (JFK)", city: "New York", country: "US", visited_on: "2026-03-02", verified: "gps", photos: [] },
  { id: "sample-us-liberty", kind: "attraction", tier: "mark", name: "Statue of Liberty", city: "New York", region: "New York", country: "United States", visited_on: "2026-03-02", verified: "gps", photos: [{ id: "sp-us1", photo_url: "https://picsum.photos/seed/gs-ny-1/220/220" }, { id: "sp-us2", photo_url: "https://picsum.photos/seed/gs-ny-2/220/220" }] },
  { id: "sample-us-gc", kind: "attraction", tier: "mark", name: "Grand Canyon West Rim", city: "Peach Springs", region: "Arizona", country: "United States", visited_on: "2026-03-05", verified: "gps", photos: [] },
  { id: "sample-jp-hnd", kind: "airport", tier: "page", entity_type: "airport", entity_id: "HND", name: "Tokyo (HND)", city: "Tokyo", country: "JP", visited_on: "2025-11-20", verified: "gps", photos: [] },
  { id: "sample-jp-fuji", kind: "attraction", tier: "mark", name: "Mount Fuji", city: "Fujinomiya", country: "Japan", visited_on: "2025-11-21", verified: "self", photos: [{ id: "sp-jp1", photo_url: "https://picsum.photos/seed/gs-fuji-1/220/220" }, { id: "sp-jp2", photo_url: "https://picsum.photos/seed/gs-fuji-2/220/220" }, { id: "sp-jp3", photo_url: "https://picsum.photos/seed/gs-fuji-3/220/220" }] },
  { id: "sample-jp-fushimi", kind: "attraction", tier: "mark", name: "Fushimi Inari Shrine", city: "Kyoto", country: "Japan", visited_on: "2025-11-22", verified: "gps", photos: [] },
  // City / place visits (borderless fat-ink stamp)
  { id: "sample-kc", kind: "city", tier: "page", name: "Cracker Barrel", city: "Kansas City", region: "Missouri", country: "United States", visited_on: "2026-05-10", verified: "self", photos: [{ id: "sp-kc1", photo_url: "https://picsum.photos/seed/gs-kc-1/220/220" }] },
  { id: "sample-med", kind: "city", tier: "page", name: "Medellín", city: "Medellín", country: "Colombia", visited_on: "2026-04-02", verified: "self", photos: [] },
];
const SAMPLE_STATS = { countries: 3, verified: 6 };

// "Stamp a place" — a user-initiated (never prompted) stamp for a city or spot
// you visited. Free OSM place search + free-text; date + memory photos. Creates
// a kind:'city' stamp rendered as a borderless fat-ink line.
function StampPlaceModal({ onClose, onDone, preset = null }) {
  const [cityQ, setCityQ] = useState(preset?.city || "");
  const [city, setCity] = useState(preset?.city || "");
  const [country, setCountry] = useState(preset?.country || "");
  const [cc, setCc] = useState("");
  const [coords, setCoords] = useState(Number.isFinite(+preset?.lat) && Number.isFinite(+preset?.lng) ? { lat: +preset.lat, lng: +preset.lng } : null);
  const [venue, setVenue] = useState(preset?.name && preset.name !== preset.city ? preset.name : "");
  // The venue's OWN point and type, for the on-the-spot GPS check — `coords`
  // keeps the city centre when the city was picked first.
  const [venueSpot, setVenueSpot] = useState(Number.isFinite(+preset?.lat) && Number.isFinite(+preset?.lng) ? { lat: +preset.lat, lng: +preset.lng, category: null } : null);
  const [dateVal, setDateVal] = useState(preset?.visited_on || localISODate());
  const [results, setResults] = useState(null);
  const [searchFor, setSearchFor] = useState(null);
  const [searching, setSearching] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const runSearch = async (which) => {
    const q = which === "city" ? cityQ : venue;
    if (!q || q.trim().length < 2) return;
    setSearching(true); setSearchFor(which); setResults(null);
    const res = await placeSearch(q, coords);
    setResults(res); setSearching(false);
  };
  const pick = (r) => {
    if (searchFor === "city") { setCity(r.city || r.name); setCityQ(r.city || r.name); setCountry(r.country || ""); setCc(r.cc || ""); setCoords({ lat: r.lat, lng: r.lng }); }
    else { setVenue(r.name); if (Number.isFinite(+r.lat) && Number.isFinite(+r.lng)) setVenueSpot({ lat: +r.lat, lng: +r.lng, category: r.category || r.type || null }); if (!city) { setCity(r.city || ""); setCityQ(r.city || ""); } if (!country) setCountry(r.country || ""); if (!cc) setCc(r.cc || ""); if (!coords) setCoords({ lat: r.lat, lng: r.lng }); }
    setResults(null); setSearchFor(null);
  };
  const onPickPhotos = (e) => { const f = [...(e.target.files || [])]; e.target.value = ""; setPhotos((p) => [...p, ...f].slice(0, 4)); };
  const submit = async () => {
    const cityName = (city || cityQ).trim();
    if (!cityName) { showToast("Add a city first", "error"); return; }
    setBusy(true);
    // No stamp without proof (founder, 2026-10-03): being there now (GPS at the
    // picked venue, today), or a photo taken there. Nothing is created unproven.
    const sl = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const entity_id = `visit:${sl(cityName)}:${sl(venue)}:${dateVal}`;
    // Verify on the spot (founder, 2026-09-28: the Georgia Aquarium stamp got no
    // ✓ — this form never checked GPS). Only for a visit dated today, with a
    // picked venue: one fix, within that venue's stamp radius → 'gps' (the
    // worker still cross-checks the country and travel speed). A backfilled
    // past trip stays self-declared; a photo is its memory.
    let verified = "self";
    const spot = venueSpot || null;
    if (spot && dateVal === localISODate()) {
      const pos = await new Promise((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
      });
      if (pos && metersBetween(pos.coords.latitude, pos.coords.longitude, spot.lat, spot.lng) <= stampRadiusFor({ name: venue, category: spot.category })) verified = "gps";
    }
    if (verified !== "gps" && photos.length === 0) {
      setBusy(false);
      showToast("Stamps need proof — add a photo you took there (with its location on), or stamp it while you're there", "error");
      return;
    }
    const { data, error } = await addStamp({
      kind: "city", entity_type: "visit", entity_id,
      name: venue.trim() || cityName, city: cityName, region: null,
      country: country || null, cc: cc || undefined,
      lat: spot?.lat ?? coords?.lat ?? null, lng: spot?.lng ?? coords?.lng ?? null,
      visited_on: dateVal, local_hour: new Date().getHours(), verified,
      ...(verified !== "gps" ? { await_proof: true } : {}),
    });
    if (error || !data?.id) { setBusy(false); showToast(error || "Could not add stamp", "error"); return; }
    if (data.private) showToast("This may be a sensitive place ❤️ — the stamp starts private. Share it from the stamp anytime.", "success");
    let proof = null;
    for (const f of photos) {
      try {
        const exif = await readPhotoExif(f);   // before resizing strips it
        const image = await resizePhoto(f);
        const up = await uploadStampPhoto({ stamp_id: data.id, image, visited_on: dateVal, exif });
        if (up?.data?.proof && !proof) proof = up.data.proof;
      } catch { /* skip a bad photo */ }
    }
    // A photo-path stamp that no photo proved is removed — unless it was an
    // existing (grandfathered) stamp being re-stamped, which stays as it was.
    if (data.verified !== "gps" && !proof && data.created) {
      await deleteStamp(data.id).catch(() => {});
      setBusy(false);
      showToast("We couldn't confirm this place from those photos — use one you took there, with its location on", "error");
      return;
    }
    setBusy(false); showToast(data.verified === "gps" ? "✓ Verified — place stamped 🛂" : (proofToast(proof) || "Place stamped 🛂"), "success"); onDone();
  };

  const inputStyle = { width: "100%", border: `1px solid ${RULE}`, borderRadius: 12, padding: "10px 12px", fontSize: fs(14), color: INK, fontFamily: SANS, background: "#fff" };
  const labelStyle = { fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", textTransform: "uppercase", color: INK3, display: "block", marginTop: 14 };
  return (
    <div onClick={onClose} className="fixed inset-0 z-[9998] flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-white" style={{ maxWidth: 400, marginTop: 28, marginBottom: 40, borderRadius: 22, padding: 20, boxShadow: SHADOW_CARD_SOFT }}>
        <p style={{ fontFamily: SERIF, fontSize: fs(24), color: INK }}>Stamp a place</p>
        <p style={{ color: INK3, fontSize: fs(12.5), lineHeight: 1.4, marginTop: 2 }}>A quick ink stamp for a city or spot you visited — with your own photos.</p>

        <label style={labelStyle}>City</label>
        <div className="flex gap-2 mt-1">
          <input value={cityQ} onChange={(e) => { setCityQ(e.target.value); setCity(e.target.value); }} placeholder="e.g. Medellín, Colombia" style={inputStyle} />
          <button onClick={() => runSearch("city")} disabled={searching} className="shrink-0 rounded-xl px-3 font-semibold" style={{ background: IVORY_2, color: INK2, fontSize: fs(12.5) }}>Search</button>
        </div>

        <label style={labelStyle}>Spot / place (optional)</label>
        <div className="flex gap-2 mt-1">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Cracker Barrel" style={inputStyle} />
          <button onClick={() => runSearch("venue")} disabled={searching} className="shrink-0 rounded-xl px-3 font-semibold" style={{ background: IVORY_2, color: INK2, fontSize: fs(12.5) }}>Search</button>
        </div>

        {searching && <p style={{ color: INK3, fontSize: fs(12), marginTop: 8 }}>Searching…</p>}
        {results && (
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${RULE}` }}>
            {results.length === 0 ? (
              <p style={{ color: INK3, fontSize: fs(12.5), padding: 10 }}>No matches — just type it above and tap Stamp it.</p>
            ) : results.map((r, i) => (
              <button key={i} onClick={() => pick(r)} className="w-full text-left" style={{ padding: "9px 12px", borderTop: i ? `1px solid ${RULE}` : "none", background: "#fff" }}>
                <div style={{ fontSize: fs(13.5), color: INK, fontFamily: SANS, fontWeight: 600 }}>{r.name}</div>
                <div className="truncate" style={{ fontSize: fs(11), color: INK3 }}>{r.display}</div>
              </button>
            ))}
          </div>
        )}

        <label style={labelStyle}>Date</label>
        <input type="date" value={dateVal} max={localISODate()} onChange={(e) => setDateVal(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />

        <label style={labelStyle}>Proof photo — taken there (up to 4)</label>
        <p style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.45, marginTop: 4 }}>
          Stamped today at the place? Your GPS is the proof. A past trip needs a photo you took there — its location tag, or the place itself in the picture.
        </p>
        <div className="flex gap-2 mt-1 flex-wrap items-center">
          {photos.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: `1px solid ${RULE}` }} />
              <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.7)" }}><X size={11} color="#fff" strokeWidth={2.5} /></button>
            </div>
          ))}
          {photos.length < 4 && (
            <button onClick={() => fileRef.current?.click()} className="rounded-xl flex items-center justify-center" style={{ width: 56, height: 56, border: `1px dashed ${RULE}`, background: IVORY_2 }}><Plus size={18} color={INK3} /></button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-xl py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(14) }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-xl py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>{busy ? "Stamping…" : "Stamp it"}</button>
        </div>
      </div>
    </div>
  );
}

// Error boundary — never white-screen the passport; show what went wrong.
class PassportBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error("Passport crash:", err, info); } catch { /* ignore */ } }
  render() {
    if (this.state.err) {
      const dev = (() => { try { return !!import.meta.env.DEV; } catch { return false; } })();
      return (
        <div style={{ minHeight: "100vh", background: IVORY, padding: 24, fontFamily: SERIF, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🛂</div>
          <p style={{ fontSize: 22, color: STAMP, marginTop: 8 }}>Your passport didn’t open</p>
          <p style={{ fontSize: 15, color: INK3, marginTop: 8, maxWidth: 320, lineHeight: 1.5 }}>Something hiccuped while loading your stamps. Your collection is safe — give it another try.</p>
          <div className="flex gap-3" style={{ marginTop: 18 }}>
            <button onClick={() => this.setState({ err: null })} className="rounded-xl px-5 py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: 14 }}>Try again</button>
            <button onClick={() => { try { window.location.assign(createPageUrl("Home")); } catch { /* ignore */ } }} className="rounded-xl px-5 py-2 font-semibold" style={{ background: "transparent", color: INK, border: `1.5px solid ${INK3}`, fontSize: 14 }}>Back to Home</button>
          </div>
          {dev && (
            <div style={{ marginTop: 22, textAlign: "left", maxWidth: 520, fontFamily: MONO }}>
              <p style={{ fontSize: 13, color: INK, fontWeight: 700, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{String(this.state.err?.name || "Error")}: {String(this.state.err?.message || "(no message)")}</p>
              <p style={{ fontSize: 10.5, color: INK3, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{String(this.state.err?.stack || "")}</p>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PassportPage() { return <PassportBoundary><PassportInner /></PassportBoundary>; }

function PassportInner() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[820px]" : "max-w-md";
  const { isAuthenticated, profile, user } = useAuth();
  const isDev = isAdminEmail(user?.email); // sample-passport preview is admin-only
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState([]);
  const [stats, setStats] = useState({});
  const [tags, setTags] = useState([]);
  const [lightbox, setLightbox] = useState(null); // { photos:[{src}], index, title, credit } — the shared PhotoLightbox (swipe, ×)

  const [claim, setClaim] = useState(null); // { token, tag } from a shared invite link

  // "See a sample passport" preview — sample stamps, view-only, never saved.
  const [preview, setPreview] = useState(false);

  // Read-only friend view: a shared link (globeskimmers://passport/view?u=slug)
  // drops the slug in sessionStorage; web can pass ?view_slug=. When set, we load
  // that PUBLIC passport read-only (no owner actions).
  const [viewSlug] = useState(() => {
    try { return sessionStorage.getItem("pp_view_slug") || new URLSearchParams(window.location.search).get("view_slug") || null; }
    catch { return null; }
  });
  const readOnly = !!viewSlug;
  const [viewHolder, setViewHolder] = useState(null);
  // Consume the slug once so it doesn't leak into the user's OWN passport later.
  useEffect(() => { try { sessionStorage.removeItem("pp_view_slug"); } catch { /* ignore */ } }, []);

  const load = useCallback(async () => {
    setLoading(true);
    if (viewSlug) {
      const { data } = await getPublicPassport(viewSlug);
      if (data && !data.private) { setStamps(data.stamps || []); setStats(data.stats || {}); setViewHolder(data.holder || "A traveler"); }
      else { setStamps([]); setStats({}); setViewHolder(null); }
      setTags([]); setLoading(false); return;
    }
    const [pp, tg] = await Promise.all([listPassport(), listTags()]);
    setStamps(pp.stamps); setStats(pp.stats); setTags(tg.tags || []); setLoading(false);
  }, [viewSlug]);
  useEffect(() => { load(); }, [load]);

  // A shared invite link (globeskimmers://passport/claim?token=…) drops the token
  // in sessionStorage (see Layout deep-link handler); web can pass ?claim_token=.
  useEffect(() => {
    if (readOnly) return;
    let token = null;
    try { token = sessionStorage.getItem("pp_claim_token"); } catch { /* ignore */ }
    if (!token) { try { token = new URLSearchParams(window.location.search).get("claim_token"); } catch { /* ignore */ } }
    if (!token) return;
    getTagByToken(token).then(({ tag }) => {
      if (tag && tag.status === "pending") setClaim({ token, tag });
      else { try { sessionStorage.removeItem("pp_claim_token"); } catch { /* ignore */ } }
    });
  }, []);


  // Shareable booklet (privacy toggle + link).
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState(null); // { slug, is_public, url }
  const [shareBusy, setShareBusy] = useState(false);
  const [explainArrivals, setExplainArrivals] = useState(() => { try { return !localStorage.getItem("pp_arrival_explained"); } catch { return false; } });
  const openShare = async () => { setShareOpen(true); if (!share) { const { data } = await getShareLink(); if (data) setShare(data); } };
  const setPublic = async (pub) => { setShareBusy(true); const { data, error } = await getShareLink(pub); setShareBusy(false); if (error) showToast(error, "error"); else setShare(data); };
  // Read share state on mount so the privacy badge reflects the real status (default private).
  useEffect(() => { if (readOnly) return; (async () => { const { data } = await getShareLink(); if (data) setShare(data); })(); }, [readOnly]);

  // The Blotter (2026-09-30) — reaction stamps + guestbook AROUND each page.
  // One read per booklet; the strip under the open page aggregates its stamps.
  const blSlug = readOnly ? viewSlug : (share?.slug || null);
  const [blotter, setBlotter] = useState(null);
  const refreshBlotter = useCallback(async () => {
    if (!blSlug) return;
    setBlotter(await blotterRead(blSlug));
  }, [blSlug]);
  useEffect(() => { if (!preview && blSlug) refreshBlotter(); }, [blSlug, preview, refreshBlotter]);
  const shareNow = async () => {
    if (!share?.url) return;
    try {
      if (navigator.share) await navigator.share({ title: "Globeskimmers", text: "Check out my Virtual Passport on Globeskimmers 🛂", url: share.url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    } catch { /* dismissed */ }
  };

  // Places of respect (founder, 2026-10-04): the first time one sits in the
  // passport unanswered, show its message (a memorial also asks illustrated
  // or text only). Dismissing stays quiet for the rest of the session.
  const [memorialAsk, setMemorialAsk] = useState(null);
  const memorialLater = useRef(new Set());
  useEffect(() => {
    if (readOnly || preview || !isAuthenticated || loading || memorialAsk) return;
    const s = stamps.find((x) => needsRespectNote(x) && !memorialLater.current.has(x.id));
    if (s) setMemorialAsk(s);
  }, [loading, readOnly, preview, isAuthenticated, stamps, memorialAsk]);
  const chooseMemorialArt = async (art) => {
    const s = memorialAsk;
    if (!s) return;
    const { error } = await setStampArt(s.id, art);
    if (error) { showToast(error, "error"); return; }
    setStamps((prev) => prev.map((x) => (x.id === s.id ? { ...x, meta: { ...(x.meta || {}), art } } : x)));
    setMemorialAsk(null);
    if (respectPlaceFor(s)?.kind === "memorial") showToast(art === "plain" ? "Your stamp shows as text only" : "Your stamp keeps its illustration", "success");
  };
  const laterMemorial = () => {
    if (memorialAsk) memorialLater.current.add(memorialAsk.id);
    setMemorialAsk(null);
  };

  // City sets — the collection joy ("7 of 10 Atlanta icons"), no streaks.
  const [citySets, setCitySets] = useState([]);
  useEffect(() => {
    if (readOnly || preview || !isAuthenticated || loading) return;
    let gone = false;
    (async () => { const { sets } = await listCitySets(); if (!gone) setCitySets(sets); })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, readOnly, preview, isAuthenticated]);

  // The birthday ask (founder 2026-10-02): a warm, dismissible card — never a
  // wall. Appears once the passport holds 2+ stamps, snoozes 45 days on
  // "Later", and disappears for good once saved. No stamp (founder,
  // 2026-10-03): the birthday is private data — the year feeds the age gate
  // (minor detection, teen rails) and both feed demographics; never shown.
  const [bdayAsk, setBdayAsk] = useState(false);
  const [bdayYearNeeded, setBdayYearNeeded] = useState(false);
  const [bdayM, setBdayM] = useState(""); const [bdayD, setBdayD] = useState(""); const [bdayY, setBdayY] = useState("");
  const [bdayBusy, setBdayBusy] = useState(false);
  useEffect(() => {
    if (readOnly || preview || !isAuthenticated || loading || stamps.length < 2) return;
    try { const t = Number(localStorage.getItem("pp_bday_ask_snooze") || 0); if (Date.now() - t < 45 * 864e5) return; } catch { /* fine */ }
    let gone = false;
    (async () => {
      const { set, birth_md, error } = await getAgeInfo();
      if (gone || error) return;
      if (!birth_md || !set) { setBdayYearNeeded(!set); setBdayAsk(true); }
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, readOnly, preview, isAuthenticated]);
  const saveBdayAsk = async () => {
    if (!bdayM || !bdayD || (bdayYearNeeded && bdayY.length !== 4)) return;
    setBdayBusy(true);
    if (bdayYearNeeded) {
      const { error: yErr } = await setAgeGate(Number(bdayY));
      if (yErr && yErr !== "age_required") { setBdayBusy(false); showToast(yErr, "error"); return; }
    }
    const { error } = await setBirthday(`${bdayM}-${bdayD}`);
    setBdayBusy(false);
    if (error) { showToast(error, "error"); return; }
    setBdayAsk(false);
    showToast("🎂 Thanks — saved privately", "success");
  };
  const snoozeBdayAsk = () => { try { localStorage.setItem("pp_bday_ask_snooze", String(Date.now())); } catch { /* fine */ } setBdayAsk(false); };

  // Two-question claim (2026-09-29): 1) were you there together? 2) add the
  // stamp? Presence feeds combined albums and "with @x"; the stamp is separate.
  const [claimPresence, setClaimPresence] = useState(null); // null → question 1
  const respondClaim = async (action, presence) => {
    if (!claim) return;
    const { data, error } = await claimTag(claim.token, action, presence);
    try { sessionStorage.removeItem("pp_claim_token"); } catch { /* ignore */ }
    setClaim(null); setClaimPresence(null);
    if (error) { showToast(error, "error"); return; }
    if (action === "accept" && data?.needs_proof) {
      showToast("Noted — you were there together. Add a photo from that day to earn the stamp", "success");
      setStampPreset(data.place || null); setShowStampPlace(true);
    } else showToast(action === "accept" ? "You already have this stamp 🛂" : presence ? "Noted — no stamp added" : "Declined", "success");
    load();
  };
  const blockClaim = async () => {
    if (!claim) return;
    const { error } = await blockTagger(claim.token);
    try { sessionStorage.removeItem("pp_claim_token"); } catch { /* ignore */ }
    setClaim(null); setClaimPresence(null);
    showToast(error || "Blocked — they can't tag you again", error ? "error" : "success");
  };

  const holder = readOnly ? (viewHolder || "A traveler") : (profile?.first_name || profile?.display_name || "Traveler");
  // Apple 1.2's report door on shared passports (Social P1): one tap, one
  // reason, silent to the owner; minor_safety carries the 24h triage SLA.
  const [reporting, setReporting] = useState(false);
  const sendReport = async (reason) => {
    const { error } = await reportShared({ slug: viewSlug, kind: "passport", reason });
    setReporting(false);
    showToast(error || "Thank you — we review every report", error ? "error" : "success");
  };
  const exitView = () => { try { sessionStorage.removeItem("pp_view_slug"); } catch { /* ignore */ } window.location.assign(createPageUrl("Passport")); };

  // Booklet view: one swipeable page per country (like a real passport).
  const [openStampId, setOpenStampId] = useState(null);
  // Tapping a stamp opens its OPTIONS sheet (photos, own page, delete…); the
  // detail card behind "Details, date & tag a friend" is the old modal.
  const [actionsId, setActionsId] = useState(null);
  // Nearby-stamp sensing switch (founder, 2026-09-27): same key as Settings →
  // Virtual Passport, so either place turns the pop-up off. Flipping it on
  // here remounts the prompt so it senses right away.
  const [senseNearby, setSenseNearby] = useState(() => nearbySensingOn());
  const toggleSenseNearby = () => {
    const next = !senseNearby;
    setSenseNearby(next);
    try { localStorage.setItem(NEARBY_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    showToast(next ? "Nearby stamps: on" : "Nearby stamps: off", "success");
  };
  // On open, the view defaults to the full-size passport (founder, 2026-09-27):
  // once the stamps have loaded, scroll the book's top to just under the app
  // header. The page still scrolls up to the stats and share controls.
  const bookRef = useRef(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (loading || scrolledRef.current || !bookRef.current) return;
    scrolledRef.current = true;
    const el = bookRef.current;
    const banner = document.querySelector(".gs-app-banner");
    const top = el.getBoundingClientRect().top + window.scrollY - ((banner && banner.offsetHeight) || 0) - 6;
    try { window.scrollTo({ top: Math.max(0, top), behavior: "auto" }); } catch { window.scrollTo(0, Math.max(0, top)); }
  }, [loading]);
  const [showStampPlace, setShowStampPlace] = useState(false); // "Stamp a place" form
  const [stampPreset, setStampPreset] = useState(null);         // a tag's place, handed to the form
  // Page one for an owner whose onboarding mint never happened — the same
  // origin stamp Onboarding.jsx creates (cover page, not an achievement).
  const [mintingHome, setMintingHome] = useState(false);
  const mintHomeCity = async () => {
    if (!profile?.home_city || mintingHome) return;
    setMintingHome(true);
    // Page one is earned at home, like every stamp: one GPS fix within the
    // home city (40 km of its saved centre).
    const pos = await new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
    const home = Number.isFinite(+profile.home_lat) && Number.isFinite(+profile.home_lng);
    if (!pos || !home || metersBetween(pos.coords.latitude, pos.coords.longitude, +profile.home_lat, +profile.home_lng) > 40000) {
      setMintingHome(false);
      showToast(`Page one is stamped at home — open this when you're in ${profile.home_city}`, "error");
      return;
    }
    const { error } = await addStamp({
      kind: "city", entity_type: "origin", entity_id: `origin:${profile.home_city}`,
      name: profile.home_city, city: profile.home_city,
      country: profile.home_country || undefined,
      cc: countryCode(profile.home_country || "") || undefined,
      lat: profile.home_lat ?? undefined, lng: profile.home_lng ?? undefined,
      visited_on: localISODate(), verified: "gps", origin: true, // the fix proves home; the stamp keeps the city centre, never the doorstep
    });
    setMintingHome(false);
    if (error) { showToast(error, "error"); return; }
    showToast("Page one — your home city 🛂", "success");
    load();
  };
  const stampsView = preview ? SAMPLE_STAMPS : stamps;
  const statsView = preview ? SAMPLE_STATS : stats;
  // Flat, newest-first stamp list — PassportBook paginates it to fit each page
  // (no scrolling), packing by real size and mixing countries like a passport.
  const bookStamps = useMemo(() => {
    const t = (s) => Date.parse(s.visited_on || s.created_at) || 0;
    return [...stampsView].sort((a, b) => t(b) - t(a));
  }, [stampsView]);

  // The stamp open in the detail modal — re-derived from fresh data (auto-closes if deleted).
  const openStamp = openStampId ? stampsView.find((s) => s.id === openStampId) : null;
  useEffect(() => { if (openStampId && !stampsView.some((s) => s.id === openStampId)) setOpenStampId(null); }, [stampsView, openStampId]);
  const actionsStamp = actionsId ? stampsView.find((s) => s.id === actionsId) : null;
  useEffect(() => { if (actionsId && !stampsView.some((s) => s.id === actionsId)) setActionsId(null); }, [stampsView, actionsId]);
  // Every memory photo of a stamp, in the lightbox's shape, opened at `index`.
  const enlargeStampPhotos = (st, index) => {
    const photos = (st.photos || []).map((p) => ({ src: p.photo_url, id: p.id, caption: p.caption || null, food: Number(p.food_subject) === 1 }));
    if (!photos.length) return;
    setLightbox({ photos, index: Math.min(Math.max(index || 0, 0), photos.length - 1), title: `I was here! ${st.name}`, credit: st.visited_on ? fmtDate(st.visited_on) : null, social: true });
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY, fontFamily: SANS }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} aria-label="Back">
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <button onClick={load} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color={INK} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-28`}>
        {preview && (
          <div className="mb-4 rounded-[16px] px-3.5 py-2.5 flex items-center justify-between gap-2" style={{ background: "#EAF2FF", border: "1px solid #C7DBF5" }}>
            <span style={{ color: "#2B4A7E", fontSize: fs(12.5), lineHeight: 1.4 }}>👁 Preview — sample stamps (not saved to your passport).</span>
            <button onClick={() => setPreview(false)} className="shrink-0 rounded-lg px-3 py-1.5 font-semibold" style={{ background: "#2B4A7E", color: "#fff", fontSize: fs(12) }}>Exit</button>
          </div>
        )}
        {/* Holder + stats */}
        <div className="text-center pt-1 pb-3">
          {!readOnly && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full" style={{ background: share?.is_public ? "#F3E2C7" : IVORY_2, color: share?.is_public ? "#7E601F" : INK3, fontSize: fs(11.5), fontWeight: 600 }}>
              {share?.is_public ? "🔗 Shared — anyone with your link can view" : "🔒 Only you can see this"}
            </div>
          )}
        </div>
        {readOnly && (
          <div className="mb-4 rounded-[16px] px-3.5 py-2.5 flex items-center justify-between gap-2" style={{ background: "#F3E2C7", border: "1px solid #E5CA98" }}>
            <span style={{ color: "#7E601F", fontSize: fs(12.5), lineHeight: 1.4 }}>👀 You&rsquo;re viewing a shared passport.</span>
            <button onClick={exitView} className="shrink-0 rounded-lg px-3 py-1.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(12) }}>My passport</button>
          </div>
        )}
        {!readOnly && explainArrivals && (
          <div className="mb-4 rounded-[16px] p-3.5" style={{ background: "#FFFBF0", border: `1px solid #EAD9AE` }}>
            <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.5 }}>
              ✈️ You&rsquo;ll get an arrival stamp when you land at an airport in a new country, and you can stamp iconic attractions you visit — you always tap to confirm, we never stamp automatically. Your passport is <b>private</b> (only you can see it) unless you choose to share a link. You can turn suggestions off anytime in Settings.
            </p>
            <button onClick={() => { try { localStorage.setItem("pp_arrival_explained", "1"); } catch { /* ignore */ } setExplainArrivals(false); }} className="mt-2 rounded-lg px-3 py-1.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(12) }}>Got it</button>
          </div>
        )}
        {!readOnly && !preview && <HeldHandleClaim fs={fs} />}
        {!readOnly && !preview && bdayAsk && (
          <div className="mb-4 rounded-[16px] p-3.5" style={{ background: "#FFFBF0", border: "1px solid #EAD9AE" }}>
            <p style={{ color: INK, fontSize: fs(14), fontWeight: 700 }}>🎂 When&rsquo;s your birthday?</p>
            <p style={{ color: INK2, fontSize: fs(12.5), lineHeight: 1.45, marginTop: 2 }}>
              It keeps GlobeSkimmers age-appropriate and helps us build for travelers like you. It&rsquo;s private — never shown on your profile or passport.
            </p>
            <div className="flex gap-2 mt-2.5 items-center flex-wrap">
              <select value={bdayM} onChange={(e) => setBdayM(e.target.value)} aria-label="Birthday month" className="h-11 rounded-xl px-2" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }}>
                <option value="">Month</option>
                {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => <option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]}</option>)}
              </select>
              <select value={bdayD} onChange={(e) => setBdayD(e.target.value)} aria-label="Birthday day" className="h-11 rounded-xl px-2" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }}>
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
              </select>
              {bdayYearNeeded && (
                <input value={bdayY} onChange={(e) => setBdayY(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Year" inputMode="numeric" aria-label="Year you were born"
                  className="w-20 h-11 rounded-xl px-3 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13) }} />
              )}
              <button onClick={saveBdayAsk} disabled={bdayBusy || !bdayM || !bdayD || (bdayYearNeeded && bdayY.length !== 4)} className="h-11 px-4 rounded-xl font-semibold disabled:opacity-50" style={{ background: STAMP, color: "#fff", fontSize: fs(13) }}>{bdayBusy ? "Saving…" : "Save"}</button>
              <button onClick={snoozeBdayAsk} style={{ color: INK3, fontSize: fs(12) }}>Later</button>
            </div>
          </div>
        )}
        {stampsView.length > 0 && (
          <div className="bg-white rounded-[18px] p-3 mb-4 flex items-center justify-around" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <Stat n={statsView.countries || 0} label="Countries" />
            <Stat n={stampsView.length} label="Stamps" />
            <Stat n={statsView.verified || 0} label="Verified" />
          </div>
        )}

        {/* Share my passport (privacy toggle + link) */}
        {!readOnly && stamps.length > 0 && (
          <div className="mb-4">
            {!shareOpen ? (
              <button onClick={openShare} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13), fontWeight: 600 }}>🔗 Share my passport</button>
            ) : (
              <div className="bg-white rounded-[16px] p-3.5" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
                <p style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", textTransform: "uppercase", color: INK3 }}>Who can see it</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setPublic(false)} disabled={shareBusy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: share && !share.is_public ? STAMP : "#fff", color: share && !share.is_public ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(12.5) }}>🔒 Private</button>
                  <button onClick={() => setPublic(true)} disabled={shareBusy} className="flex-1 rounded-lg py-2 font-semibold" style={{ background: share && share.is_public ? STAMP : "#fff", color: share && share.is_public ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(12.5) }}>🔗 Anyone with link</button>
                </div>
                {share && share.is_public && (
                  <>
                    <button onClick={shareNow} className="w-full rounded-lg py-2.5 font-semibold mt-2.5" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>Share link</button>
                    <p style={{ color: INK3, fontSize: fs(10.5), lineHeight: 1.4, marginTop: 6, wordBreak: "break-all" }}>{share.url}</p>
                  </>
                )}
                <p style={{ color: INK3, fontSize: fs(10.5), lineHeight: 1.45, marginTop: 6 }}>Friends open the link → download the app → view your booklet. Switch back to Private anytime.</p>
                <button onClick={() => setShareOpen(false)} style={{ color: INK3, fontSize: fs(11.5), marginTop: 6 }}>Close</button>
              </div>
            )}
          </div>
        )}

        {/* Claim card — arrived via a shared invite link */}
        {claim && (
          <div className="mb-4 rounded-[18px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: "2px solid #EAD9AE", background: "#FFFBF0" }}>
            <p className="uppercase font-semibold" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: STAMP }}>🙌 You were tagged</p>
            <p style={{ color: INK, fontSize: fs(15), lineHeight: 1.4, marginTop: 4 }}>
              <b>{claim.tag.from_name || "A friend"}</b> tagged you at <b>{claim.tag.name}</b>
              {[claim.tag.city, claim.tag.country].filter(Boolean).length ? ` · ${[claim.tag.city, claim.tag.country].filter(Boolean).join(", ")}` : ""}
            </p>
            {claimPresence === null ? (<>
              <p style={{ color: INK3, fontSize: fs(12), marginTop: 1 }}>Were you there with {claim.tag.from_name || "them"}?</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => respondClaim("decline", false)} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5) }}>No, I wasn&apos;t</button>
                <button onClick={() => setClaimPresence(true)} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>Yes, I was ✓</button>
              </div>
            </>) : (<>
              <p style={{ color: INK3, fontSize: fs(12), marginTop: 1 }}>Add this stamp to your Virtual Passport?</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => respondClaim("decline", true)} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5) }}>Not this one</button>
                <button onClick={() => respondClaim("accept", true)} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>Prove it with a photo ✓</button>
              </div>
            </>)}
            <button onClick={blockClaim} className="w-full text-center mt-2.5" style={{ background: "none", border: 0, color: INK3, fontSize: fs(11), textDecoration: "underline", textUnderlineOffset: 3 }}>
              Don&apos;t know them? Block this person
            </button>
          </div>
        )}

        {/* Tagged-you inbox — someone said you were with them */}
        {tags.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="uppercase font-semibold px-1" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: STAMP }}>🙌 Tagged you</p>
            {tags.map((t) => <TagInbox key={t.id} tag={t} onDone={load} onProve={(place) => { setStampPreset(place); setShowStampPlace(true); }} />)}
          </div>
        )}

        {loading && stampsView.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: STAMP }} />
            <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".1em" }}>Opening your Virtual Passport…</p>
          </div>
        ) : stampsView.length === 0 && (readOnly || !isAuthenticated) ? (
          <div className="bg-white rounded-[22px] p-6 text-center mt-2" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <div style={{ fontSize: 48 }}>🛂</div>
            {readOnly ? (
              <>
                <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, marginTop: 6 }}>Nothing to show</p>
                <p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5, marginTop: 6 }}>This passport is private, empty, or the link isn’t valid.</p>
                <button onClick={exitView} className="mt-4 rounded-xl px-5 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>Start my own passport</button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, marginTop: 6 }}>Your Virtual Passport is empty</p>
                <p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5, marginTop: 6 }}>
                  Sign in to start collecting stamps — a permanent record of everywhere you’ve been, with your own photos.
                </p>
                <button onClick={() => navigate(createPageUrl("Home"))} className="mt-4 rounded-xl px-5 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>
                  Find stamps near me
                </button>
                <p style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.5, marginTop: 12 }}>
                  Went somewhere before you had the app? Add a stamp, drop in your photo, and set the real date — a lasting keepsake of every trip you’ve taken.
                </p>
              </>
            )}
          </div>
        ) : (
          /* THE BOOK — tap the cover to open, then flip through the pages */
          <div className="mt-1 mb-2" ref={bookRef}>
            <PassportBook
              stamps={bookStamps}
              holder={holder}
              homeCountry={readOnly ? null : (profile?.home_country || null)}
              countries={statsView.countries || 0}
              totalStamps={stampsView.length}
              onOpenStamp={(id) => ((readOnly || preview) ? setOpenStampId(id) : setActionsId(id))}
              renderUnderPage={!preview && blSlug ? (pgStamps) => (
                <BlotterStrip slug={blSlug} stamps={pgStamps} blotter={blotter} ownerView={!readOnly} onChanged={refreshBlotter} />
              ) : null}
            />
            {!readOnly && isAuthenticated && !preview && stamps.length === 0 && (
              <div className="mt-4 rounded-[18px] p-4 text-center" style={{ background: "#FFFBF0", border: "1px solid #EAD9AE" }}>
                <p style={{ fontFamily: SERIF, fontSize: fs(19), color: INK }}>Your passport is ready</p>
                <p style={{ color: INK2, fontSize: fs(13), lineHeight: 1.5, marginTop: 4 }}>
                  Stamps are earned by being there. Page one is your home city, stamped while you're home — then stamp places as you go, or add a trip from before with a photo you took there.
                </p>
                <div className="flex gap-2 justify-center flex-wrap mt-3">
                  {profile?.home_city ? (
                    <button onClick={mintHomeCity} disabled={mintingHome} className="rounded-full px-4 py-2.5 font-semibold disabled:opacity-60" style={{ background: STAMP, color: "#fff", fontSize: fs(13) }}>
                      {mintingHome ? "Stamping…" : `🏠 Stamp ${profile.home_city}`}
                    </button>
                  ) : (
                    <button onClick={() => navigate(createPageUrl("Settings"))} className="rounded-full px-4 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13) }}>
                      🏠 Set your home city
                    </button>
                  )}
                  <button onClick={() => navigate(createPageUrl("Home"))} className="rounded-full px-4 py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>
                    📍 Stamps near me
                  </button>
                </div>
              </div>
            )}
            {!readOnly && isAuthenticated && !preview && (
              <div className="text-center mt-4">
                <button onClick={() => setShowStampPlace(true)} className="rounded-full px-5 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>✍️ Stamp a place</button>
                {/* Small switch — the same setting as Settings → Virtual Passport → Sense nearby stamps */}
                <button type="button" onClick={toggleSenseNearby} role="switch" aria-checked={senseNearby} aria-label="Sense nearby stamps when the Passport opens"
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: "#fff", border: `1px solid ${RULE}`, color: INK3, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".06em", textTransform: "uppercase" }}>
                  <span aria-hidden="true" className="relative inline-block rounded-full" style={{ width: 28, height: 16, background: senseNearby ? TEAL_DEEP : "rgba(22,17,13,.18)", transition: "background .15s" }}>
                    <span className="absolute top-[2px] rounded-full" style={{ width: 12, height: 12, background: "#fff", left: senseNearby ? 14 : 2, transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
                  </span>
                  Nearby stamps {senseNearby ? "on" : "off"}
                </button>
              </div>
            )}
            {/* City sets — quiet progress chips, never a guilt bar */}
            {!readOnly && !preview && citySets.length > 0 && (
              <div className="max-w-md mx-auto px-4 mt-6">
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>City sets</div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {citySets.map((cs) => (
                    <span key={cs.city} className="rounded-full px-3 py-1.5" style={{ background: cs.have >= cs.total ? "#2E6B4E" : "#fff", color: cs.have >= cs.total ? "#fff" : INK2, border: `1px solid ${cs.have >= cs.total ? "#2E6B4E" : RULE}`, fontFamily: MONO, fontSize: fs(10.5), letterSpacing: ".05em" }}>
                      {cs.city.toUpperCase()} · {cs.have} OF {cs.total}{cs.have >= cs.total ? " ✓" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* My luggage — the trunk of earned labels (founder, 2026-09-29:
                passport keeps proof, the trunk keeps play). Derived from the
                stamps above; the photo-real skin auto-upgrades from R2. */}
            <Luggage stamps={stampsView} readOnly={readOnly || preview} />
            {/* The photo packets — a friend's payload only carries reviewed
                photos, so this shelf is safe on both views for free. */}
            <PhotoPackets stamps={stampsView} title={readOnly ? "Their photo packets" : "Photo packets"} owner={!readOnly && !preview} onChanged={load} />
            {isDev && !readOnly && !preview && (
              <div className="text-center mt-3">
                <button onClick={() => setPreview(true)} className="rounded-full px-4 py-2" style={{ background: "#fff", border: `1px solid ${RULE}`, color: INK2, fontSize: fs(12.5), fontWeight: 600 }}>👁 See a sample passport (admin)</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stamp detail — opened by tapping a token on a page */}
      {openStamp && (
        <div onClick={() => setOpenStampId(null)} className="fixed inset-0 z-[9998] flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: "rgba(22,17,13,.55)", backdropFilter: "blur(3px)" }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full" style={{ maxWidth: 380, marginTop: 32, marginBottom: 40 }}>
            <StampCard stamp={openStamp} onChanged={load}
              onEnlarge={(url) => {
                const i = (openStamp.photos || []).findIndex((p) => p.photo_url === url);
                if (i >= 0) enlargeStampPhotos(openStamp, i);
                else setLightbox({ photos: [{ src: url }], index: 0, title: `I was here! ${openStamp.name}`, credit: openStamp.visited_on ? fmtDate(openStamp.visited_on) : null });
              }}
              fromName={holder} homeCity={profile?.home_city} readOnly={readOnly || preview} />
            <button onClick={() => setOpenStampId(null)} className="mt-2 w-full rounded-xl py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>Close</button>
          </div>
        </div>
      )}

      {/* Stamp a place — manual city/spot visit stamp */}
      {showStampPlace && <StampPlaceModal preset={stampPreset} onClose={() => { setShowStampPlace(false); setStampPreset(null); }} onDone={() => { setShowStampPlace(false); setStampPreset(null); load(); }} />}

      {/* Friend view: the quiet report door (and the sheet of reasons) */}
      {readOnly && (
        <div className="text-center mt-6 mb-2">
          <button type="button" onClick={() => setReporting(true)} style={{ background: "none", border: 0, color: INK3, fontSize: fs(11), textDecoration: "underline", textUnderlineOffset: 3 }}>
            Report this passport
          </button>
        </div>
      )}
      {reporting && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Report this passport" style={{ background: "rgba(22,17,13,.45)" }} onClick={() => setReporting(false)}>
          <div className="w-full max-w-md rounded-t-[22px] p-5 pb-8" style={{ background: "#FFFCF7" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontFamily: SERIF, fontSize: fs(19), color: INK }}>What&apos;s wrong here?</p>
            <div className="flex flex-col gap-2 mt-3">
              {[["minor_safety", "A child's safety"], ["nudity", "Nudity or sexual content"], ["harassment", "Harassment or hate"], ["spam", "Spam or a scam"], ["other", "Something else"]].map(([id, label]) => (
                <button key={id} type="button" onClick={() => sendReport(id)} className="w-full rounded-[12px] py-2.5 font-semibold text-left px-4" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5) }}>{label}</button>
              ))}
              <button type="button" onClick={() => setReporting(false)} className="w-full rounded-[12px] py-2.5 font-semibold" style={{ background: "#F6F0E4", color: INK2, fontSize: fs(13) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* A place of respect is honored before anything else opens (founder, 2026-10-04) */}
      {memorialAsk && (
        <RespectPlaceSheet stamp={memorialAsk} place={respectPlaceFor(memorialAsk)} onChoose={chooseMemorialArt} onLater={laterMemorial} />
      )}

      {/* Stamp options — one tap on a stamp in the booklet */}
      {actionsStamp && !memorialAsk && (
        <StampActions
          stamp={actionsStamp}
          pages={packBookPages(bookStamps, Math.min(0.94 * window.innerWidth, 440), readFontScale())}
          fits={(a, b) => fitsTogether(a, b, Math.min(0.94 * window.innerWidth, 440), readFontScale())}
          readOnly={readOnly || preview}
          onClose={() => setActionsId(null)}
          onChanged={load}
          onDetails={() => { setActionsId(null); setOpenStampId(actionsStamp.id); }}
          onEnlarge={(i) => enlargeStampPhotos(actionsStamp, i)}
        />
      )}

      {/* Where you are right now — an attraction or airport you can stamp */}
      {!readOnly && !preview && isAuthenticated && !loading && senseNearby && (
        <NearbyStampPrompt key="nearby" stamps={stamps} onStamped={async (id) => { await load(); if (id) setActionsId(id); }} />
      )}

      {/* Memory photos, full screen: swipe through, × or swipe down to close */}
      <PhotoLightbox
        photos={lightbox?.photos}
        index={lightbox ? lightbox.index : null}
        onClose={() => setLightbox(null)}
        onIndexChange={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
        title={lightbox?.title}
        credit={lightbox?.credit}
        renderFooter={lightbox?.social && !preview ? (ph) => (
          <PhotoFooter key={ph.id} photo={ph} slug={blSlug} blotter={blotter} ownerView={!readOnly} onChanged={refreshBlotter}
            onCaption={(id, caption) => {
              setLightbox((l) => (l ? { ...l, photos: l.photos.map((x) => (x.id === id ? { ...x, caption } : x)) } : l));
              setStamps((prev) => prev.map((st) => (st.photos?.some((x) => x.id === id) ? { ...st, photos: st.photos.map((x) => (x.id === id ? { ...x, caption } : x)) } : st)));
            }} />
        ) : null}
      />
    </div>
  );
}
