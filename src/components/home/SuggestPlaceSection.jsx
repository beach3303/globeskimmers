// SuggestPlaceSection — Home's local favorites zone on the sage stock (Home-Boxes
// L271-357), just above the quote. Locals and people who've been suggest a spot; at
// REVIEW_AT suggestions the founder reviews it, and an approved place becomes a
// Local favorite stamp. Under the button: up to three places near the active
// location that are almost a stamp, each with its like heart and its count toward
// REVIEW_AT. Anyone held from publishing (teen, frozen, the birthday check) may
// like but not suggest, so they get no button — and with nothing nearby either, the
// zone stays away. Nothing shows while it loads.
// It also keeps the thanks screen's promise, "We'll let you know if it becomes a
// stamp": a place you suggested that the founder approved is announced here once,
// until you open it or close the note.
// Also here, shared by everyone's list and the Local favorite page: the Report door
// on a place (ReportPlace), what closes an overlay and keeps Tab inside it
// (useOverlayClose), and one photo full screen (PhotoView, which the admin desk
// uses too).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Heart, MapPinPlus, X } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "@/components/location/LocationContext";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";
import { listSuggestions, toggleLike, isLiked, progressLabel, progressSpoken, progressPct, reasonOf, placeWhere, reportPlace, PLACE_GONE, REPORT_REASONS, REVIEW_AT } from "@/lib/suggestions";
import { HomeZone } from "@/components/redesign/Zone";
import { NEUTRAL, ZONE, fs as zfs, rgba } from "@/components/redesign/constants";
import LocalFavoriteStamp from "@/components/passport/LocalFavoriteStamp";

// The shared parts below (ReportPlace, PhotoView) keep their own palette.
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#0F1419", INK2 = "#3D4550", INK3 = "#5B6470";
const TEAL = "#0E7C73", SAND = "#F7F4EC", IVORY = "#FFFCF7";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const L = ZONE.local;
const HELD_TIERS = new Set(["teen", "blocked", "confirm"]);

// The approved places already announced on this device (ids). Without
// storage the note may show again, which is the honest way to fail.
const TOLD_KEY = "gs_ps_told_v1";
const readTold = () => {
  try { const v = JSON.parse(localStorage.getItem(TOLD_KEY) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); }
};
const markTold = (id) => {
  try { localStorage.setItem(TOLD_KEY, JSON.stringify([...readTold(), id].slice(-200))); } catch { /* shows again next time */ }
};

