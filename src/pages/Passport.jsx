import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Loader2, Plus, Trash2, Calendar, RefreshCw, X } from "lucide-react";
import { IVORY, IVORY_2, TEAL_DEEP, SHADOW_CARD_SOFT } from "@/components/redesign/constants";
import { useIsTablet } from "@/lib/useIsTablet";
import { useAuth } from "@/lib/AuthContext";
import { listPassport, uploadStampPhoto, setStampDate, deleteStamp, deleteStampPhoto } from "@/lib/passport";

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
  if (verified === "gps") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified visit</Chip>;
  if (verified === "photo") return <Chip bg="#E7F3EA" color="#266A3B">✓ Verified · photo</Chip>;
  return <Chip bg={IVORY_2} color={INK3}>Self-added</Chip>;
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

function StampCard({ stamp, onChanged, onEnlarge }) {
  const k = KIND[stamp.kind] || KIND.attraction;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [dateVal, setDateVal] = useState(stamp.visited_on || "");
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
      if (error) alert(error); else onChanged();
    } catch (err) { alert(err?.message || "Upload failed"); }
    finally { setBusy(false); }
  };
  const saveDate = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) { setShowDate(false); return; }
    setBusy(true);
    const { error } = await setStampDate(stamp.id, dateVal);
    setBusy(false); setShowDate(false);
    if (error) alert(error); else onChanged();
  };
  const removeStamp = async () => {
    if (!confirm(`Remove your ${k.label.toLowerCase()} stamp for "${stamp.name}"? Its photos are removed too.`)) return;
    setBusy(true);
    const { error } = await deleteStamp(stamp.id);
    setBusy(false);
    if (error) alert(error); else onChanged();
  };
  const removePhoto = async (photoId) => {
    if (!confirm("Remove this photo?")) return;
    const { error } = await deleteStampPhoto(photoId);
    if (error) alert(error); else onChanged();
  };

  return (
    <div className="bg-white rounded-[20px] p-4" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 42, height: 42, background: IVORY_2, fontSize: 22 }}>{k.icon}</div>
          <div className="min-w-0">
            <p className="truncate" style={{ fontFamily: SERIF, fontSize: fs(19), color: INK, lineHeight: 1.15 }}>{stamp.name}</p>
            {place && <p className="truncate" style={{ color: INK3, fontSize: fs(12), fontFamily: MONO }}>{place}</p>}
          </div>
        </div>
        <button onClick={removeStamp} disabled={busy} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5" title="Remove stamp">
          <Trash2 size={14} color={INK3} strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        <VerifiedBadge verified={stamp.verified} />
        <button onClick={() => setShowDate((s) => !s)} className="inline-flex items-center gap-1" style={{ color: INK2, fontSize: fs(12) }}>
          <Calendar size={12} color={INK3} /> {stamp.visited_on ? fmtDate(stamp.visited_on) : "Add date"}
        </button>
      </div>

      {showDate && (
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
              <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                <X size={11} color="#fff" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo (also the photo-proof that earns the ✓ on a self-added stamp) */}
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ background: IVORY_2, color: INK2, border: `1px dashed ${RULE}`, fontSize: fs(13), fontWeight: 600 }}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2.4} />}
        {photos.length ? "Add another photo" : stamp.verified === "self" ? "Add a photo to verify ✓" : "Add a memory photo"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
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
  const [lightbox, setLightbox] = useState(null); // { url, caption }

  const load = useCallback(async () => {
    setLoading(true);
    const { stamps, stats } = await listPassport();
    setStamps(stamps); setStats(stats); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pages = stamps.filter((s) => s.tier !== "mark");
  const marks = stamps.filter((s) => s.tier === "mark");
  const holder = profile?.first_name || profile?.display_name || "Traveler";

  return (
    <div className="min-h-screen" style={{ background: IVORY, fontFamily: SANS }}>
      {/* HEADER */}
      <div className="px-4 pt-2 pb-3">
        <div className={`${colWrap} mx-auto flex items-center justify-between`}>
          <button onClick={() => navigate(createPageUrl("Home"))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} aria-label="Back">
            <ChevronLeft size={18} color={INK} strokeWidth={2.2} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full uppercase" style={{ background: "#F3E2C7", color: STAMP, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".08em", fontWeight: 600 }}>
            🛂 Passport
          </div>
          <button onClick={load} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5" style={{ background: "#fff", border: `1px solid ${RULE}` }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} color={INK} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`${colWrap} mx-auto px-4 pb-28`}>
        {/* Holder + stats */}
        <div className="text-center pt-1 pb-3">
          <p className="uppercase" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".18em", color: INK3 }}>Passport of</p>
          <h1 className="italic leading-none" style={{ fontFamily: SERIF, fontSize: fs(34), color: STAMP, marginTop: 4 }}>{holder}</h1>
        </div>
        {stamps.length > 0 && (
          <div className="bg-white rounded-[18px] p-3 mb-4 flex items-center justify-around" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <Stat n={stats.countries || 0} label="Countries" />
            <Stat n={stats.cities || 0} label="Cities" />
            <Stat n={stamps.length} label="Stamps" />
            <Stat n={stats.verified || 0} label="Verified" />
          </div>
        )}

        {loading && stamps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: STAMP }} />
            <p className="uppercase" style={{ color: INK3, fontFamily: MONO, fontSize: fs(11), letterSpacing: ".1em" }}>Opening your passport…</p>
          </div>
        ) : stamps.length === 0 ? (
          <div className="bg-white rounded-[22px] p-6 text-center mt-2" style={{ boxShadow: SHADOW_CARD_SOFT, border: `1px solid ${RULE}` }}>
            <div style={{ fontSize: 48 }}>🛂</div>
            <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, marginTop: 6 }}>Your passport is empty</p>
            <p style={{ color: INK2, fontSize: fs(13.5), lineHeight: 1.5, marginTop: 6 }}>
              {isAuthenticated
                ? <>Tap <b>“📍 I was here”</b> on any place you’ve visited — attractions, a city, a landmark. Your first stamp starts your story, and every place you go adds a page.</>
                : <>Sign in to start collecting stamps — a permanent record of everywhere you’ve been, with your own photos.</>}
            </p>
            <button onClick={() => navigate(createPageUrl("ThingsToDo"))} className="mt-4 rounded-xl px-5 py-2.5 font-semibold" style={{ background: STAMP, color: "#fff", fontSize: fs(14) }}>
              Find places to stamp
            </button>
            <p style={{ color: INK3, fontSize: fs(11.5), lineHeight: 1.5, marginTop: 12 }}>
              Went somewhere before you had the app? Add a stamp, upload your photo, set the date — you’ll earn the ✓.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pages.length > 0 && (
              <>
                <p className="uppercase font-semibold px-1" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: INK3 }}>Passport pages</p>
                {pages.map((s) => <StampCard key={s.id} stamp={s} onChanged={load} onEnlarge={(url) => setLightbox({ url, caption: s.name })} />)}
              </>
            )}
            {marks.length > 0 && (
              <>
                <p className="uppercase font-semibold px-1 pt-2" style={{ fontFamily: MONO, fontSize: fs(10), letterSpacing: ".08em", color: INK3 }}>Places visited</p>
                {marks.map((s) => <StampCard key={s.id} stamp={s} onChanged={load} onEnlarge={(url) => setLightbox({ url, caption: s.name })} />)}
              </>
            )}
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
