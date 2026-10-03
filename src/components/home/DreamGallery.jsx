// DreamGallery — the full-screen "dream browser": a photo-immersion sheet that
// opens from dream surfaces (DreamShelf, DreamAnswerCard) so the user browses
// MANY beautiful real photos of a destination, then opens its Things to Do card.
//
// Data: POST /destination/gallery { name, country?, bucket?, limit } →
// { name, bucket, photos: [{ src, full, w, h, title, artist, license, link }] }
// (Wikimedia Commons via the worker — free, attributed, cached). The contract
// is read DEFENSIVELY: every field may be missing, and an empty photos[] is a
// legitimate honest answer, not an error.
//
// Buckets (All · Views · Beaches · Food) fetch lazily on first select and are
// cached in component state; a bucket whose fetch came back empty gets its
// chip hidden after the attempt — no dead tabs. Attribution is required by
// the licenses (and by our always-label-sources rule): the lightbox caption
// links "artist · license" to the Commons file page.
//
// No booking and no vacation builder (founder, 2026-10-03): the hotel/flight
// price tease and "Build your vacation" are gone; the gallery is inspiration.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { logDiscover } from "@/lib/logDiscover";
import { flushEvents } from "@/lib/analytics";
import { openPartner } from "@/lib/openPartner";
import { IVORY_2 } from "@/components/redesign/constants";

const INK = "#16302B", SUB = "#71827D", TEAL = "#17A38F", EDGE = "#E6DFD0";
const PAPER = "#FBF6EC";

// Bucket ids must match the worker contract: 'views' | 'beach' | 'food'
// ('family' exists too but is not surfaced here); "" = omitted bucket = general.
const BUCKETS = [
  { id: "", label: "All" },
  { id: "views", label: "Views" },
  { id: "beach", label: "Beaches" },
  { id: "food", label: "Food" },
];

// Normalize one photo from the worker payload — every field defensive, and a
// photo with no usable image URL at all is dropped.
function normalizePhoto(p) {
  const src = typeof p?.src === "string" && p.src ? p.src : (typeof p?.full === "string" ? p.full : "");
  const full = typeof p?.full === "string" && p.full ? p.full : src;
  return {
    src,
    full,
    w: Number(p?.w),
    h: Number(p?.h),
    title: typeof p?.title === "string" ? p.title : "",
    artist: typeof p?.artist === "string" ? p.artist : "",
    license: typeof p?.license === "string" ? p.license : "",
    link: typeof p?.link === "string" ? p.link : "",
  };
}

// Six shimmer blocks at staggered heights — masonry-shaped loading, no spinner.
const SHIMMER_H = [180, 236, 204, 160, 224, 188];

