// ClipTrimmer — the clip editor before a clip goes up. Two jobs on one sheet: a clip longer than 20
// seconds slides to the 20 seconds you want (founder, 2026-10-30: "can we give them a way to trim it or
// select from video to trim?"), and every clip picks its look (founder, 2026-11-03: "allow user to place
// filter on their clip/videos"). The preview plays your window from its start and stops at its end,
// wearing the look; the button hands back { start, filter }. A look is a name the app draws with CSS
// wherever the clip shows (src/lib/clipFilters.js) — the file itself is never re-encoded.
//
//   <ClipTrimmer src duration seconds trim onPick({ start, filter }) onClose />
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Scissors, X } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { useDismissable } from "@/lib/dismissStack";
import { CLIP_FILTERS, clipFilterCss } from "@/lib/clipFilters";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const BLUE = "#1F4E8C", RED = "#B0472F";
const mmss = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };
// What a look does to colours while no still of the clip is ready: a warm-to-blue swatch.
const SWATCH = "linear-gradient(135deg, #E8B04B 0%, #D9643A 45%, #2F6CB5 100%)";

export default function ClipTrimmer({ src, duration, seconds = 20, trim = true, onPick, onClose }) {
  useDismissable(true, onClose);
  const [start, setStart] = useState(0);
  const [look, setLook] = useState("none");
  const [frame, setFrame] = useState(null);   // one still of the clip, behind the look thumbnails
  const ref = useRef(null);
  const max = trim ? Math.max(0, (Number(duration) || 0) - seconds) : 0;
  const end = Math.min(Number(duration) || 0, start + seconds);
  const seek = (s) => { const v = Math.max(0, Math.min(max, Number(s) || 0)); setStart(v); const el = ref.current; if (el) { el.pause(); el.currentTime = v; } };
  // The preview stops at the window's end and goes back to its start.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onTime = () => { if (el.currentTime >= end - 0.05) { el.pause(); el.currentTime = start; } };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [start, end]);
  // One still for the thumbnails as soon as the preview has a frame; a canvas that can't be read
  // (or a frame that never comes) leaves the swatch, which still shows what each look does.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let done = false;
    const grab = () => {
      if (done || el.readyState < 2 || !el.videoWidth || !el.videoHeight) return;
      try {
        const s = 112;
        const c = document.createElement("canvas");
        c.width = s; c.height = s;
        const scale = Math.max(s / el.videoWidth, s / el.videoHeight);
        const w = el.videoWidth * scale, h = el.videoHeight * scale;
        c.getContext("2d").drawImage(el, (s - w) / 2, (s - h) / 2, w, h);
        setFrame(c.toDataURL("image/jpeg", 0.8));
      } catch { /* tainted or not drawable: the swatch stays */ }
      done = true;
    };
    grab();
    el.addEventListener("loadeddata", grab);
    el.addEventListener("seeked", grab);
    return () => { el.removeEventListener("loadeddata", grab); el.removeEventListener("seeked", grab); };
  }, [src]);
  const current = CLIP_FILTERS.find((f) => f.id === look) || CLIP_FILTERS[0];

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9998, background: "rgba(22,17,13,.55)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={trim ? `Pick your ${seconds} seconds` : "Pick a look for your clip"} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>This clip is {mmss(duration)}{trim ? ` · clips are ${seconds} seconds` : ""}</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>
              {trim ? <>Pick your <em style={{ fontStyle: "italic", color: BLUE }}>{seconds} seconds</em></> : <>Give it a <em style={{ fontStyle: "italic", color: BLUE }}>look</em></>}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <video ref={ref} src={src} controls playsInline preload="auto"
          style={{ display: "block", width: "100%", maxHeight: trim ? "40vh" : "46vh", borderRadius: 12, background: "#000", marginTop: 12, filter: clipFilterCss(look) }} />

        {trim ? (
          <div style={{ marginTop: 12, padding: "10px 12px 12px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".1em", color: NEUTRAL.ink3 }}>
              <span>STARTS {mmss(start)}</span><span>ENDS {mmss(end)}</span>
            </div>
            <input type="range" min={0} max={max} step={0.5} value={start} onChange={(e) => seek(e.target.value)} aria-label="Where your 20 seconds start"
              style={{ display: "block", width: "100%", marginTop: 8, accentColor: BLUE }} />
            <p style={{ margin: "8px 0 0", fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Slide to where it should begin; play to check. Only these {seconds} seconds go up.</p>
          </div>
        ) : null}

        {/* The looks: the clip's own still under each one (the swatch until it's ready), the chosen one ringed. */}
        <div style={{ marginTop: 12, padding: "10px 12px 10px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".1em", color: NEUTRAL.ink3 }}>
            <span>LOOK</span><span style={{ color: look === "none" ? NEUTRAL.ink3 : BLUE }}>{current.name.toUpperCase()}</span>
          </div>
          <div role="radiogroup" aria-label="Look" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 2px 4px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {CLIP_FILTERS.map((f) => {
              const on = f.id === look;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} aria-label={f.name} onClick={() => setLook(f.id)}
                  style={{ flex: "none", width: 66, padding: "2px 0 0", border: 0, background: "transparent", cursor: "pointer", font: "inherit" }}>
                  <span aria-hidden="true" style={{ display: "block", width: 56, height: 56, margin: "0 auto", borderRadius: 12, overflow: "hidden", background: frame ? "#000" : SWATCH,
                    boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${BLUE}` : "0 0 0 1px rgba(22,17,13,.12)", filter: clipFilterCss(f.id) }}>
                    {frame ? <img src={frame} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
                  </span>
                  <span style={{ display: "block", marginTop: 6, fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".1em", textTransform: "uppercase", color: on ? BLUE : NEUTRAL.ink2, fontWeight: on ? 700 : 500 }}>{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={() => onPick({ start, filter: look === "none" ? null : look })}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 12, minHeight: 48, borderRadius: 999, border: 0, background: BLUE, color: "#fff", font: "inherit", fontSize: fs(15), fontWeight: 700, cursor: "pointer" }}>
          {trim ? <Scissors size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" /> : <Check size={16} strokeWidth={2.4} aria-hidden="true" focusable="false" />}
          {trim ? `Use these ${seconds} seconds` : "Use this clip"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
