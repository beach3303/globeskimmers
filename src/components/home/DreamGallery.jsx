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
// not two.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
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

export default function DreamGallery({ open, onClose, dest, onView, viewLabel = "View details" }) {
  const navigate = useNavigate();
  const [active, setActive] = useState("");
  // { [`destKey:bucketId`]: { status: 'loading'|'done', photos: [...] } } — an error
  // or empty result lands as done+[] (honest empty; the chip hides itself).
  // Keys are destination-scoped so a dest swap while open can never make the
  // fetch effect skip on a stale closure of the previous destination's map.
  const [byBucket, setByBucket] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [failed, setFailed] = useState(() => new Set());

  const name = dest?.name ? String(dest.name) : "";
  const destKey = name ? `${name}|${dest?.country || ""}` : "";

  // New destination → forget the previous destination's photos entirely.
  useEffect(() => {
    setActive("");
    setByBucket({});
    setLightbox(null);
    setFailed(new Set());
  }, [destKey]);

  // Lock the page behind the sheet while it's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes the lightbox first, then the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lightbox, onClose]);

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

  if (!open || !name) return null;

  const country = dest?.country ? String(dest.country) : "";
  const slot = byBucket[`${destKey}:${active}`];
  const loading = !slot || slot.status === "loading";
  const photos = (slot?.photos || []).filter((p) => !failed.has(p.src));

  // Honest chips: a bucket that was tried and came back empty disappears —
  // unless it's the one on screen (its empty state explains itself).
  const chips = BUCKETS.filter((b) => {
    if (b.id === active) return true;
    const s = byBucket[`${destKey}:${b.id}`];
    return !(s && s.status === "done" && s.photos.length === 0);
  });

  const buildTrip = () => {
    logDiscover("dream_gallery_build_trip", { place_name: name, country });
    // Same router-state handoff SmartSearchOverlay uses — SmartPackages reads
    // routerState.dest and checks Number.isFinite(lat/lng) itself, so missing
    // coords degrade to its own typed search, never a crash.
    navigate(createPageUrl("SmartPackages"), {
      state: { dest: { name, city: dest?.city, country: dest?.country, lat: dest?.lat, lng: dest?.lng } },
    });
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
                  onClick={() => setLightbox(p)}
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

      {/* Lightbox — full-bleed dim backdrop, image contained, attributed. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-3 py-8"
          style={{ background: "rgba(12,10,8,0.93)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
          >
            <X className="w-4 h-4" strokeWidth={2.2} />
          </button>
          <img
            src={lightbox.full || lightbox.src}
            alt={lightbox.title || ""}
            className="max-w-full flex-1 min-h-0 object-contain"
          />
          <div className="flex-none mt-3 text-center max-w-md">
            {lightbox.title && (
              <div className="font-serif text-[calc(14px*var(--fs))]" style={{ color: "rgba(255,252,247,0.95)" }}>
                {lightbox.title}
              </div>
            )}
            {/* License attribution — required by CC licenses; links to the
                Commons file page. Stop propagation so the tap doesn't close. */}
            {(creditLine(lightbox) || lightbox.link) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (lightbox.link) window.open(lightbox.link, "_blank", "noopener");
                }}
                className="font-mono text-[calc(10px*var(--fs))] mt-1 underline underline-offset-2"
                style={{ color: "rgba(255,252,247,0.65)" }}
              >
                {creditLine(lightbox) || "Wikimedia Commons"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
