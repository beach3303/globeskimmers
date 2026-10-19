// PhotoEditor — our own looks on a photo before it travels (founder, 2026-10-18), and since
// 2026-10-19 its crop: a frame (Original, 3:2, 1:1, 4:5), zoom in and out, drag to move, pinch
// on a phone. The photo with the look applied sits in the frame; six named starting points
// (Airmail, Golden Hour, Film, Ink, Dusk, Postcard), then the dials — Brightness, Contrast,
// Warmth (cooler ↔ warmer), Clarity (crisper), Grain, Fade — and Black & white. The preview
// is rendered small and fast; "Use this look" renders the cropped photo once at upload size
// (≤1280 px, re-encoded smaller when grain makes it heavy) and hands it back. Only the
// edited photo leaves here (founder, 2026-10-19): the undo is to add the photo again.
//
//   <PhotoEditor open image onDone onClose accent title aspect />
//   image    a data URL (resizePhoto's output).
//   aspect   the frame to start with: 'original' (default) | '3:2' (a postcard's front) | '1:1' | '4:5'.
//   onDone   (dataUrl, { look, crop }) after the full render; onClose without a change.
import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { EMPTY_LOOK, LOOKS, isPlain, lookFor, renderLook } from "@/lib/photoLook";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const DIALS = [
  ["brightness", "Brightness", -100, 100, "Darker", "Brighter"],
  ["contrast", "Contrast", -100, 100, "Softer", "Punchier"],
  ["warmth", "Warmth", -100, 100, "Cooler", "Warmer"],
  ["clarity", "Clarity", 0, 100, "", "Crisper"],
  ["grain", "Grain", 0, 100, "", "Grainier"],
  ["fade", "Fade", 0, 100, "", "Matte"],
];
const FRAMES = [["original", "Original"], ["3:2", "3:2"], ["1:1", "Square"], ["4:5", "4:5"]];
const ZOOM_MAX = 4;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// The part of the photo the frame shows, as fractions: the photo covers the frame at zoom 1.
function window_(imgAspect, frameAspect, zoom, cx, cy) {
  const vw = (imgAspect > frameAspect ? frameAspect / imgAspect : 1) / zoom;
  const vh = (imgAspect > frameAspect ? 1 : imgAspect / frameAspect) / zoom;
  const x = clamp(cx - vw / 2, 0, 1 - vw), y = clamp(cy - vh / 2, 0, 1 - vh);
  return { x, y, w: vw, h: vh };
}