// Reduced-motion probe, read at gesture time so a mid-session OS toggle is
// honoured. Guards the lightbox swipe-dismiss follow — reduced-motion users
// still get threshold dismissal, just without the image tracking the finger.
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function DreamGallery({ open, onClose, dest, onView, viewLabel = "View details" }) {
  const [active, setActive] = useState("");
  // { [`destKey:bucketId`]: { status: 'loading'|'done', photos: [...] } } — an error
  // or empty result lands as done+[] (honest empty; the chip hides itself).
  // Keys are destination-scoped so a dest swap while open can never make the
  // fetch effect skip on a stale closure of the previous destination's map.
  const [byBucket, setByBucket] = useState({});
  // Lightbox = an INDEX into the current bucket's photo list (so swipe/arrows
  // can walk it), not a photo object; clamped defensively at render in case
  // the list shrinks underneath (an image erroring out of `failed`).
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [failed, setFailed] = useState(() => new Set());
  // Lightbox image fallback ladder — a full-res original that 404s falls back
  // to the 1200px thumbnail (the one that already loaded on the wall); if even
  // that fails the frame shows a "Photo unavailable" placeholder. Both keyed by
  // photo.src, so onError can never loop. Reset on destination change.
  const [lbFullFailed, setLbFullFailed] = useState(() => new Set());
  const [lbImgFailed, setLbImgFailed] = useState(() => new Set());
  // { [destKey]: { status: 'loading'|'done', about: string } } — the AI
  // destination-intel blurb, fetched once per destKey when coords exist. Read
  // DEFENSIVELY: available:false, a missing `about`, or any error → done+"" and
  // the intro band renders nothing. Never blocks photos.
  const [intels, setIntels] = useState({});

  const name = dest?.name ? String(dest.name) : "";
  const destKey = name ? `${name}|${dest?.country || ""}` : "";
  // Same strictness as the old package reader — real numbers only, no
  // string coercion. No coords → the estimate fetch is skipped entirely.
  const hasCoords = Number.isFinite(dest?.lat) && Number.isFinite(dest?.lng);
  const intelSlot = intels[destKey];
  const about = intelSlot?.status === "done" ? intelSlot.about : "";

  // Current bucket's photos — derived BEFORE the effects so the keyboard
  // handler below can step through them.
  const slot = byBucket[`${destKey}:${active}`];
  const loading = !slot || slot.status === "loading";
  const photos = (slot?.photos || []).filter((p) => !failed.has(p.src));

  // Step the lightbox within the current list — no wrap; ends are ends
  // (the chevrons hide there too).
  const stepLightbox = (delta) => {
    setLightboxIdx((i) => {
      if (i == null || photos.length === 0) return i;
      const cur = Math.min(Math.max(i, 0), photos.length - 1);
      const next = cur + delta;
      return next < 0 || next >= photos.length ? cur : next;
    });
  };

  // Lightbox swipe — raw touch deltas so a mostly-vertical drag never pages.
  // Horizontal-dominant → page; vertical-dominant downward past ~80px → dismiss.
  const touchRef = useRef(null);
  const lbImgRef = useRef(null);
  const onLbTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY, dx: 0, dy: 0 };
  };
  const onLbTouchMove = (e) => {
    const s = touchRef.current;
    const t = e.touches && e.touches[0];
    if (!s || !t) return;
    s.dx = t.clientX - s.x;
    s.dy = t.clientY - s.y;
    // Downward-drag follow — a visible affordance that a swipe down dismisses.
    // Skipped entirely for reduced-motion users (they still get the threshold
    // dismissal below, just without the image tracking the finger).
    const img = lbImgRef.current;
    if (img && s.dy > 0 && Math.abs(s.dy) > Math.abs(s.dx) && !prefersReducedMotion()) {
      img.style.transform = `translateY(${Math.min(s.dy, 240)}px)`;
      img.style.opacity = String(Math.max(0.4, 1 - s.dy / 420));
    }
  };
  const onLbTouchEnd = () => {
    const s = touchRef.current;
    touchRef.current = null;
    // Always release any live drag transform, dismiss or not.
    const img = lbImgRef.current;
    if (img) { img.style.transform = ""; img.style.opacity = ""; }
    if (!s) return;
    // Vertical-dominant downward drag past the threshold dismisses the lightbox.
    if (Math.abs(s.dy) > Math.abs(s.dx) && s.dy > 80) { setLightboxIdx(null); return; }
    if (Math.abs(s.dx) < 48 || Math.abs(s.dx) <= Math.abs(s.dy)) return;
    stepLightbox(s.dx < 0 ? 1 : -1);
  };

  // New destination → forget the previous destination's photos entirely.
  useEffect(() => {
    setActive("");
    setByBucket({});
    setLightboxIdx(null);
    setFailed(new Set());
    setLbFullFailed(new Set());
    setLbImgFailed(new Set());
  }, [destKey]);

  // Lock the page behind the sheet while it's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes the lightbox first, then the sheet; arrows page the lightbox.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (lightboxIdx != null) setLightboxIdx(null);
        else onClose?.();
        return;
      }
      if (lightboxIdx == null) return;
      if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lightboxIdx, onClose, photos.length]);  

  useEffect(() => {
    if (open && name) logDiscover("dream_gallery_open", { place_name: name, country: dest?.country || "" });
  }, [open, destKey]);  

  // Dwell — foreground ms per gallery session, measured open → close (or
  // dest-change / unmount / pagehide, whichever ends the session first).
  // Inline rather than useDwell(): the hook times mount→unmount, but this
  // sheet stays mounted while closed (`open` prop), so the session must be
  // scoped to the [open, destKey] effect instead. Semantics are identical to
  // useDwell: monotonic clock, paused while document.hidden, reported at most
  // once per session, only when >= 2s, clamped at 10 min. Payload carries the
  // place name and ms only — no PII.
  useEffect(() => {
    if (!open || !name) return;
    const now = () =>
      (typeof performance !== "undefined" && typeof performance.now === "function")
        ? performance.now()
        : Date.now();
    let accum = 0;
    let startedAt = document.hidden ? null : now();
    let reported = false;
    const onVisibility = () => {
      if (document.hidden) {
        if (startedAt != null) { accum += now() - startedAt; startedAt = null; }
      } else if (startedAt == null) {
        startedAt = now();
      }
    };
    const report = () => {
      if (reported) return;
      reported = true;
      let total = accum;
      if (startedAt != null) { total += now() - startedAt; startedAt = null; }
      const ms = Math.min(Math.round(total), 600000);
      if (ms >= 2000) {
        logDiscover("dwell", { surface: "dream_gallery", ms, place_name: name, country: dest?.country || "" });
        // Same tab-close rescue as useDwell: the module-level pagehide flush
        // runs before this report queues — force-flush or the event is lost.
        try { flushEvents(); } catch { /* non-fatal */ }
      }
    };
    const onPageHide = () => report();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      report();
    };
  }, [open, destKey]);  

  // Lazy per-bucket fetch — first select only; results (including honest
  // empties) cached in state for the life of the destination.
  useEffect(() => {
    if (!open || !name) return;
    const k = `${destKey}:${active}`;
    if (byBucket[k]) return; // already loading or loaded
    let cancelled = false;
    setByBucket((m) => ({ ...m, [k]: { status: "loading", photos: [] } }));
    (async () => {
      const body = { name, limit: 30 };
      if (dest?.country) body.country = dest.country;
      if (active) body.bucket = active;
      const res = await callWorker(ROUTE.destinationGallery, body);
      if (cancelled) return;
      const raw = (!res.error && Array.isArray(res.data?.photos)) ? res.data.photos : [];
      const photos = raw.map(normalizePhoto).filter((p) => p.src);
      setByBucket((m) => ({ ...m, [k]: { status: "done", photos } }));
    })();
    return () => { cancelled = true; };
  }, [open, active, destKey]);  

  // Lazy destination-intel blurb — once per destKey, coords required, parallel
  // to every other fetch (photos never wait on it). Read defensively: only a
  // whole available:true payload with a non-empty string `about` becomes a
  // blurb; everything else (unavailable, absent `about`, error) resolves to ""
  // and the intro band renders nothing.
  useEffect(() => {
    if (!open || !name || !hasCoords) return;
    if (intels[destKey]) return; // already loading or loaded
    let cancelled = false;
    setIntels((m) => ({ ...m, [destKey]: { status: "loading", about: "" } }));
    (async () => {
      const body = { name, country: dest?.country ? String(dest.country) : "", lat: dest.lat, lng: dest.lng };
      const res = await callWorker(ROUTE.destinationIntel, body);
      if (cancelled) return;
      const d = res.error ? null : res.data;
      const about = (d && d.available === true && typeof d.about === "string" && d.about.trim())
        ? d.about.trim()
        : "";
      setIntels((m) => ({ ...m, [destKey]: { status: "done", about } }));
    })();
    return () => { cancelled = true; };
  }, [open, destKey, hasCoords]);  

  // A vanished list (every image erroring into `failed`) must also CLEAR the
  // lightbox index — the render clamp only hides it, leaving a stale index that
  // swallows one Escape and pops the lightbox open uninvited on the next
  // non-empty bucket. Guarded on !loading so a bucket-switch transient can't
  // clear a legitimate index.
  useEffect(() => {
    if (lightboxIdx != null && !loading && photos.length === 0) setLightboxIdx(null);
  }, [photos.length, loading]);  

  if (!open || !name) return null;

  const country = dest?.country ? String(dest.country) : "";

  // Clamp the lightbox index against the live list — if the list shrank under
  // it the nearest photo shows; if the list is empty the lightbox just closes.
  const lbIdx = lightboxIdx == null || photos.length === 0
    ? null
    : Math.min(Math.max(lightboxIdx, 0), photos.length - 1);
  const lbPhoto = lbIdx == null ? null : photos[lbIdx];
  // Lightbox source ladder, keyed by the stable thumbnail src. Prefer the
  // full-res original; if it 404'd (or there is no distinct full) fall to the
  // thumbnail that already loaded on the wall; if that fails too, show the
  // "Photo unavailable" frame. `lbKey` stays constant across the full→thumb
  // swap, so onError climbs the ladder exactly once and never loops.
  const lbKey = lbPhoto ? lbPhoto.src : "";
  const lbBroken = lbPhoto ? lbImgFailed.has(lbKey) : false;
  const lbUseThumb = lbPhoto ? (lbFullFailed.has(lbKey) || !lbPhoto.full || lbPhoto.full === lbPhoto.src) : false;
  const lbShowSrc = lbPhoto ? (lbUseThumb ? lbPhoto.src : lbPhoto.full) : "";

  // Honest chips: a bucket that was tried and came back empty disappears —
  // unless it's the one on screen (its empty state explains itself).
  const chips = BUCKETS.filter((b) => {
    if (b.id === active) return true;
    const s = byBucket[`${destKey}:${b.id}`];
    return !(s && s.status === "done" && s.photos.length === 0);
  });


  const creditLine = (p) => [p.artist, p.license].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: PAPER }}>
      {/* Header — mono COUNTRY kicker, serif destination name, close X. */}
      {/* Header pads BELOW the notch/Dynamic Island — a fixed 16px put the
          kicker, name and close X under the status bar (the X read as dead). */}
      <div className="flex-none px-4 pb-2" style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top, 0px) + 12px))", borderBottom: `1px solid ${EDGE}` }}>
        <div className="max-w-md mx-auto flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {country && (
              <div className="font-mono uppercase tracking-[0.14em] text-[calc(10px*var(--fs))] font-semibold" style={{ color: SUB }}>
                {country}
              </div>
            )}
            <div className="font-serif text-[calc(24px*var(--fs))] leading-tight mt-0.5 truncate" style={{ color: INK }}>
              {name}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close photo gallery"
            className="flex-none w-11 h-11 rounded-full flex items-center justify-center bg-white"
            style={{ border: `1px solid ${EDGE}`, color: INK }}
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Destination intro — an AI overview blurb under the name, above the
            chips. Renders only when the intel fetch returned a real `about`;
            an absent/unavailable blurb shows nothing (photos never wait on it).
            The micro-label keeps it honest: AI-written, verify on the ground. */}
        {about && (
          <div className="max-w-md mx-auto mt-2.5">
            <p className="font-serif text-[calc(13.5px*var(--fs))] leading-relaxed" style={{ color: INK }}>
              {about}
            </p>
            <div className="font-mono uppercase tracking-[0.08em] text-[calc(9.5px*var(--fs))] font-semibold mt-1" style={{ color: SUB }}>
              AI overview · verify details locally
            </div>
          </div>
        )}

        {/* Bucket chips — mono small-caps feel; active = teal fill. */}
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth: "none" }}>
          {chips.map((b) => {
            const on = active === b.id;
            return (
              <button
                key={b.id || "all"}
                onClick={() => setActive(b.id)}
                className="flex-none rounded-full px-3 py-1.5 font-mono uppercase tracking-[0.08em] text-[calc(10.5px*var(--fs))] font-semibold"
                style={on ? { background: TEAL, color: "#fff" } : { background: "#fff", color: INK, border: `1px solid ${EDGE}` }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo wall — 2-column masonry via CSS columns. */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-md mx-auto">
          {loading ? (
            <div style={{ columns: 2, columnGap: 10 }}>
              {SHIMMER_H.map((h, i) => (
                <div
                  key={i}
                  className="rounded-xl animate-pulse mb-2.5"
                  style={{ height: h, background: IVORY_2, breakInside: "avoid" }}
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="py-14 text-center">
              <div className="font-serif text-[calc(17px*var(--fs))]" style={{ color: SUB }}>
                No photos yet for {name}
              </div>
            </div>
          ) : (
            <div style={{ columns: 2, columnGap: 10 }}>
              {photos.map((p, i) => (
                <button
                  key={p.src + i}
                  onClick={() => setLightboxIdx(i)}
                  className="block w-full rounded-xl overflow-hidden mb-2.5 bg-white"
                  style={{ breakInside: "avoid", border: `1px solid ${EDGE}` }}
                  aria-label={p.title ? `View photo: ${p.title}` : "View photo"}
                >
                  <img
                    src={p.src}
                    alt={p.title || ""}
                    loading="lazy"
                    className="block w-full h-auto"
                    style={Number.isFinite(p.w) && Number.isFinite(p.h) && p.w > 0 && p.h > 0
                      ? { aspectRatio: `${p.w} / ${p.h}`, background: IVORY_2 }
                      : { background: IVORY_2 }}
                    onError={() => setFailed((s) => { const n = new Set(s); n.add(p.src); return n; })}
                  />
                  {/* Visible place-name caption — breakInside:avoid on the
                      button keeps it glued to its photo in the masonry. */}
                  {p.title && (
                    <div className="px-2 pt-1 pb-1.5 text-left">
                      <div className="font-serif text-[calc(12.5px*var(--fs))] truncate" style={{ color: INK }}>
                        {p.title}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom CTA — the whole sheet lands here. */}
      <div className="flex-none px-4 pt-3 bg-white" style={{ borderTop: `1px solid ${EDGE}`, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[calc(16px*var(--fs))] leading-tight" style={{ color: INK }}>
              Dream it? Go see it.
            </div>
            {onView && (
              <button
                onClick={onView}
                className="font-mono uppercase tracking-[0.08em] text-[calc(10px*var(--fs))] font-semibold mt-1 underline underline-offset-2"
                style={{ color: SUB }}
              >
                {viewLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox — full-bleed dim backdrop, image contained, attributed.
          Swipe / chevrons / arrow keys walk the current bucket's photos;
          Escape and a backdrop tap still close. */}
      {lbPhoto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-3 py-8"
          style={{ background: "rgba(12,10,8,0.93)" }}
          onClick={() => setLightboxIdx(null)}
          onTouchStart={onLbTouchStart}
          onTouchMove={onLbTouchMove}
          onTouchEnd={onLbTouchEnd}
        >
          {/* Cross-fade on photo change — guarded so reduced-motion users get
              an instant cut instead. */}
          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              .dg-lb-img { animation: dgLbFade 0.18s ease; }
              @keyframes dgLbFade { from { opacity: 0.35; } to { opacity: 1; } }
            }
          `}</style>
          <button
            onClick={() => setLightboxIdx(null)}
            aria-label="Close photo"
            className="absolute w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              top: "max(12px, env(safe-area-inset-top))",
              right: "max(12px, env(safe-area-inset-right))",
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
            }}
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
          {lbIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.2} />
            </button>
          )}
          {lbIdx < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepLightbox(1); }}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2.2} />
            </button>
          )}
          {lbBroken ? (
            <div
              className="dg-lb-img flex-1 min-h-0 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-mono uppercase tracking-[0.08em] text-[calc(11px*var(--fs))]" style={{ color: "rgba(255,252,247,0.7)" }}>
                Photo unavailable
              </div>
            </div>
          ) : (
            <img
              ref={lbImgRef}
              key={lbShowSrc || lbIdx}
              src={lbShowSrc}
              alt={lbPhoto.title || ""}
              className="dg-lb-img max-w-full flex-1 min-h-0 object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={() => {
                // Climb the ladder once: full→thumbnail, then thumbnail→placeholder.
                if (!lbUseThumb && lbPhoto.full && lbPhoto.full !== lbPhoto.src) {
                  setLbFullFailed((s) => { const n = new Set(s); n.add(lbKey); return n; });
                } else {
                  setLbImgFailed((s) => { const n = new Set(s); n.add(lbKey); return n; });
                }
              }}
            />
          )}
          <div className="flex-none mt-3 text-center max-w-md">
            {lbPhoto.title && (
              <div className="font-serif text-[calc(14px*var(--fs))]" style={{ color: "rgba(255,252,247,0.95)" }}>
                {lbPhoto.title}
              </div>
            )}
            {/* License attribution — required by CC licenses; links to the
                Commons file page. Stop propagation so the tap doesn't close. */}
            {(creditLine(lbPhoto) || lbPhoto.link) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (lbPhoto.link) openPartner(lbPhoto.link);
                }}
                className="font-mono text-[calc(10px*var(--fs))] mt-1 underline underline-offset-2"
                style={{ color: "rgba(255,252,247,0.65)" }}
              >
                {creditLine(lbPhoto) || "Wikimedia Commons"}
              </button>
            )}
            <div
              className="font-mono uppercase tracking-[0.08em] text-[calc(10px*var(--fs))] mt-1"
              style={{ color: "rgba(255,252,247,0.5)" }}
            >
              {lbIdx + 1} of {photos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
