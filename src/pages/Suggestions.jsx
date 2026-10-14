// Suggestions — everyone's suggested places (founder decisions 2026-10-10;
// mockup screen 4). Every suggestion shows with its count ("3 of 5"); at 5 a
// place is in review, and the count keeps going. Near you / Most liked /
// Newest. Likes have no limit — one heart per person per place, a toggle,
// and the totals are for bragging. "I recommend it too" adds your suggestion
// to that place (not for teens: suggesting is publishing). An approved place
// is a Local favorite and opens its own page. Every card has a quiet Report
// (2026-10-12) — anyone, teens too, can report a place.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { showToast } from "@/components/Toast";
import { ReportPlace } from "@/components/home/SuggestPlaceSection";
import { listSuggestions, toggleLike, isLiked, placeWhere, REVIEW_AT } from "@/lib/suggestions";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#0F1419", INK2 = "#3D4550", INK3 = "#5B6470";
const TEAL = "#0E7C73", IVORY = "#FFFCF7", SAND = "#F7F4EC";
const EDGE = "rgba(15,20,25,.14)", LINE = "rgba(15,20,25,.08)";
const HEART = "#B4233C", HEART_BG = "#FDECEF";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const TABS = [["near", "Near you"], ["liked", "Most liked"], ["new", "Newest"]];
// The status chip: collecting (ivory), in review (amber), a stamp (teal).
const chipFor = (p) => (p.status === "approved" ? { text: "Local favorite", background: "#E8F4F2", color: "#0A5F58" }
  : p.status === "review" || p.count >= REVIEW_AT ? { text: "In review", background: "#FFF3DC", color: "#8A5A00" }
  : { text: `${p.count} of ${REVIEW_AT}`, background: SAND, color: INK2 });

