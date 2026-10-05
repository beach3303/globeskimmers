// Profile — the traveler's own page (Social P1, founder mockup 2026-09-29):
// who you are before a word is read. v1 is the OWNER's view: avatar initial,
// display name, @handle, home flag, a 140-char bio, traveler chips, the stamp
// stats, three favorite places picked from your own stamps, three dream
// destinations, the public/private dial with the share link, and the luggage.
// Friends' profiles arrive with P2 (follow + the mailbox feed).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Copy } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { countryCode } from "@/lib/countries";
import { listPassport, getHandle, getSocialProfile, setSocialProfile, getShareLink, setAgeGate, socialFollow, setAvatar } from "@/lib/passport";
import Luggage from "@/components/passport/Luggage";
import VirtualItems from "@/components/profile/VirtualItems";
import { readOsAgeRange, birthYearFromRange } from "@/lib/ageSignal";
import PhotoPackets from "@/components/passport/PhotoPackets";
import InviteButton from "@/components/passport/InviteButton";
import OfficialSeal from "@/components/passport/OfficialSeal";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const TEAL = "#0E7C86", STAMP = "#B0472F", IVORY = "#FFFCF7", SOFT = "#F6F0E4";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const flagFor = (country) => {
  const cc = countryCode(country || "");
  if (!cc || !/^[a-z]{2}$/i.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState([]);
  const [stats, setStats] = useState({});
  const [handle, setHandle] = useState(null);
  const [handleVerified, setHandleVerified] = useState(false); // founder-granted mark only
  const [sealTier, setSealTier] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [favorites, setFavorites] = useState([]);   // [string]
  const [favDraft, setFavDraft] = useState("");
  const [dreams, setDreams] = useState([]);          // [string]
  const [dreamDraft, setDreamDraft] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState({ is_public: false, url: null });
  const [shareBusy, setShareBusy] = useState(false);
  const [counts, setCounts] = useState({ followers: null, following: null });
  const [avatar, setAvatarUrl] = useState(null);
  const avatarRef = React.useRef(null);
  const pickAvatar = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try {
      const { resizePhoto } = await import("@/lib/resizePhoto");
      const img = await resizePhoto(f, 512);
      const { url, error } = await setAvatar(img);
      if (error) { showToast(error, "error"); return; }
      setAvatarUrl(url); showToast("Looking good", "success");
    } catch (err) { showToast(err?.message || "Couldn't read that photo", "error"); }
  };
  const [needYear, setNeedYear] = useState(false);
  const [yearDraft, setYearDraft] = useState("");

  useEffect(() => {
    let gone = false;
    (async () => {
      const [pp, h, sp, sh, fl] = await Promise.all([listPassport(), getHandle(), getSocialProfile(), getShareLink(), socialFollow("list")]);
      if (gone) return;
      setStamps(pp.stamps); setStats(pp.stats || {});
      setHandle(h.handle);
      setHandleVerified(h.verified === true);
      setSealTier(h.seal || null);
      const p = sp.profile || {};
      setName(p.display_name || profile?.first_name || "");
      setAvatarUrl(p.avatar || null);
      setBio(p.bio || "");
      setFavorites(Array.isArray(p.favorites) ? p.favorites.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean) : []);
      setDreams(Array.isArray(p.dreams) ? p.dreams.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean) : []);
      setWebsite(p.website || "");
      if (sh.data) setShare({ is_public: !!sh.data.is_public, url: sh.data.url || null });
      if (fl.data) setCounts({ followers: (fl.data.followers || []).length, following: (fl.data.following || []).length });
      setLoading(false);
    })();
    return () => { gone = true; };
     
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await setSocialProfile({
      display_name: name, bio, website,
      favorites, dreams,
    });
    setSaving(false);
    showToast(error || "Profile saved", error ? "error" : "success");
  };

  const toggleShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    if (needYear) {
      const { error: ageErr } = await setAgeGate(Number(yearDraft));
      if (ageErr && ageErr !== "age_required") { setShareBusy(false); showToast(ageErr, "error"); return; }
      setNeedYear(false);
    }
    const next = !share.is_public;
    const { data, error } = await getShareLink(next);
    setShareBusy(false);
    if (error === "age_required") {
      const os = await readOsAgeRange();
      const osYear = birthYearFromRange(os);
      if (osYear) {
        const { error: ageErr } = await setAgeGate(osYear);
        if (!ageErr) { setShareBusy(false); toggleShare(); return; }
      }
      setNeedYear(true); showToast("One thing first — the year you were born", "success"); return;
    }
    if (error) { showToast(error, "error"); return; }
    setShare({ is_public: !!data.is_public, url: data.url || null });
    showToast(data.is_public ? "Your passport is public — anyone with the link can view it" : "Back to private", "success");
  };

  const copyLink = async () => {
    if (!share.url) return;
    try { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    catch { showToast(share.url, "success"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: STAMP }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: IVORY }}>
      {/* The trunk is the banner — who you are before a word is read
          (founder, 2026-09-30: luggage on TOP of the profile). */}
      <Luggage stamps={stamps} readOnly={false} />
      {/* The rest of the shelf: laptop, bottle, travel buddies (founder, 2026-10-05) */}
      <VirtualItems stamps={stamps} />
      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => avatarRef.current?.click()} aria-label="Change your photo"
            className="flex-none w-16 h-16 rounded-full flex items-center justify-center overflow-hidden"
            style={{ background: STAMP, color: "#FFF6EC", fontFamily: SERIF, fontSize: fs(26), border: 0, padding: 0 }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (name || "T").slice(0, 1).toUpperCase()}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          <div className="min-w-0 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Your name"
              aria-label="Display name"
              className="w-full bg-transparent outline-none" style={{ fontFamily: SERIF, fontSize: fs(24), color: INK }} />
            <div style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK3, marginTop: 2 }}>
              {handle ? (<>
                @{handle}
                {handleVerified && <OfficialSeal size={13} tier={sealTier || "burgundy"} />}
              </>) : (
                <button type="button" onClick={() => navigate(createPageUrl("Settings"))} style={{ background: "none", border: 0, padding: 0, color: TEAL, textDecoration: "underline", textUnderlineOffset: 2, fontFamily: MONO, fontSize: fs(11.5) }}>
                  Claim your @username →
                </button>
              )}
              {profile?.home_country ? `  ·  ${flagFor(profile.home_country)} ${profile.home_country}` : ""}
            </div>
          </div>
        </div>

        {/* Bio + chips */}
        <div className="uppercase mt-4" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".16em", color: INK3 }}>About me</div>
        <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} placeholder="Tell the world who's holding this passport…"
          aria-label="About me" rows={3}
          className="w-full mt-1.5 rounded-xl px-3 py-2 outline-none resize-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(14), color: INK2 }} />
        <div className="uppercase mt-3" style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".16em", color: INK3 }}>My website</div>
        <input value={website} onChange={(e) => setWebsite(e.target.value.slice(0, 120))} placeholder="https://…"
          aria-label="My website" inputMode="url" autoCapitalize="none" autoCorrect="off"
          className="w-full mt-1.5 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontFamily: MONO, fontSize: fs(12.5), color: INK2 }} />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[["Stamps", stats.total || stamps.length || 0, "Passport"], ["Countries", stats.countries || 0, "Passport"], ["Followers", counts.followers ?? "—", "Mailbox"], ["Following", counts.following ?? "—", "Mailbox"]].map(([l, v, dest]) => (
            <button key={l} type="button" onClick={() => navigate(createPageUrl(dest))} className="rounded-[14px] py-3 text-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <div style={{ fontSize: fs(20), fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", color: INK3, textTransform: "uppercase" }}>{l}</div>
            </button>
          ))}
        </div>

        {/* Favorites — anything, as many as you like */}
        <div className="mt-6">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>My favorite places</div>
          <div className="flex gap-2 mt-2">
            <input value={favDraft} onChange={(e) => setFavDraft(e.target.value.slice(0, 60))}
              placeholder="Anywhere you love — a city, a beach, a diner…" aria-label="Add a favorite place"
              onKeyDown={(e) => { if (e.key === "Enter" && favDraft.trim()) { setFavorites([...favorites, favDraft.trim()]); setFavDraft(""); } }}
              className="flex-1 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13.5) }} />
            <button type="button" disabled={!favDraft.trim()} onClick={() => { setFavorites([...favorites, favDraft.trim()]); setFavDraft(""); }}
              className="rounded-xl px-4 font-semibold disabled:opacity-50" style={{ background: TEAL, color: "#fff", fontSize: fs(13) }}>Add</button>
          </div>
          {favorites.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {favorites.map((f, i) => (
                <span key={`${f}-${i}`} className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1.5" style={{ background: SOFT, border: `1px solid ${RULE}`, fontSize: fs(12), color: INK2, fontWeight: 600 }}>
                  {f}
                  <button type="button" onClick={() => setFavorites(favorites.filter((_, j) => j !== i))} aria-label={`Remove ${f}`}
                    style={{ background: "none", border: 0, color: INK3, fontSize: fs(12), padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* On the Horizon — optional, free-form */}
        <div className="mt-5">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>On the horizon</div>
          <p style={{ fontSize: fs(11.5), color: INK3, marginTop: 2 }}>The places still waiting for you — optional, and yours to dream.</p>
          <div className="flex gap-2 mt-2">
            <input value={dreamDraft} onChange={(e) => setDreamDraft(e.target.value.slice(0, 60))}
              placeholder="Santorini… Kyoto… the Northern Lights…" aria-label="Add a horizon"
              onKeyDown={(e) => { if (e.key === "Enter" && dreamDraft.trim()) { setDreams([...dreams, dreamDraft.trim()]); setDreamDraft(""); } }}
              className="flex-1 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13.5) }} />
            <button type="button" disabled={!dreamDraft.trim()} onClick={() => { setDreams([...dreams, dreamDraft.trim()]); setDreamDraft(""); }}
              className="rounded-xl px-4 font-semibold disabled:opacity-50" style={{ background: TEAL, color: "#fff", fontSize: fs(13) }}>Add</button>
          </div>
          {dreams.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {dreams.map((d, i) => (
                <span key={`${d}-${i}`} className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1.5" style={{ background: "#E2E9F5", border: "1px solid #C6D4EC", fontSize: fs(12), color: "#2B4A7E", fontWeight: 600 }}>
                  ✈ {d}
                  <button type="button" onClick={() => setDreams(dreams.filter((_, j) => j !== i))} aria-label={`Remove ${d}`}
                    style={{ background: "none", border: 0, color: "#2B4A7E", fontSize: fs(12), padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={save} disabled={saving} className="w-full rounded-[14px] py-3 font-semibold mt-4 disabled:opacity-60" style={{ background: TEAL, color: "#fff", fontSize: fs(14.5) }}>
          {saving ? "Saving…" : "Save profile"}
        </button>

        {/* Visibility */}
        <div className="rounded-[16px] p-4 mt-6" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div style={{ fontFamily: SERIF, fontSize: fs(17), color: INK }}>{share.is_public ? "Your passport is public" : "Your passport is private"}</div>
              <div style={{ fontSize: fs(12), color: INK3, marginTop: 2 }}>
                {share.is_public ? "Anyone with the link can view the booklet — photos only after review, never your locations." : "Only you can see it. Flip to public to share the booklet by link."}
              </div>
            </div>
            <button type="button" onClick={toggleShare} disabled={shareBusy} role="switch" aria-checked={share.is_public} aria-label="Public passport"
              className="relative flex-none rounded-full disabled:opacity-60" style={{ width: 46, height: 26, background: share.is_public ? TEAL : "rgba(22,17,13,.18)", border: 0 }}>
              <span className="absolute top-[3px] rounded-full" style={{ width: 20, height: 20, background: "#fff", left: share.is_public ? 23 : 3, transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
            </button>
          </div>
          {needYear && (
            <div className="flex gap-2 mt-3">
              <input value={yearDraft} onChange={(e) => setYearDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="Year you were born" inputMode="numeric" aria-label="Year you were born"
                className="flex-1 rounded-xl px-3 py-2.5 outline-none" style={{ border: `1px solid ${RULE}`, background: IVORY, fontSize: fs(14) }} />
              <button type="button" onClick={toggleShare} disabled={yearDraft.length !== 4 || shareBusy} className="rounded-xl px-4 font-semibold disabled:opacity-50" style={{ background: TEAL, color: "#fff", fontSize: fs(13) }}>Continue</button>
            </div>
          )}
          {share.is_public && share.url && (
            <button type="button" onClick={copyLink} className="mt-3 w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left" style={{ background: SOFT, border: `1px solid ${RULE}` }}>
              <Copy size={14} color={INK3} />
              <span className="truncate" style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK2 }}>{share.url}</span>
            </button>
          )}
        </div>

        {/* Passport door + luggage */}
        <button type="button" onClick={() => navigate(createPageUrl("Passport"))} className="w-full rounded-[16px] p-4 mt-4 flex items-center justify-between" style={{ background: "#0C2B50", border: "1px solid #D6A64A" }}>
          <span style={{ fontFamily: SERIF, color: "#FFF6EC", fontSize: fs(17) }}>Open my Virtual Passport</span>
          <span aria-hidden style={{ color: "#D6A64A", fontSize: fs(18) }}>🛂</span>
        </button>

        {/* Invites ride the same measured landing → store funnel as shares */}
        <InviteButton />
      </div>
      <PhotoPackets stamps={stamps} title="Photo packets" />
    </div>
  );
}
