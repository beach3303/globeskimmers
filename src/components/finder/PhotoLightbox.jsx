// PhotoLightbox — the shared full-screen photo viewer (Passport Standard).
//
// Lifted from DreamGallery's inline lightbox so any surface can show a
// supplier gallery (hotel choices, room photos) with the same mechanics:
//   - portal to document.body at z-[9999] — above every sheet (FilterSheet is
//     9996), so a room sheet can open a lightbox over itself;
//   - swipe left/right pages, swipe-down (>80px) dismisses with a finger-follow
//     (skipped for reduced-motion users), backdrop tap dismisses;
//   - chevrons hide at the ends (no wrap — ends are ends), Escape / arrows work;
//   - image source ladder hd → src → "Photo unavailable", keyed by src so
//     onError climbs exactly once and never loops;
//   - registers on the dismiss stack while open so the global swipe-down
//     closes it first.
//
// Props:
//   photos        — [{ src, hd?, caption? }]; entries without src are dropped.
//   index         — number | null. null (or an empty list) renders nothing.
//   onClose       — called on X, backdrop tap, Escape, swipe-down.
//   onIndexChange — optional; called with the new index after a page step so
//                   the owner can mirror it. The viewer also keeps its own
//                   copy, so an owner that ignores it still pages fine.
//   title         — optional serif line under the photo (the hotel name).
//   credit        — optional mono credit line (who the photos come from).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const fs = (n) => `calc(${n}px*var(--fs))`;
const LIGHT = "rgba(255,252,247,0.95)", DIM = "rgba(255,252,247,0.65)", FAINT = "rgba(255,252,247,0.5)";

// Read at gesture time so a mid-session OS toggle is honoured.
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PhotoLightbox({ photos, index, onClose, onIndexChange, title, credit }) {
  const list = (Array.isArray(photos) ? photos : []).filter((p) => p && typeof p.src === "string" && p.src);
  const open = index != null && list.length > 0;

  // Own copy of the index — seeded from the prop whenever it changes, stepped
  // locally, mirrored back through onIndexChange.
  const [cur, setCur] = useState(index);
  useEffect(() => { setCur(index); }, [index]);
  const idx = open ? Math.min(Math.max(Number(cur) || 0, 0), list.length - 1) : null;
  const photo = idx == null ? null : list[idx];

  // Source ladder, keyed by src (stable across the hd→src swap).
  const [hdFailed, setHdFailed] = useState(() => new Set());
  const [srcFailed, setSrcFailed] = useState(() => new Set());
  const key = photo ? photo.src : "";
  const useHd = !!(photo && photo.hd && photo.hd !== photo.src && !hdFailed.has(key));
  const broken = photo ? srcFailed.has(key) : false;
  const showSrc = photo ? (useHd ? photo.hd : photo.src) : "";

  useDismissable(open, onClose);

  const step = (delta) => {
    if (idx == null) return;
    const next = idx + delta;
    if (next < 0 || next >= list.length) return;
    setCur(next);
    onIndexChange?.(next);
  };

  // Swipe — raw touch deltas so a mostly-vertical drag never pages.
  const touchRef = useRef(null);
  const imgRef = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY, dx: 0, dy: 0 };
  };
  const onTouchMove = (e) => {
    const s = touchRef.current;
    const t = e.touches && e.touches[0];
    if (!s || !t) return;
    s.dx = t.clientX - s.x;
    s.dy = t.clientY - s.y;
    const img = imgRef.current;
    if (img && s.dy > 0 && Math.abs(s.dy) > Math.abs(s.dx) && !prefersReducedMotion()) {
      img.style.transform = `translateY(${Math.min(s.dy, 240)}px)`;
      img.style.opacity = String(Math.max(0.4, 1 - s.dy / 420));
    }
  };
  const onTouchEnd = () => {
    const s = touchRef.current;
    touchRef.current = null;
    const img = imgRef.current;
    if (img) { img.style.transform = ""; img.style.opacity = ""; }
    if (!s) return;
    if (Math.abs(s.dy) > Math.abs(s.dx) && s.dy > 80) { onClose?.(); return; }
    if (Math.abs(s.dx) < 48 || Math.abs(s.dx) <= Math.abs(s.dy)) return;
    step(s.dx < 0 ? 1 : -1);
  };

  // Escape closes; arrows page.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, idx, list.length]);

  // Lock the page behind the viewer while it's open (restores whatever was set).
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !photo || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-3 py-8"
      style={{ background: "rgba(12,10,8,0.93)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Photos of ${title}` : "Photos"}
      onClick={() => onClose?.()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Cross-fade on photo change — reduced-motion users get an instant cut. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .gs-lb-img { animation: gsLbFade 0.18s ease; }
          @keyframes gsLbFade { from { opacity: 0.35; } to { opacity: 1; } }
        }
      `}</style>
      <button
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        aria-label="Close photos"
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
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); step(-1); }}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.2} />
        </button>
      )}
      {idx < list.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); step(1); }}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.2} />
        </button>
      )}
      {broken ? (
        <div className="gs-lb-img flex-1 min-h-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="uppercase tracking-[0.08em]" style={{ fontFamily: MONO, fontSize: fs(11), color: DIM }}>
            Photo unavailable
          </div>
        </div>
      ) : (
        <img
          ref={imgRef}
          key={showSrc || idx}
          src={showSrc}
          alt={photo.caption || title || ""}
          className="gs-lb-img max-w-full flex-1 min-h-0 object-contain"
          onClick={(e) => e.stopPropagation()}
          onError={() => {
            // Climb once: hd→src, then src→placeholder.
            if (useHd) setHdFailed((s) => { const n = new Set(s); n.add(key); return n; });
            else setSrcFailed((s) => { const n = new Set(s); n.add(key); return n; });
          }}
        />
      )}
      <div className="flex-none mt-3 text-center max-w-md" onClick={(e) => e.stopPropagation()}>
        {title ? (
          <div style={{ fontFamily: SERIF, fontSize: fs(15), color: LIGHT, lineHeight: 1.2 }}>{title}</div>
        ) : null}
        {photo.caption ? (
          <div className="mt-0.5" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(12.5), color: DIM }}>{photo.caption}</div>
        ) : null}
        <div className="uppercase tracking-[0.08em] mt-1" style={{ fontFamily: MONO, fontSize: fs(10), color: FAINT }}>
          {idx + 1} of {list.length}
        </div>
        {credit ? (
          <div className="mt-1" style={{ fontFamily: MONO, fontSize: fs(9.5), color: FAINT }}>{credit}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
