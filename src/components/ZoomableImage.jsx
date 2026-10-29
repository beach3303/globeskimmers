// ZoomableImage — a photo you can pinch to zoom and pan (founder, 2026-10-29: "allow pictures in
// city board and passport (to be zoomed in — if people want to)"). Two fingers zoom about the point
// between them, up to 4×; one finger pans while zoomed; a double tap zooms 2.5× where you tapped,
// or puts the picture back; letting go below 1× snaps back. At 1× it is an ordinary picture: a
// swipe still pages the viewer, scrolls the sheet or dismisses it. The moment two fingers land, or
// one finger moves a zoomed picture, the touches stay here — stopPropagation, so the viewer never
// pages mid-pinch and the global swipe-down never fires on a pan; preventDefault, so the browser
// never scrolls or zooms the page instead. Native listeners: React registers touch handlers as
// passive, and a passive handler can't preventDefault.
//
//   <ZoomableImage ref src alt className style imgClassName imgStyle onCapture onZoom …img props />
//   ref         the wrapper — a viewer that slides the picture on a swipe-down transforms this, not the img
//   onCapture   the picture took the touches (a pinch began, a double tap zoomed in): a viewer drops its own drag
//   onZoom(on)  the picture is zoomed (true) or back at 1× (false)
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const MAX = 4, DOUBLE = 2.5, TAP_MS = 320, TAP_PX = 10;
const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ZoomableImage = forwardRef(function ZoomableImage({ src, alt = "", className = undefined, style = undefined, imgClassName = undefined, imgStyle = undefined, onCapture = undefined, onZoom = undefined, ...imgProps }, ref) {
  const wrap = useRef(null), img = useRef(null);
  const z = useRef({ s: 1, tx: 0, ty: 0 });   // the transform in force: the scale, and the centre's offset in px
  const g = useRef(null);                      // the gesture under way
  const api = useRef(null);                    // zoomTo / reset, for the desktop double-click
  const lastTap = useRef(0);
  const cb = useRef({ onCapture, onZoom });
  cb.current = { onCapture, onZoom };
  const [zoomed, setZoomed] = useState(false);
  useImperativeHandle(ref, () => wrap.current);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    let on = false;
    const paint = (anim) => {
      const im = img.current;
      if (!im) return;
      const { s, tx, ty } = z.current;
      im.style.transition = anim && !reduced() ? "transform 180ms ease" : "";
      im.style.transform = s === 1 && !tx && !ty ? "" : `translate(${tx}px, ${ty}px) scale(${s})`;
    };
    // The picture pans until its edge meets the frame's, never past it — it can't be lost off-screen.
    const clamp = (s, tx, ty) => {
      const im = img.current;
      const w = im?.offsetWidth || 0, h = im?.offsetHeight || 0;
      const mx = Math.max(0, (w * s - w) / 2), my = Math.max(0, (h * s - h) / 2);
      return { s, tx: Math.max(-mx, Math.min(mx, tx)), ty: Math.max(-my, Math.min(my, ty)) };
    };
    const apply = (next, anim) => {
      z.current = next;
      paint(anim);
      const now = next.s > 1;
      if (now !== on) { on = now; setZoomed(now); cb.current.onZoom?.(now); }
    };
    // The picture's centre before any transform: the drawn centre, less the offset.
    const centre = () => { const r = img.current.getBoundingClientRect(); return { x: r.left + r.width / 2 - z.current.tx, y: r.top + r.height / 2 - z.current.ty }; };
    const pts = (e) => Array.from(e.touches, (t) => ({ x: t.clientX, y: t.clientY }));
    const mine = (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); };
    // Below 1× the picture snaps back; past the ceiling it settles at it.
    const settle = () => { const { s, tx, ty } = z.current; apply(s < 1.05 ? { s: 1, tx: 0, ty: 0 } : clamp(Math.min(MAX, s), tx, ty), true); };
    // Zoom about a screen point, keeping what's under it where it is: t = (at − C) − (s/s0)(at − C − t0)
    const zoomTo = (s, at, anim) => {
      const C = centre(), k = s / z.current.s;
      apply(clamp(s, (at.x - C.x) - k * (at.x - C.x - z.current.tx), (at.y - C.y) - k * (at.y - C.y - z.current.ty)), anim);
    };
    const reset = () => apply({ s: 1, tx: 0, ty: 0 }, true);
    api.current = { zoomTo, reset };
    // A finger lifted without moving: the second within TAP_MS is a double tap.
    const tapped = (e) => {
      const now = Date.now();
      if (now - lastTap.current > TAP_MS) { lastTap.current = now; return; }
      lastTap.current = 0;
      mine(e);   // ours: no click behind it, no page-level double-tap zoom
      const t = e.changedTouches[0];
      if (z.current.s > 1) reset();
      else { cb.current.onCapture?.(); zoomTo(DOUBLE, { x: t.clientX, y: t.clientY }, true); }
    };

    const onStart = (e) => {
      const p = pts(e);
      if (p.length === 2) {
        cb.current.onCapture?.();
        g.current = { kind: "pinch", d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, s0: z.current.s, mid0: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }, t0: { x: z.current.tx, y: z.current.ty }, C: centre() };
        mine(e);
      } else if (p.length === 1) {
        if (z.current.s > 1) { g.current = { kind: "pan", last: p[0], moved: false }; e.stopPropagation(); }
        else g.current = { kind: "tap", start: p[0], moved: false };   // the viewer's swipe — unless it ends as a tap
      } else if (g.current) { g.current = { kind: "hold" }; mine(e); }   // a third finger: wait for them all to lift
    };
    const onMove = (e) => {
      const gg = g.current;
      if (!gg) return;
      const p = pts(e);
      if (gg.kind === "pinch" && p.length >= 2) {
        mine(e);
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        const s = Math.max(0.5, Math.min(MAX * 1.25, gg.s0 * (d / gg.d0)));   // a little give past the ends; settle() brings it back
        // The point that was between the fingers stays between them.
        const k = s / gg.s0;
        apply({ s, tx: (mid.x - gg.C.x) - k * (gg.mid0.x - gg.C.x - gg.t0.x), ty: (mid.y - gg.C.y) - k * (gg.mid0.y - gg.C.y - gg.t0.y) }, false);
      } else if (gg.kind === "pan" && p.length === 1) {
        mine(e);
        const dx = p[0].x - gg.last.x, dy = p[0].y - gg.last.y;
        gg.last = p[0];
        if (Math.abs(dx) + Math.abs(dy) > 1) gg.moved = true;
        apply(clamp(z.current.s, z.current.tx + dx, z.current.ty + dy), false);
      } else if (gg.kind === "tap" && p.length === 1) {
        if (Math.hypot(p[0].x - gg.start.x, p[0].y - gg.start.y) > TAP_PX) gg.moved = true;
      } else if (gg.kind === "hold") mine(e);
    };
    const onEnd = (e) => {
      const gg = g.current;
      if (!gg) return;
      const left = e.touches.length;
      if (gg.kind === "pinch") {
        e.stopPropagation();
        settle();
        // One finger still down: it pans a zoomed picture, or just waits to lift.
        g.current = !left ? null : z.current.s > 1 ? { kind: "pan", last: { x: e.touches[0].clientX, y: e.touches[0].clientY }, moved: true } : { kind: "hold" };
        return;
      }
      if (gg.kind === "hold") { e.stopPropagation(); if (!left) g.current = null; return; }
      if (gg.kind === "pan") { e.stopPropagation(); if (left) return; g.current = null; if (!gg.moved) tapped(e); return; }
      // "tap": the viewer's swipe ran its course; a still finger may be half of a double tap.
      g.current = null;
      if (!gg.moved && !left) tapped(e);
    };
    const onCancel = () => { g.current = null; settle(); };
    const onGesture = (e) => e.preventDefault();   // Safari's own pinch: never the page
    const opts = { passive: false };
    el.addEventListener("touchstart", onStart, opts);
    el.addEventListener("touchmove", onMove, opts);
    el.addEventListener("touchend", onEnd, opts);
    el.addEventListener("touchcancel", onCancel, opts);
    el.addEventListener("gesturestart", onGesture, opts);
    return () => {
      api.current = null;
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      el.removeEventListener("gesturestart", onGesture);
    };
  }, []);

  // A mouse: double-click zooms in where it is, or puts the picture back.
  const onDoubleClick = (e) => {
    const a = api.current;
    if (!a) return;
    if (z.current.s > 1) a.reset();
    else { cb.current.onCapture?.(); a.zoomTo(DOUBLE, { x: e.clientX, y: e.clientY }, true); }
  };

  return (
    <div ref={wrap} className={className} style={{ position: "relative", zIndex: zoomed ? 5 : undefined, touchAction: "manipulation", ...style }}>
      <img ref={img} src={src} alt={alt} draggable={false} className={imgClassName} onDoubleClick={onDoubleClick}
        style={{ transformOrigin: "center center", willChange: zoomed ? "transform" : undefined, userSelect: "none", WebkitUserSelect: "none", ...imgStyle }} {...imgProps} />
    </div>
  );
});

export default ZoomableImage;
