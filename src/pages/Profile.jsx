// Profile: your world, bound in your own cloth (bible.profile; Profile.dc.html). The
// cover band in your cloth with 'MY WORLD' and the pencil, your trunk resting on it, the
// bookplate that says whose world this is, then every part of it filed in its own folder
// on your paper: YOUR CIRCLE (airmail), MY VIRTUAL PASSPORT (navy), ON MY MAP (kraft),
// MY KIT (cream), the privacy card, the invite, and the photo packets.
//
// The page paints at once: the cover, the trunk and the bookplate show before the reads
// land, and each part fills in as its data arrives. Nothing is guessed meanwhile: no
// stats line, no counts, no 'first page is waiting' before the stamps are known.
//
// Editing lives behind the pencil (founder, 2026-10-05: "don't leave the save button on
// display constantly"): the bookplate takes the photo, name, about and website fields,
// ON MY MAP takes its add fields and X chips, the cloth picker previews a new cloth on the
// whole page, and Save / Cancel close the edit (Cancel puts the old cloth back). The cloth
// saves on its own (public.profiles, not a social write), so a 13-17 account edits the
// photo and the cloth; the note explains the rest (the worker refuses their social writes).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { listPassport, getHandle, getSocialProfile, setSocialProfile, getShareLink, setAvatar, luggageGet } from "@/lib/passport";
import { useMyCloth, clothOf } from "@/lib/cloth";
import { usePageGround } from "@/components/redesign/PageGround";
import { Folder } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs, rgba } from "@/components/redesign/constants";
import CoverBand from "@/components/profile/CoverBand";
import Bookplate from "@/components/profile/Bookplate";
import CircleFolder from "@/components/profile/CircleFolder";
import MapFolder from "@/components/profile/MapFolder";
import PrivacyCard from "@/components/profile/PrivacyCard";
import VirtualItems from "@/components/profile/VirtualItems";
import Luggage from "@/components/passport/Luggage";
import PassportFolder from "@/components/passport/PassportFolder";
import PhotoPackets from "@/components/passport/PhotoPackets";
import ContributeAlbum from "@/components/passport/ContributeAlbum";
import BoardPostcards from "@/components/passport/BoardPostcards";
import InviteButton from "@/components/passport/InviteButton";
import TeenHoldNote from "@/components/social/TeenHoldNote";
import { initialOf } from "@/components/social/SocialMarks";
import ClothPicker from "@/components/profile/ClothPicker";
import useCircle from "@/lib/useCircle";

const SHOW_VIRTUAL_ITEMS = true; // the founder's renders landed on R2 2026-10-05 — live

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const COLUMN = "max-w-md md:max-w-2xl mx-auto px-4";
const GAP = 12;

const namesOf = (list) => (Array.isArray(list) ? list.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean) : []);
// The worker keeps a website only with its protocol.
const withProtocol = (w) => { const t = String(w || "").trim(); return !t || /^https?:\/\//i.test(t) ? t : `https://${t}`; };
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// The page's closing invite. While the circle is empty its folder already carries one
// ('Invite someone by text'), so this one waits (the circle read is shared, not repeated).
function FooterInvite({ cloth, style }) {
  const circle = useCircle();
  const c = circle.counts || {};
  const empty = circle.status === "ready" && !c.inner && !c.youFollow && !c.followYou && !(circle.requests || []).length;
  if (empty) return null;
  return <InviteButton color={cloth} size="lg" style={style} />;
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginTop: 12 }}>
      <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), lineHeight: 1.26, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>{label}</span>
      {children}
    </label>
  );
}

