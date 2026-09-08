// DreamGallery — the full-screen "dream browser": a photo-immersion sheet that
// opens from dream surfaces (DreamShelf, DreamAnswerCard) so the user browses
// MANY beautiful real photos of a destination and lands on "Build my trip".
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
// The CTA hands { name, city, country, lat, lng } to /SmartPackages via the
// EXACT router-state mechanism SmartSearchOverlay already uses — one handoff,
// not two. When a price tease is on screen (below) the same handoff ALSO
// carries { checkin, checkout } so the composer opens pre-dated.
//
// Price tease: POST /package/estimate { name, country, lat, lng } →
// { ok, available, monthLabel, checkin, checkout, nights, party,
//   hotel: { name, stayTotal, currency }, splitFour, intel, includes }.
// Fetched lazily ONCE per destination (only when dest has finite coords),
// cached per destKey, never blocking photos. Every field is read defensively:
// available:false or any missing rendered field → no tease, gallery unchanged.
// The split-by-four line is arithmetic framing only — never a payment promise.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { createPageUrl } from "@/utils";
import { logDiscover } from "@/lib/logDiscover";
import { TEAL_DEEP, IVORY_2 } from "@/components/redesign/constants";

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

// Nuitee money register — currency symbol, 2dp only when the amount has cents.
const money = (amt, cur) => {
  if (!Number.isFinite(amt)) return "";
  const digits = Number.isInteger(amt) ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur || "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amt);
  } catch {
    return `${Math.round(amt * 100) / 100} ${cur || ""}`.trim();
  }
};

// Validate /package/estimate into exactly what the tease renders/emits, or
// null. Strict on purpose: a partial estimate renders NOTHING new — the
// gallery must stay exactly as-is rather than show a broken pitch.
function normalizeEstimate(d) {
  if (!d || d.ok !== true || d.available !== true) return null;
  const monthLabel = typeof d.monthLabel === "string" ? d.monthLabel.trim() : "";
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const checkin = isDay(d.checkin) ? d.checkin : "";
  const checkout = isDay(d.checkout) ? d.checkout : "";
  const nights = Number(d.nights);
  const stayTotal = Number(d.hotel?.stayTotal);
  const currency = typeof d.hotel?.currency === "string" && d.hotel.currency ? d.hotel.currency : "";
  const splitFour = Number(d.splitFour);
  // monthLabel is OPTIONAL: the worker sends null when the best-time window had
  // no parseable month (e.g. "Year-round") — the tease then simply drops the
  // "Best in" prefix rather than inventing a month or losing the whole pitch.
  if (!checkin || !checkout || !(checkout > checkin)) return null;
  if (!Number.isFinite(nights) || nights < 1) return null;
  if (!Number.isFinite(stayTotal) || stayTotal <= 0 || !currency) return null;
  if (!Number.isFinite(splitFour) || splitFour <= 0) return null;
  return { monthLabel, checkin, checkout, nights: Math.round(nights), stayTotal, currency, splitFour };
}

