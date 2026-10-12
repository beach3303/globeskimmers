// LocalFavorite — an approved suggestion's own page (founder decisions
// 2026-10-10; mockup screen 5). Its Local favorite stamp — the distinct style,
// never the official icon art — always discloses how many people who've been
// there recommended it. Likes ("N people love this") and an "I agree" heart on
// each reason have no limit; the "Other" reasons are quoted under Other. The
// stamp itself is earned like any attraction stamp: only at the place, by GPS
// (StampHereButton with the lf:<id> entity; the worker checks it against the
// place's own pin and marks it a Local favorite). A quiet Report sits at the
// bottom, approved or not yet (2026-10-12).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { ChevronLeft, Heart, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import LocalFavoriteStamp from "@/components/passport/LocalFavoriteStamp";
import { StampHereButton } from "@/components/attraction/AttractionExtras";
import { PhotoView, ReportPlace } from "@/components/home/SuggestPlaceSection";
import { getSuggestion, toggleLike, isLiked, REVIEW_AT } from "@/lib/suggestions";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#0F1419", INK2 = "#3D4550", INK3 = "#5B6470";
const TEAL = "#0E7C73", IVORY = "#FFFCF7", TRACK = "#EFEBE2";
const EDGE = "rgba(15,20,25,.14)", LINE = "rgba(15,20,25,.08)";
const HEART = "#B4233C", HEART_BG = "#FDECEF";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;
const loveLine = (n) => (n === 0 ? "Love this place" : n === 1 ? "1 person loves this" : `${n} people love this`);
// "Grand Park Fountain" → ["Grand Park", "Fountain"]: the serif title's last
// word in italics, as in the mockup.
const titleParts = (name) => {
  const w = String(name || "").trim().split(/\s+/);
  return w.length < 2 ? [String(name || ""), null] : [w.slice(0, -1).join(" "), w[w.length - 1]];
};

