import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Loader2, Plus, Trash2, Calendar, RefreshCw, X, UserPlus } from "lucide-react";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { addStamp, metersBetween, listPassport, uploadStampPhoto, setStampDate, deleteStamp, deleteStampPhoto, createTagInvite, getTagByToken, claimTag, listTags, respondTag, getShareLink, getPublicPassport } from "@/lib/passport";
import { placeSearch } from "@/lib/placeSearch";
import { stampArtUrl } from "@/lib/stampArt";
import { STAMP_INK_STRENGTH } from "@/lib/stampDesign";
import TypographicStamp from "@/components/passport/TypographicStamp";
import AirportStamp from "@/components/passport/AirportStamp";
import PassportBook from "@/components/passport/PassportBook";
import { isAdminEmail } from "@/lib/admins";
import { localISODate } from "@/lib/localDate";
import { stampRadiusFor } from "@/lib/stampRadius";
import { resizePhoto } from "@/lib/resizePhoto";
import PhotoLightbox from "@/components/finder/PhotoLightbox";
import NearbyStampPrompt, { NEARBY_KEY, nearbySensingOn } from "@/components/passport/NearbyStampPrompt";
import StampActions from "@/components/passport/StampActions";


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
  // Only a live GPS visit earns the ✓ (it's the only real proof of presence).
  // A photo is a memory, not verification; self-added shows no badge.
  if (verified === "gps") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified visit</Chip>;
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

function StampCard({ stamp, onChanged, onEnlarge, fromName, homeCity, readOnly }) {
  const isHome = stamp.kind === "city" && homeCity && String(stamp.city || "").toLowerCase() === String(homeCity).toLowerCase();
  const k = KIND[stamp.kind] || KIND.attraction;
  // Bespoke landmark stamp art (falls back to the category emoji if none exists).
  // Country stamps use the flag, not bespoke art.
  const artUrl = stamp.kind === "country" ? null : stampArtUrl(stamp.name);
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
      const image = await resizePhoto(file);
      const { error } = await uploadStampPhoto({ stamp_id: stamp.id, image, visited_on: stamp.visited_on || undefined });
      if (error) showToast(error, "error"); else { showToast("Photo added 📸", "success"); onChanged(); }
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

  // Airport arrival stamps render the authentic in-app stamp; memory photos welcome.
  if (stamp.kind === "airport") {
    return (
      <div className="bg-white rounded-[20px] p-3 flex flex-col items-center" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
        <AirportStamp iata={stamp.entity_id} city={stamp.city} country={stamp.country} countryCode={stamp.country} date={stamp.visited_on} width={264} />
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
            entityId={stamp.entity_id || stamp.id} width={138} overprint strength={STAMP_INK_STRENGTH}
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
function TagInbox({ tag, onDone }) {
  const [busy, setBusy] = useState(false);
  const k = KIND[tag.kind] || KIND.attraction;
  const place = [tag.city, tag.country].filter(Boolean).join(", ");
  const who = tag.from_name || "A traveler";
  const respond = async (action) => {
    setBusy(true);
    const { error } = await respondTag(tag.id, action);
    setBusy(false);
    if (error) showToast(error, "error");
    else { showToast(action === "accept" ? "Added to your Virtual Passport 🛂" : "Declined", "success"); onDone(); }
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
function StampPlaceModal({ onClose, onDone }) {
  const [cityQ, setCityQ] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [cc, setCc] = useState("");
  const [coords, setCoords] = useState(null);
  const [venue, setVenue] = useState("");
  // The venue's OWN point and type, for the on-the-spot GPS check — `coords`
  // keeps the city centre when the city was picked first.
  const [venueSpot, setVenueSpot] = useState(null);
  const [dateVal, setDateVal] = useState(localISODate());
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
    const { data, error } = await addStamp({
      kind: "city", entity_type: "visit", entity_id,
      name: venue.trim() || cityName, city: cityName, region: null,
      country: country || null, cc: cc || undefined,
      lat: spot?.lat ?? coords?.lat ?? null, lng: spot?.lng ?? coords?.lng ?? null,
      visited_on: dateVal, local_hour: new Date().getHours(), verified,
    });
    if (error || !data?.id) { setBusy(false); showToast(error || "Could not add stamp", "error"); return; }
    for (const f of photos) { try { const image = await resizePhoto(f); await uploadStampPhoto({ stamp_id: data.id, image, visited_on: dateVal }); } catch { /* skip a bad photo */ } }
    setBusy(false); showToast(data.verified === "gps" ? "✓ Verified — place stamped 🛂" : "Place stamped 🛂", "success"); onDone();
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

        <label style={labelStyle}>Memory photos (up to 4)</label>
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
  const shareNow = async () => {
    if (!share?.url) return;
    try {
      if (navigator.share) await navigator.share({ title: "Globeskimmers", text: "Check out my Virtual Passport on Globeskimmers 🛂", url: share.url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    } catch { /* dismissed */ }
  };

  const respondClaim = async (action) => {
    if (!claim) return;
    const { error } = await claimTag(claim.token, action);
    try { sessionStorage.removeItem("pp_claim_token"); } catch { /* ignore */ }
    setClaim(null);
    if (error) showToast(error, "error");
    else { showToast(action === "accept" ? "Added to your Virtual Passport 🛂" : "Declined", "success"); load(); }
  };

  const holder = readOnly ? (viewHolder || "A traveler") : (profile?.first_name || profile?.display_name || "Traveler");
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
  // "See a sample passport" preview — sample stamps, view-only, never saved.
  const [preview, setPreview] = useState(false);
  const [showStampPlace, setShowStampPlace] = useState(false); // "Stamp a place" form
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
    const photos = (st.photos || []).map((p) => ({ src: p.photo_url }));
    if (!photos.length) return;
    setLightbox({ photos, index: Math.min(Math.max(index || 0, 0), photos.length - 1), title: `I was here! ${st.name}`, credit: st.visited_on ? fmtDate(st.visited_on) : null });
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
            <p style={{ color: INK3, fontSize: fs(12), marginTop: 1 }}>Add this stamp to your Virtual Passport?</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => respondClaim("decline")} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: "#fff", color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5) }}>Decline</button>
              <button onClick={() => respondClaim("accept")} className="flex-1 rounded-lg py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(13.5) }}>Allow ✓</button>
            </div>
          </div>
        )}

        {/* Tagged-you inbox — someone said you were with them */}
        {tags.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="uppercase font-semibold px-1" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: STAMP }}>🙌 Tagged you</p>
            {tags.map((t) => <TagInbox key={t.id} tag={t} onDone={load} />)}
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
                  {isAuthenticated
                    ? <>Tap <b>“📍 I was here”</b> at iconic attractions and landmarks you’ve visited — and you’ll get an arrival stamp when you land at an airport in a new country. Every place adds to your story.</>
                    : <>Sign in to start collecting stamps — a permanent record of everywhere you’ve been, with your own photos.</>}
                </p>
                <button onClick={() => navigate(createPageUrl("ThingsToDo"))} className="mt-4 rounded-xl px-5 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>
                  Find places to stamp
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
            />
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
      {showStampPlace && <StampPlaceModal onClose={() => setShowStampPlace(false)} onDone={() => { setShowStampPlace(false); load(); }} />}

      {/* Stamp options — one tap on a stamp in the booklet */}
      {actionsStamp && (
        <StampActions
          stamp={actionsStamp}
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
      />
    </div>
  );
}
