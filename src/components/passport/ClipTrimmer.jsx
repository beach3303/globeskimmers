// ClipTrimmer — a clip longer than 20 seconds: slide to the 20 seconds you want (founder, 2026-10-30:
// "can we give them a way to trim it or select from video to trim?"). The preview plays your window
// from its start and stops at its end; "Use these 20 seconds" hands the start back, and the phone
// exports just that range.
//
//   <ClipTrimmer src duration seconds onPick(start) onClose />
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Scissors, X } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { useDismissable } from "@/lib/dismissStack";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const BLUE = "#1F4E8C", RED = "#B0472F";
const mmss = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

export default function ClipTrimmer({ src, duration, seconds = 20, onPick, onClose }) {
  useDismissable(true, onClose);
  const [start, setStart] = useState(0);
  const ref = useRef(null);
  const max = Math.max(0, (Number(duration) || 0) - seconds);
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

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9998, background: "rgba(22,17,13,.55)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Pick your ${seconds} seconds`} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", textTransform: "uppercase", color: RED }}>This clip is {mmss(duration)} · clips are {seconds} seconds</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), fontWeight: 400, lineHeight: 1.1, color: NEUTRAL.ink }}>Pick your <em style={{ fontStyle: "italic", color: BLUE }}>{seconds} seconds</em></h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: "transparent", border: 0, color: NEUTRAL.ink2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <video ref={ref} src={src} controls playsInline preload="metadata"
          style={{ display: "block", width: "100%", maxHeight: "46vh", borderRadius: 12, background: "#000", marginTop: 12 }} />

        <div style={{ marginTop: 12, padding: "10px 12px 12px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: fs(10), letterSpacing: ".1em", color: NEUTRAL.ink3 }}>
            <span>STARTS {mmss(start)}</span><span>ENDS {mmss(end)}</span>
          </div>
          <input type="range" min={0} max={max} step={0.5} value={start} onChange={(e) => seek(e.target.value)} aria-label="Where your 20 seconds start"
            style={{ display: "block", width: "100%", marginTop: 8, accentColor: BLUE }} />
          <p style={{ margin: "8px 0 0", fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink2 }}>Slide to where it should begin; play to check. Only these {seconds} seconds go up.</p>
        </div>

        <button type="button" onClick={() => onPick(start)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 12, minHeight: 48, borderRadius: 999, border: 0, background: BLUE, color: "#fff", font: "inherit", fontSize: fs(15), fontWeight: 700, cursor: "pointer" }}>
          <Scissors size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" /> Use these {seconds} seconds
        </button>
      </div>
    </div>,
    document.body,
  );
}
