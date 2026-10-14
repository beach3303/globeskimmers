// SuggestPlaceSection — "Suggest a place to stamp" on Home, just above the
// quotes (founder decisions 2026-10-10; mockup screen 1). Locals and people
// who've been suggest a spot; at 5 suggestions the founder reviews it, and an
// approved place becomes a Local favorite stamp. Under the button: up to three
// places near the active location that are almost a stamp, each with its
// like heart and its count toward 5. Teens may like but not suggest
// (suggesting is publishing), so they get no button — and with nothing
// nearby either, the section stays away. Nothing shows while it loads.
// It also keeps the thanks screen's promise, "We'll let you know if it
// becomes a stamp": a place you suggested that the founder approved is
// announced here once, until you open it or close the note.
// Also here, shared by everyone's list and the Local favorite page: the
// Report door on a place (ReportPlace), what closes an overlay and keeps Tab
// inside it (useOverlayClose), and one photo full screen (PhotoView, which
// the admin desk uses too).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Heart, MapPinPlus, Stamp, X } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";
import { listSuggestions, toggleLike, isLiked, progressLabel, progressSpoken, progressPct, reasonOf, placeWhere, reportPlace, PLACE_GONE, REPORT_REASONS, REVIEW_AT } from "@/lib/suggestions";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#0F1419", INK2 = "#3D4550", INK3 = "#5B6470";
const TEAL = "#0E7C73", TEAL_DARK = "#0A5F58", TEAL_SOFT = "#E8F4F2", SAND = "#F7F4EC", TRACK = "#E6E1D6", IVORY = "#FFFCF7";
const HEART = "#B4233C", HEART_BG = "#FDECEF";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

// The approved places already announced on this device (ids). Without
// storage the note may show again, which is the honest way to fail.
const TOLD_KEY = "gs_ps_told_v1";
const readTold = () => {
  try { const v = JSON.parse(localStorage.getItem(TOLD_KEY) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); }
};
const markTold = (id) => {
  try { localStorage.setItem(TOLD_KEY, JSON.stringify([...readTold(), id].slice(-200))); } catch { /* shows again next time */ }
};