// A 44px target around a link-sized label.
const linkStyle = { minHeight: 44, margin: "-12px 0", padding: 0, background: "transparent", border: 0, fontSize: zfs(13), fontWeight: 600, lineHeight: 1.2, color: NEUTRAL.pine, cursor: "pointer" };

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

  const canSuggest = !HELD_TIERS.has(socialTier);
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
    <HomeZone zone="local" label="Local favorites" wide={wide}>
      {news && (
        <div role="status" className="flex items-start" style={{ gap: 10, padding: "8px 2px 8px 12px", marginBottom: 12, borderRadius: 14, background: NEUTRAL.cream }}>
          <span aria-hidden="true" className="flex-none" style={{ display: "block", width: 40, marginTop: 4, transform: "rotate(-6deg)" }}>
            <LocalFavoriteStamp name={news.name} city={news.city || null} country={news.country || null} width={40} />
          </span>
          <p className="flex-1 min-w-0" style={{ margin: 0, fontSize: zfs(12.5), lineHeight: 1.3, color: NEUTRAL.ink2 }}>
            <b style={{ fontWeight: 700, color: NEUTRAL.ink }}>Your suggestion is now a stamp.</b>{" "}
            <span style={{ overflowWrap: "anywhere" }}>{news.name}</span> became a Local favorite.{" "}
            <button type="button" onClick={seeNews} style={{ padding: 0, background: "transparent", border: 0, font: "inherit", fontWeight: 600, color: NEUTRAL.tealInk, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>See the stamp</button>
          </p>
          <button type="button" onClick={closeNews} aria-label="Close this note" className="flex-none flex items-center justify-center"
            style={{ width: 44, height: 44, margin: "-8px 0", background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <h3 className="font-serif m-0" style={{ fontWeight: 400, fontSize: zfs(28), lineHeight: 1.15, color: L.title }}>
        Know a spot worth <em style={{ color: L.accent }}>a visit?</em>
      </h3>
      <p style={{ margin: "8px 0 0", fontSize: zfs(14), lineHeight: 1.43, color: L.meta }}>
        When {REVIEW_AT} people suggest the same place, we review it for a Local favorite stamp anyone can collect.
      </p>

      {canSuggest && (
        <div className="flex" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => navigate(createPageUrl("SuggestPlace"))}
            className="inline-flex items-center"
            style={{ gap: 8, minHeight: 48, padding: "0 20px 0 16px", borderRadius: 14, background: NEUTRAL.tealInk, border: 0, color: NEUTRAL.white, fontSize: zfs(15), fontWeight: 600, cursor: "pointer" }}>
            <MapPinPlus size={18} strokeWidth={2} aria-hidden="true" />
            Suggest a place
          </button>
        </div>
      )}

      {items.length > 0 ? (
        <>
          <div className="flex items-center justify-between" style={{ gap: 12, marginTop: 14, minHeight: 20 }}>
            <span style={{ fontSize: zfs(13), fontWeight: 600, lineHeight: 1.5, color: NEUTRAL.ink }}>Almost a stamp near you</span>
            <button type="button" onClick={() => navigate(createPageUrl("Suggestions"))} style={linkStyle}>See all</button>
          </div>
          <div style={{ marginTop: 8, borderRadius: 16, background: NEUTRAL.white, overflow: "hidden" }}>
            {items.map((p, i) => {
              const liked = isLiked(p);
              const why = reasonOf(p.top_reason)?.short;
              const where = placeWhere(p);
              return (
                <div key={p.id} className="flex flex-col justify-center" style={{ minHeight: 56, padding: "7px 12px", borderTop: i ? `1px solid ${L.rowLine}` : 0 }}>
                  <div className="flex items-center justify-between" style={{ gap: 10, minHeight: 24 }}>
                    <span className="min-w-0" style={{ fontSize: zfs(15), fontWeight: 600, lineHeight: 1.25, color: NEUTRAL.ink, overflowWrap: "anywhere" }}>{p.name}</span>
                    <button type="button" onClick={() => like(p)} aria-pressed={liked}
                      aria-label={`Like ${p.name} · ${p.likes || 0} likes`}
                      className="flex-none flex items-center"
                      style={{ minHeight: 44, margin: "-10px 0", padding: 0, background: "transparent", border: 0, cursor: "pointer" }}>
                      {/* Liked: a full heart-red edge and a blush fill, so pressed reads
                          at a glance; the same 1px either way, so the pill never shifts. */}
                      <span className="inline-flex items-center" style={{ gap: 4, minHeight: 24, padding: "0 9px", borderRadius: 999, background: liked ? rgba(NEUTRAL.heart, 0.08) : NEUTRAL.white, border: `1px solid ${liked ? NEUTRAL.heart : L.heartLine}`, fontSize: zfs(12.5), fontWeight: 600, lineHeight: 1, color: NEUTRAL.heart }}>
                        <Heart size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        {p.likes || 0}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between" style={{ gap: 10, minHeight: 18 }}>
                    <span className="min-w-0 truncate" style={{ fontSize: zfs(12.5), lineHeight: 1.3, color: NEUTRAL.ink3 }}>{[where, why].filter(Boolean).join(" · ")}</span>
                    <span role="img" aria-label={progressSpoken(p.count)} className="flex-none flex flex-col items-end" style={{ gap: 3 }}>
                      <span className="font-mono uppercase" style={{ fontSize: zfs(11), lineHeight: 1.1, letterSpacing: ".04em", color: L.accent }}>{progressLabel(p.count)}</span>
                      <span style={{ display: "block", width: 64, height: 3, borderRadius: 99, background: L.track, overflow: "hidden" }}>
                        <span style={{ display: "block", height: 3, borderRadius: 99, background: L.accent, width: progressPct(p.count) }} />
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        // Nothing near the active location yet — everyone's list is still a tap away.
        <div className="flex" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => navigate(createPageUrl("Suggestions"))} style={linkStyle}>
            See everyone&rsquo;s suggestions
          </button>
        </div>
      )}
    </HomeZone>
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