export default function LocalFavoritePage() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const id = new URLSearchParams(routerLocation.search).get("id");
  const { socialTier, refreshSocialTier } = useAuth();
  const [st, setSt] = useState({ place: null, loaded: false, error: null, notFound: false });
  const [photo, setPhoto] = useState(null);
  const liking = useRef(new Set());

  useEffect(() => {
    let gone = false;
    setSt({ place: null, loaded: false, error: null, notFound: false });
    if (!id) { setSt({ place: null, loaded: true, error: null, notFound: true }); return undefined; }
    (async () => {
      const { place, error, code, notFound } = await getSuggestion(id);
      if (gone) return;
      if (code === "under_age") refreshSocialTier();
      setSt({ place, loaded: true, error: place ? null : error, notFound });
    })();
    return () => { gone = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(createPageUrl("Suggestions")));
  const like = async (reason) => {
    const p = st.place;
    if (!p) return;
    const k = `${p.id}:${reason}`;
    if (liking.current.has(k)) return;
    liking.current.add(k);
    const res = await toggleLike(p, reason, (fn) => setSt((s) => (s.place ? { ...s, place: fn(s.place) } : s)));
    liking.current.delete(k);
    if (res.error) {
      if (res.code === "under_age") refreshSocialTier();
      showToast(res.error, "error");
    }
  };

  const shell = (children) => (
    <div className="min-h-screen pb-28" style={{ background: IVORY, color: INK }}>
      <div className="max-w-md md:max-w-2xl mx-auto px-4">
        <div className="pt-3" style={{ marginLeft: -10 }}>
          <button type="button" onClick={back} aria-label="Back" className="flex items-center justify-center"
            style={{ width: 44, height: 44, color: INK, background: "none", border: "none" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
  const quiet = (title, text) => shell(
    <div className="rounded-[16px] p-5 mt-2 text-center" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
      <p style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.2 }}>{title}</p>
      {text && <p style={{ fontSize: fs(13.5), color: INK2, lineHeight: 1.45, marginTop: 6 }}>{text}</p>}
      <div className="flex flex-col gap-2 mt-4">
        {st.place && socialTier !== "teen" && (
          <button type="button" onClick={() => navigate(`${createPageUrl("SuggestPlace")}?id=${encodeURIComponent(st.place.id)}`)} className="font-semibold"
            style={{ minHeight: 46, borderRadius: 14, border: "none", background: TEAL, color: "#FFFFFF", fontSize: fs(15) }}>
            {st.place.my?.suggested ? "Update my suggestion" : "I recommend it too"}
          </button>
        )}
        <button type="button" onClick={() => navigate(createPageUrl("Suggestions"))} className="font-semibold"
          style={{ minHeight: 44, borderRadius: 14, border: "none", background: "none", color: TEAL, fontSize: fs(15) }}>See everyone&rsquo;s suggestions</button>
        {st.place && <ReportPlace place={st.place} label="Report this place" className="self-center" />}
      </div>
    </div>
  );

  if (!st.loaded) {
    return shell(<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: TEAL }} aria-label="Loading" /></div>);
  }
  if (!st.place) {
    return st.notFound ? quiet("This place isn’t here anymore", "It may have been taken off the list.")
      : quiet("Couldn’t load this place", st.error || "Try again in a moment.");
  }
  const p = st.place;
  // Not approved (yet): where it stands, and a way to add to it.
  if (p.status !== "approved") {
    return quiet(p.name, p.count >= REVIEW_AT
      ? `Not a Local favorite yet — ${p.count} suggestions, and it’s in review.`
      : `Not a Local favorite yet — ${p.count} of ${REVIEW_AT} suggestions. When ${REVIEW_AT} people suggest it, we review it.`);
  }

  const [head, last] = titleParts(p.name);
  const liked = isLiked(p);
  const totals = (p.reasons || []).map((r) => (r.n || 0) + (r.likes || 0));
  const max = Math.max(1, ...totals);
  const others = Array.isArray(p.other_texts) ? p.other_texts.filter(Boolean) : [];
  const photos = Array.isArray(p.photos) ? p.photos.filter(Boolean) : [];
  const address = [p.city, p.region, p.country].filter(Boolean).join(", ");

  return shell(
    <div className="flex flex-col" style={{ gap: 18, paddingBottom: 8 }}>
      {/* One photo full screen: a tap, a swipe down, Escape or Android's back
          key closes it; focus goes to its Close and back to the photo after. */}
      {photo && <PhotoView src={photo} onClose={() => setPhoto(null)} />}
      <div className="self-center">
        <LocalFavoriteStamp name={p.name} city={p.city} country={p.country} width={210} />
      </div>

      <div className="flex flex-col text-center" style={{ gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(32), lineHeight: 1.05, overflowWrap: "anywhere" }}>
          {head}{last && <> <i>{last}</i></>}
        </h1>
        <p style={{ margin: 0, fontSize: fs(14), lineHeight: 1.45, color: INK2 }}>
          A Local favorite: recommended by <b>{people(p.count || 0)} who&rsquo;ve been there</b>, and approved by GlobeSkimmers.
        </p>
      </div>

      <div className="flex justify-center">
        {/* Liked: a full heart-red edge, 1.5px either way so nothing shifts (2026-10-12). */}
        <button type="button" onClick={() => like("")} aria-pressed={liked} className="flex items-center gap-2 font-semibold"
          style={{ minHeight: 46, padding: "0 18px", borderRadius: 999, fontSize: fs(15), color: HEART,
            border: `1.5px solid ${liked ? HEART : EDGE}`, background: liked ? HEART_BG : "#FFFFFF" }}>
          <Heart size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          {loveLine(p.likes || 0)}
        </button>
      </div>

      {(p.reasons || []).length > 0 && (
        <section aria-labelledby="gs-lf-why" className="flex flex-col" style={{ gap: 10, padding: 16, borderRadius: 16, background: "#FFFFFF", border: `1px solid ${LINE}` }}>
          <h2 id="gs-lf-why" style={{ margin: 0, fontSize: fs(14), fontWeight: 700 }}>Why people recommend it</h2>
          {p.reasons.map((r, i) => {
            const on = isLiked(p, r.key);
            const text = r.key === "other" ? "Other" : r.label;
            return (
              <div key={r.key} className="flex flex-col" style={{ gap: 6 }}>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <div className="flex-1 flex flex-col min-w-0" style={{ gap: 5 }}>
                    <div className="flex justify-between gap-2" style={{ fontSize: fs(13.5) }}>
                      <span>{text}</span><span className="flex-none" style={{ color: INK3 }}>{totals[i]}</span>
                    </div>
                    <div className="overflow-hidden" style={{ height: 6, borderRadius: 99, background: TRACK }}>
                      <div style={{ height: 6, borderRadius: 99, background: TEAL, width: `${Math.round((totals[i] / max) * 100)}%` }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => like(r.key)} aria-pressed={on} aria-label={`I agree: ${text}`}
                    className="flex-none flex items-center justify-center"
                    style={{ width: 44, height: 44, borderRadius: 12, color: HEART, border: `1.5px solid ${on ? HEART : EDGE}`, background: on ? HEART_BG : "#FFFFFF" }}>
                    <Heart size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  </button>
                </div>
                {r.key === "other" && others.length > 0 && (
                  <ul className="flex flex-col" style={{ gap: 4, margin: 0, padding: 0, listStyle: "none" }}>
                    {others.map((t, j) => (
                      <li key={j} style={{ fontSize: fs(13), fontStyle: "italic", color: INK2, lineHeight: 1.4 }}>&ldquo;{t}&rdquo;</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      {photos.length > 0 && (
        <section aria-labelledby="gs-lf-photos" className="flex flex-col" style={{ gap: 8 }}>
          <h2 id="gs-lf-photos" style={{ margin: 0, fontSize: fs(14), fontWeight: 700 }}>Photos from people who suggested it</h2>
          <div className="grid grid-cols-3" style={{ gap: 6 }}>
            {photos.map((src) => (
              <button key={src} type="button" onClick={() => setPhoto(src)} aria-label="Open the photo" className="overflow-hidden"
                style={{ aspectRatio: "1 / 1", borderRadius: 12, border: "none", padding: 0, background: TRACK }}>
                <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The stamp: earned only at the place, by GPS, like any attraction. */}
      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <StampHereButton localFavorite
          a={{ placeId: `lf:${p.id}`, name: p.name, lat: p.lat, lng: p.lng, formattedAddress: address }}
          link={{ stamp: { id: `lf:${p.id}`, name: p.name, lat: p.lat, lng: p.lng, city: p.city, country: p.country, category: "local_favorite", footprint_radius_m: 150 }, gid: null }} />
      </div>
      <div className="flex justify-center">
        <ReportPlace place={p} label="Report this place" />
      </div>
    </div>
  );
}