// wide: the iPad Home, where the section fills the column and the places sit three across.
export default function SuggestPlaceSection({ wide = false }) {
  const navigate = useNavigate();
  const { socialTier, refreshSocialTier } = useAuth();
  const { getActiveLocation } = useLocation();
  const [items, setItems] = useState(null);   // null = loading
  const [news, setNews] = useState(null);     // a place I suggested that became a Local favorite, not yet announced
  const liking = useRef(new Set());           // place ids with a like on the wire

  useEffect(() => {
    let gone = false;
    const loc = getActiveLocation?.();
    const lat = loc?.coordinates?.latitude, lng = loc?.coordinates?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setItems([]); return undefined; }
    (async () => {
      const { places } = await listSuggestions({ lat, lng, sort: "near", limit: 12 });
      if (gone) return;
      // "Almost a stamp": still collecting, or waiting for review — never an
      // approved place, which is a stamp already.
      setItems(places.filter((p) => p.status === "open" || p.status === "review").slice(0, 3));
    })();
    return () => { gone = true; };
  }, [getActiveLocation]);

  // My own suggestions, for the "it became a stamp" note. Only an adult can
  // have any (suggesting needs a birthday; teens are held), so nobody else
  // asks — and the tier loading in (null → adult) doesn't ask twice.
  useEffect(() => {
    if (socialTier !== "adult") return undefined;
    let gone = false;
    (async () => {
      const { places } = await listSuggestions({ sort: "mine", limit: 20 });
      if (gone) return;
      const told = readTold();
      setNews(places.find((p) => p.status === "approved" && !told.has(p.id)) || null);
    })();
    return () => { gone = true; };
  }, [socialTier]);

  const canSuggest = socialTier !== "teen";
  if (items === null || (!items.length && !canSuggest)) return null;

  const seeNews = () => { markTold(news.id); navigate(`${createPageUrl("LocalFavorite")}?id=${encodeURIComponent(news.id)}`); };
  const closeNews = () => { markTold(news.id); setNews(null); };

  const like = async (p) => {
    if (liking.current.has(p.id)) return;
    liking.current.add(p.id);
    const res = await toggleLike(p, "", (fn) => setItems((list) => (list || []).map((x) => (x.id === p.id ? fn(x) : x))));
    liking.current.delete(p.id);
    if (res.error) {
      if (res.code === "under_age") refreshSocialTier();
      showToast(res.error, "error");
    }
  };

  return (
    <div className={wide ? "mt-9" : "px-4 pt-1 pb-5"}>
      <section aria-labelledby="gs-suggest-h" className={`${wide ? "w-full" : "max-w-md mx-auto"} flex flex-col`}
        style={{ background: "#FFFFFF", border: "1px solid rgba(15,20,25,.08)", borderRadius: 22, padding: "20px 18px 16px", gap: 14, color: INK,
          boxShadow: "0 1px 0 rgba(15,20,25,.04), 0 8px 24px -12px rgba(15,20,25,.10)" }}>
        {news && (
          <div role="status" className="flex items-start" style={{ gap: 10, padding: "12px 6px 12px 14px", borderRadius: 14, background: TEAL_SOFT, color: TEAL_DARK }}>
            <Stamp size={20} strokeWidth={2} className="flex-none" style={{ marginTop: 1 }} aria-hidden="true" />
            <div className="flex-1 min-w-0 flex flex-col items-start" style={{ gap: 4, fontSize: fs(13.5), lineHeight: 1.4 }}>
              <div><b>Your suggestion is now a stamp.</b> <span style={{ overflowWrap: "anywhere" }}>{news.name}</span> became a Local favorite.</div>
              <button type="button" onClick={seeNews} className="font-semibold"
                style={{ color: TEAL_DARK, background: "none", border: "none", padding: 0, textDecoration: "underline", fontSize: fs(13.5) }}>See the stamp</button>
            </div>
            <button type="button" onClick={closeNews} aria-label="Close this note" className="flex-none flex items-center justify-center"
              style={{ width: 36, height: 36, marginTop: -8, color: TEAL_DARK, background: "none", border: "none" }}>
              <X size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex flex-col" style={{ gap: 6 }}>
          <div className="uppercase" style={{ fontSize: fs(11.5), fontWeight: 700, letterSpacing: ".12em", color: TEAL }}>Suggest a place to stamp</div>
          <h2 id="gs-suggest-h" style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(31), lineHeight: 1.05 }}>
            Know a spot worth <i>a visit?</i>
          </h2>
          <p style={{ margin: 0, fontSize: fs(14.5), lineHeight: 1.45, color: INK2 }}>
            Locals and people who&rsquo;ve been can suggest a place. When {REVIEW_AT} people suggest the same one, we review it. Approved places become a <b>Local favorite</b> stamp everyone can collect.
          </p>
        </div>

        {canSuggest && (
          <button type="button" onClick={() => navigate(createPageUrl("SuggestPlace"))}
            className="flex items-center justify-center gap-2 font-semibold"
            style={{ minHeight: 48, borderRadius: 14, background: TEAL, color: "#FFFFFF", fontSize: fs(16), border: "none" }}>
            <MapPinPlus size={18} strokeWidth={2} aria-hidden="true" />
            Suggest a place
          </button>
        )}

        {items.length > 0 ? (
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div className="flex justify-between items-baseline gap-3">
              <div style={{ fontSize: fs(13), fontWeight: 600 }}>Almost a stamp near you</div>
              <button type="button" onClick={() => navigate(createPageUrl("Suggestions"))}
                style={{ fontSize: fs(13), fontWeight: 600, color: TEAL, background: "none", border: "none", padding: 0 }}>See all</button>
            </div>
            <div className={wide ? "grid grid-cols-3" : "flex flex-col"} style={{ gap: 10 }}>
              {items.map((p) => {
                const liked = isLiked(p);
                const why = reasonOf(p.top_reason)?.short;
                const where = placeWhere(p);
                return (
                  <div key={p.id} className="flex flex-col" style={{ gap: 7, padding: 12, borderRadius: 14, background: SAND }}>
                    <div className="flex justify-between items-start" style={{ gap: 10 }}>
                      <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                        <div style={{ fontWeight: 600, fontSize: fs(15), overflowWrap: "anywhere" }}>{p.name}</div>
                        {(where || why) && <div style={{ fontSize: fs(12.5), color: INK3 }}>{[where, why].filter(Boolean).join(" · ")}</div>}
                      </div>
                      {/* Liked: a full heart-red edge, so pressed reads at a glance;
                          the same 1.5px either way, so the pill never shifts (2026-10-12). */}
                      <button type="button" onClick={() => like(p)} aria-pressed={liked}
                        aria-label={`Like ${p.name} · ${p.likes || 0} likes`}
                        className="flex-none flex items-center font-semibold"
                        style={{ gap: 5, height: 32, padding: "0 10px", borderRadius: 999, fontSize: fs(13), color: HEART,
                          border: `1.5px solid ${liked ? HEART : "rgba(15,20,25,.12)"}`, background: liked ? HEART_BG : "#FFFFFF" }}>
                        <Heart size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        {p.likes || 0}
                      </button>
                    </div>
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <div role="img" aria-label={progressSpoken(p.count)} className="flex-1 overflow-hidden" style={{ height: 6, borderRadius: 99, background: TRACK }}>
                        <div style={{ height: 6, borderRadius: 99, background: TEAL, width: progressPct(p.count) }} />
                      </div>
                      <div className="flex-none" style={{ fontSize: fs(12.5), fontWeight: 600, color: TEAL }}>{progressLabel(p.count)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Nothing near the active location yet — everyone's list is still a tap away.
          <button type="button" onClick={() => navigate(createPageUrl("Suggestions"))}
            style={{ alignSelf: "center", fontSize: fs(13), fontWeight: 600, color: TEAL, background: "none", border: "none", padding: "2px 0" }}>
            See everyone&rsquo;s suggestions
          </button>
        )}
      </section>
    </div>
  );
}

// What Tab can land on inside an overlay — the same list as the pin map's
// in SuggestPlace.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// What closes an overlay while it's open (2026-10-12): a swipe down (the
// dismiss stack), Escape, and Android's back key, which would otherwise leave
// the page under it. Capacitor turns the key's own behavior off only while a
// listener is registered, so it is added on open and removed on close.
// panelRef (2026-10-12): Tab and Shift+Tab go round inside that element, as
// in the pin map, and never reach the page hidden under it. Focus on the
// panel itself counts as before the first.
export function useOverlayClose(open, onClose, panelRef = null) {
  useDismissable(open, onClose);
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { ref.current?.(); return; }
      const box = panelRef?.current;
      if (e.key !== "Tab" || !box) return;
      const els = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      const at = els.indexOf(document.activeElement);
      if (!els.length || (e.shiftKey ? at <= 0 : at === -1 || at === els.length - 1)) {
        e.preventDefault();
        if (els.length) (e.shiftKey ? els[els.length - 1] : els[0]).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    let handle = null, gone = false;
    if (Capacitor.getPlatform() === "android") {
      Promise.resolve(App.addListener("backButton", () => ref.current?.()))
        .then((h) => { if (gone) h?.remove?.(); else handle = h; })
        .catch(() => { /* the key keeps its own behavior */ });
    }
    return () => { gone = true; document.removeEventListener("keydown", onKey); handle?.remove?.(); };
  }, [open]);
}

// ReportPlace — the quiet Report door on a suggested place (2026-10-12):
// anything people post must be reportable. A small text button opens a sheet
// of reasons; one tap sends it. Teens may report too — a safety door, not
// publishing. One report per person per place; three hide an open place
// until the founder decides (admin desk, Reported).
export function ReportPlace({ place, label = "Report", className = "", style = {} }) {
  const { refreshSocialTier } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const opener = useRef(null);
  const panel = useRef(null);
  const close = () => setOpen(false);
  useOverlayClose(open, close, panel);
  // Focus moves into the sheet, and back to the button when it closes.
  useEffect(() => {
    if (!open) return undefined;
    panel.current?.focus({ preventScroll: true });
    const from = opener.current;
    return () => { from?.focus?.({ preventScroll: true }); };
  }, [open]);

  const send = async (reason) => {
    if (busy.current) return;
    busy.current = true; setSending(true);
    const res = await reportPlace(place.id, reason);
    busy.current = false; setSending(false);
    setOpen(false);
    if (res.error) {
      if (res.code === "under_age") refreshSocialTier();
      showToast(res.notFound ? PLACE_GONE : res.error, "error");
      return;
    }
    showToast(res.already ? "You’ve already reported this place." : "Thanks — we’ll take a look.", res.already ? "info" : "success");
  };

  const titleId = `gs-report-h-${place.id}`;
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        aria-label={label === "Report" ? `Report ${place.name}` : undefined} className={`flex-none font-semibold ${className}`}
        style={{ minHeight: 40, padding: "0 6px", background: "none", border: "none", color: INK3, fontSize: fs(13), ...style }}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center" onClick={close} style={{ background: "rgba(15,20,25,.45)" }}>
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={sending}
            onClick={(e) => e.stopPropagation()} className="w-full max-w-md flex flex-col"
            style={{ gap: 8, padding: "20px 18px calc(18px + env(safe-area-inset-bottom))", borderRadius: "22px 22px 0 0", background: IVORY, color: INK, outline: "none",
              maxHeight: "calc(100% - 16px - env(safe-area-inset-top))", overflowY: "auto" }}>
            <h2 id={titleId} style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: fs(24), lineHeight: 1.15 }}>Report this place?</h2>
            <p style={{ margin: "0 0 6px", fontSize: fs(13.5), lineHeight: 1.4, color: INK2, overflowWrap: "anywhere" }}>{place.name}</p>
            {REPORT_REASONS.map((r) => (
              <button key={r.key} type="button" disabled={sending} onClick={() => send(r.key)} className="font-semibold text-left"
                style={{ minHeight: 44, padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(15,20,25,.14)", background: "#FFFFFF", color: INK, fontSize: fs(14.5), opacity: sending ? 0.6 : 1 }}>
                {r.label}
              </button>
            ))}
            <button type="button" onClick={close} className="font-semibold"
              style={{ minHeight: 44, marginTop: 2, borderRadius: 12, border: "none", background: SAND, color: INK2, fontSize: fs(14.5) }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// PhotoView — one photo, full screen: the Local favorite page's photos and
// the admin desk's (2026-10-12). A tap, a swipe down, Escape or Android's back
// key closes it (the back key used to leave the page under it). For a
// keyboard it's a dialog too: focus moves to Close and Tab stays inside, and
// on close focus goes back to what opened it, if that's still on the page.
export function PhotoView({ src, alt = "A photo of the place", onClose }) {
  const panel = useRef(null);
  const closeBtn = useRef(null);
  useOverlayClose(true, onClose, panel);
  useEffect(() => {
    const from = document.activeElement;
    closeBtn.current?.focus({ preventScroll: true });
    return () => { if (from instanceof HTMLElement && from.isConnected) from.focus({ preventScroll: true }); };
  }, []);
  return (
    <div ref={panel} className="fixed inset-0 z-[9998] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Photo"
      onClick={onClose} style={{ background: "rgba(15,20,25,.92)" }}>
      <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
      <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close" className="absolute flex items-center justify-center"
        style={{ top: "calc(14px + env(safe-area-inset-top))", right: "calc(14px + env(safe-area-inset-right))", width: 44, height: 44, borderRadius: 999, background: "rgba(255,255,255,.16)", color: "#FFFFFF", border: "none" }}>
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
