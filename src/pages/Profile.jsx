// Profile — the traveler's own page (Social P1, founder mockup 2026-09-29):
// who you are before a word is read. v1 is the OWNER's view: avatar initial,
// display name, @handle, home flag, a 140-char bio, traveler chips, the stamp
// stats, three favorite places picked from your own stamps, three dream
// destinations, the public/private dial with the share link, and the luggage.
// Friends' profiles arrive with P2 (follow + the mailbox feed).
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Copy } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { countryCode } from "@/lib/countries";
import { listPassport, getHandle, getSocialProfile, setSocialProfile, getShareLink, setAgeGate, socialFollow } from "@/lib/passport";
import Luggage from "@/components/passport/Luggage";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const TEAL = "#0E7C86", STAMP = "#B0472F", IVORY = "#FFFCF7", SOFT = "#F6F0E4";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const TRAVELER_LABELS = { solo: "Solo traveler", partner: "Travels with a partner", family: "Family traveler", group: "Travels with friends", varies: "Any-way traveler" };

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
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [favorites, setFavorites] = useState([]);   // [{name, country}]
  const [dreams, setDreams] = useState(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState({ is_public: false, url: null });
  const [shareBusy, setShareBusy] = useState(false);
  const [counts, setCounts] = useState({ followers: null, following: null });
  const [needYear, setNeedYear] = useState(false);
  const [yearDraft, setYearDraft] = useState("");

  useEffect(() => {
    let gone = false;
    (async () => {
      const [pp, h, sp, sh, fl] = await Promise.all([listPassport(), getHandle(), getSocialProfile(), getShareLink(), socialFollow("list")]);
      if (gone) return;
      setStamps(pp.stamps); setStats(pp.stats || {});
      setHandle(h.handle);
      const p = sp.profile || {};
      setName(p.display_name || profile?.first_name || "");
      setBio(p.bio || "");
      setFavorites(Array.isArray(p.favorites) ? p.favorites : []);
      const d = Array.isArray(p.dreams) ? p.dreams.map((x) => x.name) : [];
      setDreams([d[0] || "", d[1] || "", d[2] || ""]);
      if (sh.data) setShare({ is_public: !!sh.data.is_public, url: sh.data.url || null });
      if (fl.data) setCounts({ followers: (fl.data.followers || []).length, following: (fl.data.following || []).length });
      setLoading(false);
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Favorite candidates: your stamped places, deduped, best-known first.
  const favoriteChoices = useMemo(() => {
    const seen = new Set();
    return stamps
      .filter((s) => s.kind !== "airport" && s.name)
      .filter((s) => { const k = s.name; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 24);
  }, [stamps]);
  const isFav = (n) => favorites.some((f) => f.name === n);
  const toggleFav = (s) => {
    if (isFav(s.name)) setFavorites(favorites.filter((f) => f.name !== s.name));
    else if (favorites.length < 3) setFavorites([...favorites, { name: s.name, country: s.country || "" }]);
    else showToast("Three favorites — swap one out first", "error");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await setSocialProfile({
      display_name: name, bio,
      favorites,
      dreams: dreams.filter(Boolean).map((n) => ({ name: n })),
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
    if (error === "age_required") { setNeedYear(true); showToast("One thing first — the year you were born", "success"); return; }
    if (error) { showToast(error, "error"); return; }
    setShare({ is_public: !!data.is_public, url: data.url || null });
    showToast(data.is_public ? "Your passport is public — anyone with the link can view it" : "Back to private", "success");
  };

  const copyLink = async () => {
    if (!share.url) return;
    try { await navigator.clipboard.writeText(share.url); showToast("Link copied", "success"); }
    catch { showToast(share.url, "success"); }
  };

  const chips = (profile?.traveler_type || []).map((t) => TRAVELER_LABELS[t]).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: STAMP }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: IVORY }}>
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-none w-16 h-16 rounded-full flex items-center justify-center" style={{ background: STAMP, color: "#FFF6EC", fontFamily: SERIF, fontSize: fs(26) }}>
            {(name || "T").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Your name"
              aria-label="Display name"
              className="w-full bg-transparent outline-none" style={{ fontFamily: SERIF, fontSize: fs(24), color: INK }} />
            <div style={{ fontFamily: MONO, fontSize: fs(11.5), color: INK3, marginTop: 2 }}>
              {handle ? `@${handle}` : (
                <button type="button" onClick={() => navigate(createPageUrl("Settings"))} style={{ background: "none", border: 0, padding: 0, color: TEAL, textDecoration: "underline", textUnderlineOffset: 2, fontFamily: MONO, fontSize: fs(11.5) }}>
                  Claim your @username →
                </button>
              )}
              {profile?.home_country ? `  ·  ${flagFor(profile.home_country)} ${profile.home_country}` : ""}
            </div>
          </div>
        </div>

        {/* Bio + chips */}
        <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 140))} placeholder="One line about the traveler you are…"
          aria-label="Bio" rows={2}
          className="w-full mt-4 rounded-xl px-3 py-2 outline-none resize-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(14), color: INK2 }} />
        {chips.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {chips.map((c) => <span key={c} className="rounded-full px-2.5 py-1" style={{ background: SOFT, border: `1px solid ${RULE}`, fontFamily: MONO, fontSize: fs(10), letterSpacing: ".04em", color: INK2, textTransform: "uppercase" }}>{c}</span>)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[["Stamps", stats.total || stamps.length || 0, "Passport"], ["Countries", stats.countries || 0, "Passport"], ["Followers", counts.followers ?? "—", "Mailbox"], ["Following", counts.following ?? "—", "Mailbox"]].map(([l, v, dest]) => (
            <button key={l} type="button" onClick={() => navigate(createPageUrl(dest))} className="rounded-[14px] py-3 text-center" style={{ background: "#fff", border: `1px solid ${RULE}` }}>
              <div style={{ fontSize: fs(20), fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".12em", color: INK3, textTransform: "uppercase" }}>{l}</div>
            </button>
          ))}
        </div>

        {/* Favorites */}
        <div className="mt-6">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>My favorite places · pick up to 3</div>
          {favoriteChoices.length === 0 ? (
            <p style={{ fontSize: fs(12.5), color: INK3, marginTop: 6 }}>Favorites come from your stamps — collect a few first.</p>
          ) : (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {favoriteChoices.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleFav(s)} className="rounded-full px-3 py-1.5"
                  style={{ background: isFav(s.name) ? STAMP : "#fff", color: isFav(s.name) ? "#fff" : INK2, border: `1px solid ${isFav(s.name) ? STAMP : RULE}`, fontSize: fs(12), fontWeight: 600 }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dreams */}
        <div className="mt-5">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>Dream destinations · up to 3</div>
          <div className="flex flex-col gap-2 mt-2">
            {dreams.map((d, i) => (
              <input key={i} value={d} onChange={(e) => setDreams(dreams.map((x, j) => (j === i ? e.target.value.slice(0, 60) : x)))}
                placeholder={["Santorini…", "Tokyo…", "Machu Picchu…"][i]} aria-label={`Dream destination ${i + 1}`}
                className="w-full rounded-xl px-3 py-2 outline-none" style={{ border: `1px solid ${RULE}`, background: "#fff", fontSize: fs(13.5), color: INK2 }} />
            ))}
          </div>
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
      </div>
      <Luggage stamps={stamps} readOnly={false} />
    </div>
  );
}
