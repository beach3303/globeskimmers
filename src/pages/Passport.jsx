import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { countryCode } from "@/lib/countries";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Loader2, Plus, Trash2, Calendar, RefreshCw, X, UserPlus } from "lucide-react";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { addStamp, listPassport, uploadStampPhoto, setStampDate, deleteStamp, deleteStampPhoto, createTagInvite, getTagByToken, claimTag, listTags, respondTag, getShareLink, getPublicPassport } from "@/lib/passport";
import { stampArtUrl } from "@/lib/stampArt";
import AirportStamp from "@/components/passport/AirportStamp";

const citySlug = (s) => "city:" + String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Country name → flag emoji (renders as a real flag on iOS/Android; no network).
const flagFor = (country) => {
  const cc = countryCode(country);
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "🗺️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

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

// Client-side resize → JPEG data URL (keeps payload small + drops EXIF/GPS).
function resizePhoto(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

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

  // Airport arrival stamps render the authentic in-app stamp (no bespoke art / photos).
  if (stamp.kind === "airport") {
    return (
      <div className="bg-white rounded-[20px] p-3 flex flex-col items-center" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
        <AirportStamp iata={stamp.entity_id} city={stamp.city} countryCode={stamp.country} date={stamp.visited_on} width={264} />
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
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      {showArt && (
        <div className="flex justify-center mb-3">
          <img src={artUrl} alt={stamp.name} onError={() => setArtFailed(true)} onClick={() => onEnlarge(artUrl, stamp)}
            className="cursor-pointer active:scale-95 transition-transform"
            style={{ width: 138, height: 138, objectFit: "contain" }} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {!showArt && <div className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 42, height: 42, background: IVORY_2, fontSize: 22 }}>{k.icon}</div>}
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
          <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} max={new Date().toISOString().slice(0, 10)}
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
                <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <X size={11} color="#fff" strokeWidth={2.5} />
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

export default function PassportPage() {
  const navigate = useNavigate();
  const isTablet = useIsTablet();
  const colWrap = isTablet ? "max-w-[820px]" : "max-w-md";
  const { isAuthenticated, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState([]);
  const [stats, setStats] = useState({});
  const [tags, setTags] = useState([]);
  const [lightbox, setLightbox] = useState(null); // { url, caption }

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

  // Deferred-install fallback: a brand-new user pastes the invite link a friend
  // sent (the link/token survives even when deep-link attribution doesn't). We
  // pull the 32-hex token out of a pasted URL or bare token and show the claim.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteVal, setPasteVal] = useState("");
  const openPasted = async () => {
    const token = (String(pasteVal || "").match(/[a-f0-9]{32}/i) || [])[0] || "";
    if (!token) { showToast("Paste the full invite link", "error"); return; }
    const { tag } = await getTagByToken(token);
    if (tag && tag.status === "pending") { setClaim({ token, tag }); setPasteOpen(false); setPasteVal(""); }
    else showToast("That invite was already used or isn’t valid", "error");
  };

  // Page one: issue the home-city stamp once, so a new passport opens with the
  // user's origin instead of "member since". Matches the worker's city entity_id
  // scheme so it dedupes with any later home-city visit.
  const homeSeeded = useRef(false);
  useEffect(() => {
    if (readOnly || loading || homeSeeded.current) return;
    const hc = profile?.home_city;
    if (!hc) return;
    if (stamps.some((s) => s.kind === "city" && String(s.city || "").toLowerCase() === String(hc).toLowerCase())) { homeSeeded.current = true; return; }
    homeSeeded.current = true;
    addStamp({ kind: "city", tier: "page", entity_type: "city", entity_id: citySlug(hc), name: hc, city: hc, country: profile?.home_country || null, verified: "self" })
      .then(({ error }) => { if (!error) load(); });
  }, [loading, stamps, profile, load]);

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

  const pages = stamps.filter((s) => s.tier !== "mark");
  const marks = stamps.filter((s) => s.tier === "mark");
  const holder = readOnly ? (viewHolder || "A traveler") : (profile?.first_name || profile?.display_name || "Traveler");
  const exitView = () => { try { sessionStorage.removeItem("pp_view_slug"); } catch { /* ignore */ } window.location.assign(createPageUrl("Passport")); };

  // Booklet view: one swipeable page per country (like a real passport).
  const [view, setView] = useState(() => { try { return localStorage.getItem("pp_view") || "booklet"; } catch { return "booklet"; } });
  const setViewP = (v) => { setView(v); try { localStorage.setItem("pp_view", v); } catch { /* ignore */ } };
  const pageRefs = useRef([]);
  const byCountry = useMemo(() => {
    // Canonicalize country to a display name so ISO-2 airport stamps (e.g. "FR")
    // group with name-based country/city stamps (e.g. "France") on one page.
    const rn = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
    const label = (c) => { const s = String(c || "").trim(); return (rn && /^[A-Za-z]{2}$/.test(s)) ? (rn.of(s.toUpperCase()) || s) : s; };
    const groups = {};
    for (const s of stamps) { const k = label(s.country) || "Other places"; (groups[k] = groups[k] || []).push(s); }
    const t = (s) => Date.parse(s.visited_on || s.created_at) || 0;
    const order = Object.keys(groups).sort((a, b) => Math.max(...groups[b].map(t)) - Math.max(...groups[a].map(t)));
    for (const k of order) groups[k].sort((a, b) => (a.tier === "mark") - (b.tier === "mark") || t(b) - t(a));
    return { order, groups };
  }, [stamps]);

  return (
    <div className="min-h-screen" style={{ background: IVORY, fontFamily: SANS }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} aria-label="Back">
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase" style={{ background: "#F3E2C7", color: STAMP, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".08em", fontWeight: 600 }}>
            🛂 Virtual Passport
          </div>
          <button onClick={load} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color={INK} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-28`}>
        {/* Holder + stats */}
        <div className="text-center pt-1 pb-3">
          <p className="uppercase" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".18em", color: INK3 }}>🛂 Virtual Passport</p>
          <h1 className="italic leading-tight" style={{ fontFamily: SERIF, fontSize: fs(32), color: STAMP, marginTop: 4 }}>{holder}&rsquo;s Virtual Passport</h1>
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
              ✈️ As you travel, we&rsquo;ll offer to stamp your passport when you reach a new country or airport — you always tap to confirm, we never stamp automatically. Your passport is <b>private</b> (only you can see it) unless you choose to share a link. You can turn suggestions off anytime in Settings.
            </p>
            <button onClick={() => { try { localStorage.setItem("pp_arrival_explained", "1"); } catch { /* ignore */ } setExplainArrivals(false); }} className="mt-2 rounded-lg px-3 py-1.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(12) }}>Got it</button>
          </div>
        )}
        {stamps.length > 0 && (
          <div className="bg-white rounded-[18px] p-3 mb-4 flex items-center justify-around" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <Stat n={stats.countries || 0} label="Countries" />
            <Stat n={stats.cities || 0} label="Cities" />
            <Stat n={stamps.length} label="Stamps" />
            <Stat n={stats.verified || 0} label="Verified" />
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

        {/* Have an invite link? (deferred-install fallback — paste it to claim) */}
        {!readOnly && !claim && (
          <div className="mb-4">
            {!pasteOpen ? (
              <button onClick={() => setPasteOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
                style={{ background: "#fff", color: INK2, border: `1px dashed ${RULE}`, fontSize: fs(12.5), fontWeight: 600 }}>
                🔗 A friend sent you an invite link? Add it
              </button>
            ) : (
              <div className="bg-white rounded-[16px] p-3" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
                <div className="flex gap-2">
                  <input value={pasteVal} onChange={(e) => setPasteVal(e.target.value)} placeholder="Paste the invite link"
                    autoCapitalize="none" autoCorrect="off"
                    className="flex-1 rounded-lg px-3 py-2" style={{ border: `1px solid ${RULE}`, fontSize: fs(13), color: INK }} />
                  <button onClick={openPasted} className="rounded-lg px-3.5 py-2 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(12.5) }}>Add</button>
                </div>
                <button onClick={() => { setPasteOpen(false); setPasteVal(""); }} style={{ color: INK3, fontSize: fs(11.5), marginTop: 6 }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Tagged-you inbox — someone said you were with them */}
        {tags.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="uppercase font-semibold px-1" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: STAMP }}>🙌 Tagged you</p>
            {tags.map((t) => <TagInbox key={t.id} tag={t} onDone={load} />)}
          </div>
        )}

        {/* View toggle */}
        {stamps.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <button onClick={() => setViewP("booklet")} className="px-3.5 py-1.5 rounded-full font-semibold" style={{ background: view === "booklet" ? STAMP : "#fff", color: view === "booklet" ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>📖 Booklet</button>
            <button onClick={() => setViewP("list")} className="px-3.5 py-1.5 rounded-full font-semibold" style={{ background: view === "list" ? STAMP : "#fff", color: view === "list" ? "#fff" : INK2, border: `1px solid ${RULE}`, fontSize: fs(13) }}>☰ List</button>
          </div>
        )}

        {loading && stamps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: STAMP }} />
            <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".1em" }}>Opening your Virtual Passport…</p>
          </div>
        ) : stamps.length === 0 ? (
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
                    ? <>Tap <b>“📍 I was here”</b> on any place you’ve visited — attractions, a city, a landmark. Your first stamp starts your story, and every place you go adds a page.</>
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
        ) : view === "list" ? (
          <div className="space-y-3">
            {pages.length > 0 && (
              <>
                <p className="uppercase font-semibold px-1" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: INK3 }}>Passport pages</p>
                {pages.map((s) => <StampCard key={s.id} stamp={s} onChanged={load} onEnlarge={(url) => setLightbox({ url, caption: s.name })} fromName={holder} homeCity={profile?.home_city} readOnly={readOnly} />)}
              </>
            )}
            {marks.length > 0 && (
              <>
                <p className="uppercase font-semibold px-1 pt-2" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: INK3 }}>Places visited</p>
                {marks.map((s) => <StampCard key={s.id} stamp={s} onChanged={load} onEnlarge={(url) => setLightbox({ url, caption: s.name })} fromName={holder} homeCity={profile?.home_city} readOnly={readOnly} />)}
              </>
            )}
          </div>
        ) : (
          /* BOOKLET — one swipeable page per country */
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: "none" }}>
              {byCountry.order.map((c, i) => (
                <button key={c} onClick={() => pageRefs.current[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })}
                  className="flex-none inline-flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "#fff", border: `1px solid ${RULE}`, fontSize: fs(12.5), fontWeight: 600, color: INK2 }}>
                  <span style={{ fontSize: 16 }}>{flagFor(c)}</span>{c}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", margin: "0 -4px", padding: "2px 4px 4px" }}>
              {byCountry.order.map((c, i) => (
                <section key={c} ref={(el) => { pageRefs.current[i] = el; }}
                  style={{ flex: "0 0 100%", scrollSnapAlign: "center", background: "#FBF6EC", border: "1px solid #EADFC9", borderRadius: 18, padding: 14, position: "relative", overflow: "hidden" }}>
                  <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.06, fontSize: 170, pointerEvents: "none" }}>{flagFor(c)}</div>
                  <div className="flex items-center justify-between mb-3" style={{ position: "relative" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ fontSize: 26, lineHeight: 1 }}>{flagFor(c)}</span>
                      <h2 className="truncate" style={{ fontFamily: SERIF, fontSize: fs(24), color: INK, lineHeight: 1.05 }}>{c}</h2>
                    </div>
                    <span className="uppercase shrink-0" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".08em", color: INK3 }}>{byCountry.groups[c].length} stamp{byCountry.groups[c].length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-3" style={{ position: "relative" }}>
                    {byCountry.groups[c].map((s) => <StampCard key={s.id} stamp={s} onChanged={load} onEnlarge={(url) => setLightbox({ url, caption: s.name })} fromName={holder} homeCity={profile?.home_city} readOnly={readOnly} />)}
                  </div>
                </section>
              ))}
            </div>
            {byCountry.order.length > 1 && <p className="text-center mt-2" style={{ color: INK3, fontSize: fs(11.5) }}>← swipe between countries →</p>}
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
          style={{ background: "rgba(22,17,13,0.82)", backdropFilter: "blur(6px)" }}>
          <img src={lightbox.url} alt="" style={{ maxWidth: "92vw", maxHeight: "76vh", objectFit: "contain", borderRadius: 14, border: "3px solid #fff" }} />
          {lightbox.caption && <p className="mt-3 text-center" style={{ color: "#fff", fontFamily: SERIF, fontSize: fs(18) }}>I was here! {lightbox.caption}</p>}
        </div>
      )}
    </div>
  );
}