// embedded (2026-10-25): inside Home's My Profile tab — it paints its own paper instead of the page's.
export default function ProfilePage({ embedded = false } = {}) {
  const navigate = useNavigate();
  const { profile, socialTier, socialTierReady } = useAuth();
  const mine = useMyCloth();
  const [previewCloth, setPreviewCloth] = useState(null); // the cloth on show while editing
  const cloth = previewCloth ? clothOf(previewCloth) : mine;
  usePageGround(embedded ? null : cloth.paper);
  const teen = socialTier === "teen";

  const [stamps, setStamps] = useState(null);     // null until listPassport lands
  const [albums, setAlbums] = useState("passport"); // the albums dial, for the prints' board marks
  const [stats, setStats] = useState(null);
  const [luggage, setLuggage] = useState(null);
  const [handle, setHandle] = useState({ loaded: false, handle: null, verified: false, seal: null });
  const [social, setSocial] = useState(null);     // the saved social profile, null until read
  const [share, setShare] = useState(null);
  const [avatar, setAvatarUrl] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarRef = useRef(null);

  // The edit drafts (the saved values live in `social`).
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [dreams, setDreams] = useState([]);
  const [saving, setSaving] = useState(false);

  const fallbackName = profile?.first_name || "";
  const applySocial = (p) => {
    const s = {
      name: p?.display_name || "",
      bio: p?.bio || "",
      website: p?.website || "",
      favorites: namesOf(p?.favorites),
      dreams: namesOf(p?.dreams),
    };
    setSocial(s);
    return s;
  };

  useEffect(() => {
    let gone = false;
    listPassport().then((pp) => {
      if (!pp.error) setAlbums(pp.booklet?.albums || "passport");
      if (gone) return;
      setStamps(pp.stamps || []);
      setStats(pp.error ? null : pp.stats || null);
    });
    luggageGet().then((d) => { if (!gone) setLuggage(d); });
    getHandle().then((h) => { if (!gone) setHandle({ loaded: true, handle: h.handle, verified: h.verified === true, seal: h.seal || null }); });
    getSocialProfile().then((sp) => {
      if (gone) return;
      applySocial(sp.profile || {});
      setAvatarUrl(sp.profile?.avatar || null);
    });
    getShareLink().then((sh) => { if (!gone && sh.data) setShare({ is_public: !!sh.data.is_public, url: sh.data.url || null }); });
    return () => { gone = true; };
  }, []);

  const reloadLuggage = () => { luggageGet().then((d) => setLuggage(d)); };
  // New prints from a photo packet show at once.
  const reloadStamps = () => { listPassport().then((pp) => { if (pp.error) return; setStamps(pp.stamps || []); setStats(pp.stats || null); setAlbums(pp.booklet?.albums || "passport"); }); };

  const startEdit = () => {
    const s = social || { name: "", bio: "", website: "", favorites: [], dreams: [] };
    setName(s.name || fallbackName); setBio(s.bio); setWebsite(s.website);
    setFavorites(s.favorites); setDreams(s.dreams);
    setPreviewCloth(null);
    setEdit(true);
  };
  const cancelEdit = () => { setPreviewCloth(null); setEdit(false); };

  const pickAvatar = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setAvatarBusy(true);
    try {
      const { resizePhoto } = await import("@/lib/resizePhoto");
      const img = await resizePhoto(f, 512);
      const { url, error } = await setAvatar(img);
      if (error) showToast(error, "error");
      else { setAvatarUrl(url); showToast("Looking good", "success"); }
    } catch (err) { showToast(err?.message || "Couldn't read that photo", "error"); }
    setAvatarBusy(false);
  };

  const save = async () => {
    if (saving) return;
    const saved = social || { name: "", bio: "", website: "", favorites: [], dreams: [] };
    const site = withProtocol(website);
    const socialChanged = !teen && (
      name.trim() !== (saved.name || "") || bio.trim() !== (saved.bio || "") || site !== (saved.website || "")
      || !sameList(favorites, saved.favorites) || !sameList(dreams, saved.dreams)
    );
    const clothChanged = mine.supported && !!previewCloth && previewCloth !== mine.key;
    if (!socialChanged && !clothChanged) { cancelEdit(); return; }
    setSaving(true);
    let ok = true;
    let siteDropped = false;
    if (socialChanged) {
      // display_name rides every patch: the worker treats a patch without it (or bio,
      // favorites, dreams) as a read.
      const { profile: after, error } = await setSocialProfile({ display_name: name.trim(), bio: bio.trim(), website: site, favorites, dreams });
      if (error) { ok = false; showToast(error, "error"); }
      else {
        const s = applySocial(after || { display_name: name.trim(), bio: bio.trim(), website: site, favorites, dreams });
        siteDropped = !!site && !s.website;
      }
    }
    if (clothChanged) {
      // Saved only when the stored cloth reads back as the one chosen.
      const { ok: clothOk, error } = await mine.save(previewCloth);
      if (!clothOk) {
        ok = false;
        showToast(error === "not_signed_in" ? "Sign in again to save your cloth" : "Your cloth didn’t save. Try again.", "error");
      }
    }
    setSaving(false);
    if (!ok) return; // stay in edit, so a retry sends only what didn't save
    setPreviewCloth(null);
    setEdit(false);
    if (siteDropped) showToast("Saved, but that website address didn’t work", "error");
    else showToast("Profile saved", "success");
  };

  const shown = social || { name: "", bio: "", website: "", favorites: [], dreams: [] };
  const place = [profile?.home_city, profile?.home_country].map((x) => String(x || "").trim()).filter((x, i, a) => x && a.indexOf(x) === i);
  const owner = { name: shown.name || fallbackName, handle: handle.handle, avatar, cloth: cloth.key };
  const fieldStyle = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: "0 12px", minHeight: 44, borderRadius: 12, background: NEUTRAL.white, border: `1px solid ${cloth.fieldLine}`, fontSize: fs(15), color: NEUTRAL.ink, outline: "none" };

  return (
    <div style={{ "--gs-focus": cloth.cloth, ...(embedded ? { background: cloth.paper, paddingBottom: 24 } : {}) }}>
      {/* The 12px mat in the owner's paper, then the cover. */}
      <div aria-hidden="true" style={{ height: 12 }} />
      <CoverBand cloth={cloth.key} kicker="My world" leading="edit" onLeading={edit ? cancelEdit : startEdit}
        leadingLabel={edit ? "Stop editing your world" : "Edit your world"} leadingPressed={edit} contentMaxWidth={672} />

      <div className={COLUMN}>
        <Luggage variant="card" cloth={cloth.key} stamps={stamps} luggage={luggage} onLuggageChanged={reloadLuggage}
          style={{ marginTop: -72 }} />

        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
        <Bookplate
          mode={edit ? "edit" : "own"}
          cloth={cloth.key}
          avatar={avatar}
          name={shown.name || fallbackName}
          handle={handle.handle}
          seal={handle.verified ? handle.seal || true : null}
          place={place}
          stats={stats}
          bio={shown.bio}
          website={shown.website}
          showClaim={handle.loaded && !teen}
          onClaim={() => navigate(createPageUrl("Settings"))}
          onAvatar={() => avatarRef.current?.click()}
          avatarBusy={avatarBusy}
          style={{ marginTop: GAP }}
        >
          {edit ? (teen ? (
            <div style={{ marginTop: 4 }}><TeenHoldNote /></div>
          ) : (
            <>
              <Field label="Your name">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Your name" autoComplete="name"
                  style={{ ...fieldStyle, fontFamily: SERIF, fontSize: fs(20) }} />
              </Field>
              <Field label="About you">
                <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} rows={3}
                  placeholder="Tell the world who’s holding this passport"
                  style={{ ...fieldStyle, padding: "10px 12px", lineHeight: 1.45, resize: "none" }} />
              </Field>
              <Field label="Your website">
                <input value={website} onChange={(e) => setWebsite(e.target.value.slice(0, 120))} placeholder="yoursite.com"
                  inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  style={{ ...fieldStyle, fontFamily: MONO, fontSize: fs(13) }} />
              </Field>
            </>
          )) : null}
        </Bookplate>

        {edit ? (
          <>
            {mine.supported ? (
              <ClothPicker value={cloth.key} onChange={setPreviewCloth} initial={initialOf(name || shown.name || fallbackName, handle.handle)}
                style={{ marginTop: GAP }} />
            ) : null}
            {!teen ? (
              <MapFolder editing favorites={favorites} dreams={dreams} onFavorites={setFavorites} onDreams={setDreams}
                cloth={cloth.key} style={{ marginTop: GAP }} />
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={cancelEdit} disabled={saving}
                style={{ flex: 1, minHeight: 48, borderRadius: 14, background: NEUTRAL.white, border: `1px solid ${rgba(cloth.cloth, 0.35)}`, fontFamily: "inherit", fontSize: fs(15), fontWeight: 600, color: cloth.cloth }}>
                Cancel
              </button>
              <button type="button" onClick={save} aria-busy={saving || undefined}
                style={{ flex: 1, minHeight: 48, borderRadius: 14, background: cloth.cloth, border: 0, fontFamily: "inherit", fontSize: fs(15), fontWeight: 600, color: NEUTRAL.white, opacity: saving ? 0.7 : 1, cursor: saving ? "progress" : "pointer" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : (
          <>
            <CircleFolder owner={owner} cloth={cloth.key} style={{ marginTop: GAP }} />
            {stamps ? (
              <PassportFolder mode="own" cloth={cloth.key} stamps={stamps} onOpenDoor={() => navigate(createPageUrl("Passport"))} style={{ marginTop: GAP }} />
            ) : null}
            {/* Your albums right under your passport (founder, 2026-10-19: the Passport page is the
                book alone; the albums live here). */}
            {stamps ? (
              <div style={{ marginTop: GAP }}>
                <PhotoPackets stamps={stamps} title="Photo albums" owner albums={albums} onChanged={reloadStamps} className=""
                  corner={socialTierReady && !teen ? <div style={{ display: "grid", gap: 14 }}><ContributeAlbum /><BoardPostcards /></div> : null} />
              </div>
            ) : null}
            {!stamps ? (
              <Folder stock="passport" size="profile" tab="My Virtual Passport" style={{ marginTop: GAP }}>
                <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none" style={{ height: 132, borderRadius: 12, background: rgba(ZONE.passport.tile, 0.12) }} />
                <span className="sr-only">Loading your passport</span>
              </Folder>
            ) : null}
            <MapFolder favorites={shown.favorites} dreams={shown.dreams} cloth={cloth.key} style={{ marginTop: GAP }} />
            {SHOW_VIRTUAL_ITEMS && <VirtualItems stamps={stamps} luggage={luggage} style={{ marginTop: GAP }} />}
            <PrivacyCard cloth={cloth.key} share={share} onShare={setShare} style={{ marginTop: GAP }} />
            {socialTierReady && !teen ? <FooterInvite cloth={cloth.key} style={{ marginTop: GAP }} /> : null}
          </>
        )}
      </div>

    </div>
  );
}