export default function DreamGallery({ open, onClose, dest, onView, viewLabel = "View details" }) {
  const navigate = useNavigate();
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
  // { [destKey]: { status: 'loading'|'done', est: normalized|null } } — kept
  // across destination swaps so each destination is estimated at most once
  // per mount. done+null = tried, nothing showable (gallery stays as-is).
  const [estimates, setEstimates] = useState({});
  const teaseLoggedRef = useRef(new Set());

  const name = dest?.name ? String(dest.name) : "";
  const destKey = name ? `${name}|${dest?.country || ""}` : "";
  // Same strictness as SmartPackages' own reader — real numbers only, no
  // string coercion. No coords → the estimate fetch is skipped entirely.
  const hasCoords = Number.isFinite(dest?.lat) && Number.isFinite(dest?.lng);
  const estSlot = estimates[destKey];
  const est = estSlot?.status === "done" ? estSlot.est : null;

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
  const touchRef = useRef(null);
  const onLbTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY, dx: 0, dy: 0 };
  };
  const onLbTouchMove = (e) => {
    const s = touchRef.current;
    const t = e.touches && e.touches[0];
    if (s && t) { s.dx = t.clientX - s.x; s.dy = t.clientY - s.y; }
  };
  const onLbTouchEnd = () => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    if (Math.abs(s.dx) < 48 || Math.abs(s.dx) <= Math.abs(s.dy)) return;
    stepLightbox(s.dx < 0 ? 1 : -1);
  };

  // New destination → forget the previous destination's photos entirely.
  useEffect(() => {
    setActive("");
    setByBucket({});
    setLightboxIdx(null);
    setFailed(new Set());
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
  }, [open, lightboxIdx, onClose, photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && name) logDiscover("dream_gallery_open", { place_name: name, country: dest?.country || "" });
  }, [open, destKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [open, active, destKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy price-tease estimate — once per destination, coords required, and
  // fully parallel to the photo fetches (photos never wait on it).
  useEffect(() => {
    if (!open || !name || !hasCoords) return;
    if (estimates[destKey]) return; // already loading or loaded
    let cancelled = false;
    setEstimates((m) => ({ ...m, [destKey]: { status: "loading", est: null } }));
    (async () => {
      const body = { name, country: dest?.country ? String(dest.country) : "", lat: dest.lat, lng: dest.lng };
      const res = await callWorker(ROUTE.packageEstimate, body);
      if (cancelled) return;
      const normalized = res.error ? null : normalizeEstimate(res.data);
      setEstimates((m) => ({ ...m, [destKey]: { status: "done", est: normalized } }));
    })();
    return () => { cancelled = true; };
  }, [open, destKey, hasCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  // One view event per shown estimate — keyed by destKey so a bucket switch
  // or reopen of the same destination never re-fires it.
  useEffect(() => {
    if (!open || !est || teaseLoggedRef.current.has(destKey)) return;
    teaseLoggedRef.current.add(destKey);
    logDiscover("dream_tease_view", { place_name: name, total: est.stayTotal, currency: est.currency });
  }, [open, est, destKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A vanished list (every image erroring into `failed`) must also CLEAR the
  // lightbox index — the render clamp only hides it, leaving a stale index that
  // swallows one Escape and pops the lightbox open uninvited on the next
  // non-empty bucket. Guarded on !loading so a bucket-switch transient can't
  // clear a legitimate index.
  useEffect(() => {
    if (lightboxIdx != null && !loading && photos.length === 0) setLightboxIdx(null);
  }, [photos.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !name) return null;

  const country = dest?.country ? String(dest.country) : "";

  // Clamp the lightbox index against the live list — if the list shrank under
  // it the nearest photo shows; if the list is empty the lightbox just closes.
  const lbIdx = lightboxIdx == null || photos.length === 0
    ? null
    : Math.min(Math.max(lightboxIdx, 0), photos.length - 1);
  const lbPhoto = lbIdx == null ? null : photos[lbIdx];

  // Honest chips: a bucket that was tried and came back empty disappears —
  // unless it's the one on screen (its empty state explains itself).
  const chips = BUCKETS.filter((b) => {
    if (b.id === active) return true;
    const s = byBucket[`${destKey}:${b.id}`];
    return !(s && s.status === "done" && s.photos.length === 0);
  });

  const buildTrip = () => {
    logDiscover("dream_gallery_build_trip", { place_name: name, country });
    if (est) logDiscover("dream_tease_build", { place_name: name, total: est.stayTotal, currency: est.currency });
    // Same router-state handoff SmartSearchOverlay uses — SmartPackages reads
    // routerState.dest and checks Number.isFinite(lat/lng) itself, so missing
    // coords degrade to its own typed search, never a crash. With a tease on
    // screen the estimate's dates ride along so the composer opens pre-dated;
    // without one the state is byte-for-byte what it was before.
    const state = { dest: { name, city: dest?.city, country: dest?.country, lat: dest?.lat, lng: dest?.lng } };
    if (est) { state.checkin = est.checkin; state.checkout = est.checkout; }
    navigate(createPageUrl("SmartPackages"), { state });
    onClose?.();
  };

  const creditLine = (p) => [p.artist, p.license].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: PAPER }}>
      {/* Header — mono COUNTRY kicker, serif destination name, close X. */}
      <div className="flex-none px-4 pt-4 pb-2" style={{ borderBottom: `1px solid ${EDGE}` }}>
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
            className="flex-none w-9 h-9 rounded-full flex items-center justify-center bg-white"
            style={{ border: `1px solid ${EDGE}`, color: INK }}
          >
            <X className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>

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

      {/* Price tease — the honest sales pitch, only when a real estimate came
          back whole. Hotel-only money, split-by-four as plain arithmetic
          framing (never a payment product we don't control). */}
      {est && (
        <div className="flex-none px-4 pt-3 pb-2.5" style={{ background: IVORY_2, borderTop: `1px solid ${EDGE}` }}>
          <div className="max-w-md mx-auto">
            <div className="font-serif text-[calc(16px*var(--fs))] leading-tight" style={{ color: INK }}>
              Want to take this vacation?
            </div>
            <div className="font-mono text-[calc(12px*var(--fs))] mt-1 leading-snug" style={{ color: INK }}>
              {est.monthLabel ? `Best in ${est.monthLabel} · roughly` : "Roughly"} {money(est.stayTotal, est.currency)} for two · {est.nights} night{est.nights === 1 ? "" : "s"}
            </div>
            <div className="font-mono text-[calc(11.5px*var(--fs))] mt-0.5 leading-snug" style={{ color: SUB }}>
              ~{money(est.splitFour, est.currency)} × 4 if you split it · hotel only — tours and tickets priced separately
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom CTA — the whole sheet lands here. */}
      <div className="flex-none px-4 pt-3 bg-white" style={{ borderTop: `1px solid ${EDGE}`, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[calc(16px*var(--fs))] leading-tight" style={{ color: INK }}>
              Dream it? Build the trip.
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
          <button
            onClick={buildTrip}
            className="flex-none h-11 rounded-xl font-semibold text-white text-[calc(13.5px*var(--fs))] px-4"
            style={{ background: TEAL_DEEP }}
          >
            Build my trip
          </button>
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
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
          >
            <X className="w-4 h-4" strokeWidth={2.2} />
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
          <img
            key={lbPhoto.src || lbIdx}
            src={lbPhoto.full || lbPhoto.src}
            alt={lbPhoto.title || ""}
            className="dg-lb-img max-w-full flex-1 min-h-0 object-contain"
            onClick={(e) => e.stopPropagation()}
          />
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
                  if (lbPhoto.link) window.open(lbPhoto.link, "_blank", "noopener");
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