export default function PhotoEditor({ open = false, image = null, onDone = undefined, onClose = undefined, accent = NEUTRAL.airmailBlue, title = "Edit the photo", aspect = "original" }) {
  const [look, setLook] = useState({ ...EMPTY_LOOK });
  const [preset, setPreset] = useState("none");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState(aspect);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const [natural, setNatural] = useState(null);     // { w, h } of the photo
  const [box, setBox] = useState({ w: 0, h: 0 });   // the frame on screen, px
  const titleId = `pe-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const seq = useRef(0);
  const boxRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);   // { cx, cy, zoom, dist, mid } at the start of a drag or pinch
  const close = () => { if (!busy && typeof onClose === "function") onClose(); };
  useDismissable(open, close);

  // A fresh photo starts plain, uncropped.
  useEffect(() => {
    if (!open || !image) return;
    setLook({ ...EMPTY_LOOK }); setPreset("none"); setPreview(null);
    setFrame(aspect); setZoom(1); setCentre({ x: 0.5, y: 0.5 }); setNatural(null);
    const im = new Image();
    im.onload = () => setNatural({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
    im.src = image;
  }, [open, image, aspect]);

  // The small preview follows the dials; a render that finished late is dropped.
  useEffect(() => {
    if (!open || !image) return undefined;
    const my = ++seq.current;
    let alive = true;
    renderLook(image, look, 640, 0.8).then((u) => { if (alive && my === seq.current) setPreview(u); }).catch(() => {});
    return () => { alive = false; };
  }, [open, image, look]);

  // The frame's size on screen, for the pan maths.
  useEffect(() => {
    if (!open) return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); };
    read();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [open, frame, natural]);

  if (!open || !image) return null;

  const imgAspect = natural ? natural.w / natural.h : 3 / 2;
  const frameAspect = frame === "3:2" ? 3 / 2 : frame === "1:1" ? 1 : frame === "4:5" ? 4 / 5 : imgAspect;
  const win = window_(imgAspect, frameAspect, zoom, centre.x, centre.y);
  // The photo drawn inside the frame: covers it at zoom 1, then zooms about its centre.
  const drawW = imgAspect > frameAspect ? box.h * zoom * imgAspect : box.w * zoom;
  const drawH = imgAspect > frameAspect ? box.h * zoom : box.w * zoom / imgAspect;
  const left = box.w / 2 - (win.x + win.w / 2) * drawW;
  const top = box.h / 2 - (win.y + win.h / 2) * drawH;
  const cropped = zoom > 1.001 || frame !== "original";

  const pick = (key) => { setPreset(key); setLook(lookFor(key)); };
  const dial = (k, v) => { setPreset("custom"); setLook((l) => ({ ...l, [k]: v })); };
  const setZoomAt = (z) => setZoom(clamp(z, 1, ZOOM_MAX));

  // Drag to move; two fingers to zoom.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = pts.length >= 2
      ? { zoom, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), cx: centre.x, cy: centre.y, mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } }
      : { zoom, cx: centre.x, cy: centre.y, start: { x: e.clientX, y: e.clientY } };
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current, pts = [...pointers.current.values()];
    if (pts.length >= 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setZoomAt(g.zoom * (d / g.dist));
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const w = window_(imgAspect, frameAspect, g.zoom, g.cx, g.cy);
      setCentre({ x: g.cx - (mid.x - g.mid.x) / (box.w || 1) * w.w, y: g.cy - (mid.y - g.mid.y) / (box.h || 1) * w.h });
    } else if (g.start) {
      const w = window_(imgAspect, frameAspect, g.zoom, g.cx, g.cy);
      setCentre({ x: g.cx - (e.clientX - g.start.x) / (box.w || 1) * w.w, y: g.cy - (e.clientY - g.start.y) / (box.h || 1) * w.h });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    gesture.current = pts.length === 1 ? { zoom, cx: centre.x, cy: centre.y, start: { x: pts[0].x, y: pts[0].y } } : null;
  };

  const done = async () => {
    if (busy) return;
    if (isPlain(look) && !cropped) { close(); return; }
    setBusy(true);
    try {
      const crop = cropped ? win : null;
      const out = await renderLook(image, look, 1280, 0.84, crop);
      if (typeof onDone === "function") onDone(out, { look, crop });
    } catch { /* keep the sheet open; the photo is untouched */ }
    setBusy(false);
  };

  const chip = (on, label, onClick, dark = false) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on}
      style={{ flex: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? (dark ? NEUTRAL.ink : accent) : NEUTRAL.airmailLine}`, background: on ? (dark ? NEUTRAL.ink : accent) : NEUTRAL.white, color: on ? NEUTRAL.white : NEUTRAL.ink, fontSize: fs(13), fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[10010] flex items-end justify-center" style={{ background: rgba(NEUTRAL.ink, 0.55) }} onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md max-h-[94vh] overflow-y-auto"
        style={{ position: "relative", background: NEUTRAL.ivory, borderRadius: "22px 22px 0 0", outline: "none" }} onClick={(e) => e.stopPropagation()}>
        <AirmailChevron height={4} />
        <div style={{ padding: "14px 20px calc(24px + env(safe-area-inset-bottom))" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: NEUTRAL.stamp }}>Our looks</div>
          <h3 id={titleId} style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(22), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>{title}</h3>

          {/* the frame: what's inside it is the photo that travels */}
          <div ref={boxRef} role="img" aria-label="The photo in its frame — drag to move, pinch or use Zoom"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            style={{ position: "relative", marginTop: 10, borderRadius: 14, overflow: "hidden", border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, aspectRatio: `${frameAspect}`, touchAction: "none", cursor: zoom > 1 ? "grab" : "default", userSelect: "none" }}>
            {box.w > 0 && natural ? (
              <img src={preview || image} alt="" draggable={false}
                style={{ position: "absolute", left, top, width: drawW, height: drawH, maxWidth: "none", display: "block", pointerEvents: "none" }} />
            ) : (
              <img src={preview || image} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
            )}
          </div>

          {/* crop: the frame and the zoom */}
          <div className="flex items-center gap-2 overflow-x-auto" style={{ marginTop: 10, scrollbarWidth: "none" }}>
            <span style={{ flex: "none", fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>Frame</span>
            {FRAMES.map(([k, label]) => chip(frame === k, label, () => { setFrame(k); setCentre({ x: 0.5, y: 0.5 }); }))}
          </div>
          <label style={{ display: "block", marginTop: 6 }}>
            <span className="flex items-center justify-between" style={{ fontSize: fs(12.5), color: NEUTRAL.ink2 }}>
              <span style={{ fontWeight: 600 }}>Zoom</span>
              <span style={{ fontFamily: MONO, fontSize: fs(11), color: NEUTRAL.ink3 }}>{zoom.toFixed(1)}×</span>
            </span>
            <input type="range" min={100} max={ZOOM_MAX * 100} step={1} value={Math.round(zoom * 100)} onChange={(e) => setZoomAt(Number(e.target.value) / 100)} aria-label="Zoom"
              style={{ display: "block", width: "100%", accentColor: accent, marginTop: 2 }} />
            <span className="flex justify-between" style={{ fontSize: fs(10.5), color: NEUTRAL.ink3, marginTop: -2 }}><span>Whole photo</span><span>Closer · drag to move</span></span>
          </label>

          {/* the looks */}
          <div role="group" aria-label="Looks" className="flex gap-2 overflow-x-auto" style={{ marginTop: 8, paddingBottom: 2, scrollbarWidth: "none" }}>
            {LOOKS.map((l) => chip(preset === l.key, l.name, () => pick(l.key)))}
            {chip(!!look.mono, "Black & white", () => { setPreset("custom"); setLook((l) => ({ ...l, mono: !l.mono })); }, true)}
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {DIALS.map(([k, name, min, max, lo, hi]) => (
              <label key={k} style={{ display: "block" }}>
                <span className="flex items-center justify-between" style={{ fontSize: fs(12.5), color: NEUTRAL.ink2 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span style={{ fontFamily: MONO, fontSize: fs(11), color: NEUTRAL.ink3 }}>{look[k] > 0 && min < 0 ? `+${look[k]}` : look[k]}</span>
                </span>
                <input type="range" min={min} max={max} step={1} value={look[k]} onChange={(e) => dial(k, Number(e.target.value))} aria-label={name}
                  style={{ display: "block", width: "100%", accentColor: accent, marginTop: 2 }} />
                <span className="flex justify-between" style={{ fontSize: fs(10.5), color: NEUTRAL.ink3, marginTop: -2 }}><span>{lo}</span><span>{hi}</span></span>
              </label>
            ))}
          </div>

          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => { pick("none"); setFrame(aspect); setZoom(1); setCentre({ x: 0.5, y: 0.5 }); }} disabled={busy} aria-label="Back to the original"
              style={{ flex: "none", width: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2 }}>
              <RotateCcw size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
            </button>
            <button type="button" onClick={close} disabled={busy}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
              Keep original
            </button>
            <button type="button" onClick={done} aria-busy={busy || undefined}
              style={{ flex: 1.4, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: `1px solid ${accent}`, background: accent, color: NEUTRAL.white, fontSize: fs(14), fontWeight: 600 }}>
              {busy ? <Loader2 size={16} strokeWidth={2} className="animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" /> : null}
              {cropped || !isPlain(look) ? "Use this" : "Use this look"}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>What's inside the frame is the photo that travels. To start over later, add the photo again.</p>
        </div>
      </div>
    </div>
  );
}