export default function SuggestionsPage() {
  const navigate = useNavigate();
  const { socialTier, refreshSocialTier } = useAuth();
  const { activeLocation } = useLocation();
  const lat = activeLocation?.coordinates?.latitude, lng = activeLocation?.coordinates?.longitude;
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const [sort, setSort] = useState("near");
  // A failed load says so (with Try again) — never a false "No suggestions yet".
  const [st, setSt] = useState({ places: [], loaded: false, error: null });
  const seq = useRef(0);
  const liking = useRef(new Set());

  const load = async () => {
    const my = ++seq.current;
    if (sort === "near" && !hasPoint) { setSt({ places: [], loaded: true, error: null }); return; }
    const { places, error, code } = await listSuggestions({ lat, lng, sort, limit: 50 });
    if (my !== seq.current) return; // another tab (or a moved location) owns the screen
    if (code === "under_age") refreshSocialTier();
    setSt(error ? { places: [], loaded: true, error } : { places, loaded: true, error: null });
  };
  useEffect(() => { load(); }, [sort, lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const showTab = (k) => {
    if (k === sort) return;
    setSt({ places: [], loaded: false, error: null });
    setSort(k);
  };
  const like = async (p) => {
    if (liking.current.has(p.id)) return;
    liking.current.add(p.id);
    const res = await toggleLike(p, "", (fn) => setSt((s) => ({ ...s, places: s.places.map((x) => (x.id === p.id ? fn(x) : x)) })));
    liking.current.delete(p.id);
    if (res.error) {
      if (res.code === "under_age") refreshSocialTier();
      showToast(res.error, "error");
    }
  };
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(createPageUrl("Home")));
  const canSuggest = socialTier !== "teen";
  const recommend = (p) => navigate(`${createPageUrl("SuggestPlace")}?id=${encodeURIComponent(p.id)}`);
  const openFavorite = (p) => navigate(`${createPageUrl("LocalFavorite")}?id=${encodeURIComponent(p.id)}`);

  return (
    <div className="min-h-screen pb-28" style={{ background: IVORY, color: INK }}>
      <div className="max-w-md md:max-w-2xl mx-auto px-4">
        <div className="flex items-center gap-2 pt-3 pb-1" style={{ marginLeft: -10 }}>
          <button type="button" onClick={back} aria-label="Back" className="flex-none flex items-center justify-center"
            style={{ width: 44, height: 44, color: INK, background: "none", border: "none" }}>
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(28), lineHeight: 1.1 }}>Suggested places</h1>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: fs(13.5), lineHeight: 1.4, color: INK2 }}>
          Suggested by locals and people who&rsquo;ve been. At {REVIEW_AT} suggestions we review a place for a stamp, and the count keeps going.
        </p>

        <div role="tablist" aria-label="Sort" className="flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(([k, text]) => (
            <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => showTab(k)}
              className="flex-none font-semibold whitespace-nowrap"
              style={{ minHeight: 36, padding: "0 14px", borderRadius: 999, fontSize: fs(13.5),
                border: sort === k ? "1px solid #0F1419" : `1px solid ${EDGE}`, background: sort === k ? "#0F1419" : "#FFFFFF", color: sort === k ? "#FFFFFF" : INK }}>
              {text}
            </button>
          ))}
        </div>

        {!st.loaded ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: TEAL }} aria-label="Loading" /></div>
        ) : st.error ? (
          <div className="rounded-[16px] p-5 text-center" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
            <p style={{ fontSize: fs(14), color: INK2 }}>Couldn&rsquo;t load the suggestions just now.</p>
            <button type="button" onClick={() => { setSt({ places: [], loaded: false, error: null }); load(); }} className="mt-3 font-semibold"
              style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${EDGE}`, background: "#FFFFFF", color: INK, fontSize: fs(14) }}>Try again</button>
          </div>
        ) : st.places.length === 0 ? (
          <div className="rounded-[16px] p-5 text-center" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: SERIF, fontSize: fs(20), color: INK, lineHeight: 1.2 }}>
              {sort === "near" && !hasPoint ? "Where are you?" : sort === "near" ? "No suggestions near you yet" : "No suggestions yet"}
            </p>
            <p style={{ fontSize: fs(13), color: INK2, lineHeight: 1.45, marginTop: 6 }}>
              {sort === "near" && !hasPoint ? "Set your location on Home to see the places suggested around you."
                : canSuggest ? "Know a spot worth a visit? Be the first to suggest it." : "When someone suggests a place, it shows up here."}
            </p>
            {canSuggest && (
              <button type="button" onClick={() => navigate(createPageUrl("SuggestPlace"))} className="mt-3 font-semibold"
                style={{ minHeight: 44, padding: "0 18px", borderRadius: 14, border: "none", background: TEAL, color: "#FFFFFF", fontSize: fs(15) }}>Suggest a place</button>
            )}
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 10 }}>
            {st.places.map((p) => {
              const chip = chipFor(p);
              const liked = isLiked(p);
              const approved = p.status === "approved";
              const where = placeWhere(p);
              const head = (
                <>
                  <div className="flex flex-col min-w-0" style={{ gap: 3 }}>
                    <h2 style={{ margin: 0, fontSize: fs(16), fontWeight: 600, color: INK, overflowWrap: "anywhere" }}>{p.name}</h2>
                    <div style={{ fontSize: fs(12.5), color: INK3 }}>{[where, `suggested by ${p.count}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex-none flex items-center gap-1">
                    <span style={{ padding: "4px 9px", borderRadius: 999, fontSize: fs(12), fontWeight: 700, background: chip.background, color: chip.color }}>{chip.text}</span>
                    {approved && <ChevronRight size={16} color={INK3} aria-hidden="true" />}
                  </div>
                </>
              );
              return (
                <article key={p.id} className="flex flex-col" style={{ gap: 10, padding: 14, borderRadius: 16, background: "#FFFFFF", border: `1px solid ${LINE}` }}>
                  {approved ? (
                    <button type="button" onClick={() => openFavorite(p)} aria-label={`Open the Local favorite ${p.name}`}
                      className="flex justify-between items-start text-left w-full" style={{ gap: 10, background: "none", border: "none", padding: 0 }}>{head}</button>
                  ) : (
                    <div className="flex justify-between items-start" style={{ gap: 10 }}>{head}</div>
                  )}
                  {p.reasons?.length > 0 && (
                    <div className="flex flex-wrap" style={{ gap: 6 }}>
                      {p.reasons.map((r) => (
                        <span key={r.key} style={{ padding: "5px 9px", borderRadius: 999, background: SAND, fontSize: fs(12.5), color: INK2 }}>{r.short} · {r.n}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {/* Liked: a full heart-red edge, 1.5px either way so nothing shifts (2026-10-12). */}
                    <button type="button" onClick={() => like(p)} aria-pressed={liked}
                      aria-label={`Like ${p.name} · ${p.likes || 0} likes`}
                      className="flex-none flex items-center gap-1.5 font-semibold"
                      style={{ minHeight: 40, padding: "0 14px", borderRadius: 12, fontSize: fs(14), color: HEART,
                        border: `1.5px solid ${liked ? HEART : EDGE}`, background: liked ? HEART_BG : "#FFFFFF" }}>
                      <Heart size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                      {p.likes || 0}
                    </button>
                    {canSuggest && (
                      <button type="button" onClick={() => recommend(p)} className="flex-1 flex items-center justify-center font-semibold"
                        style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${EDGE}`, background: "#FFFFFF", color: INK, fontSize: fs(14) }}>
                        {p.my?.suggested ? "✓ You recommend it" : "I recommend it too"}
                      </button>
                    )}
                    <ReportPlace place={p} className="ml-auto" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
