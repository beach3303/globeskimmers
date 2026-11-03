// Listen to the city (founder, 2026-11-03: "i like listen to the city"): the board's clips played one
// after another for their sound — the trams, the markets, the rain — with the poster on screen and
// the caption. The members' own sound, nothing added: no music, no licence. A bar above the nav with
// play, next and stop; a tap on the poster opens the clip in the viewer. A play counts as in the viewer.
//
//   <ListenBar city rows index onIndex onOpen onPlay onClose />
import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { clipFilterCss } from "@/lib/clipFilters";
import { clipLength } from "@/lib/clips";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const GOLD = "#D6A64A";
const btn = { flex: "none", width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 999, border: 0, background: "rgba(255,252,247,.1)", color: NEUTRAL.ivory, cursor: "pointer" };

export default function ListenBar({ city, rows, index, onIndex, onOpen, onPlay = undefined, onClose }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const row = rows[index] || null;
  const rowId = row?.id || null;
  const next = () => { if (rows.length) onIndex((index + 1) % rows.length); };
  // Each clip starts on its own: the tap that opened the bar unlocked the element, and every next
  // source rides on that.
  useEffect(() => {
    const el = ref.current;
    if (!el || !rowId) return undefined;
    el.load();
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => setPlaying(false));
    return undefined;
  }, [rowId]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const on = () => { setPlaying(true); if (typeof onPlay === "function" && row) onPlay(row); };
    const off = () => setPlaying(false);
    el.addEventListener("play", on);
    el.addEventListener("pause", off);
    el.addEventListener("ended", next);
    return () => { el.removeEventListener("play", on); el.removeEventListener("pause", off); el.removeEventListener("ended", next); };
  });
  if (!row) return null;
  const toggle = () => { const el = ref.current; if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause(); };
  return (
    <div role="region" aria-label={`Listening to ${city}`}
      style={{ position: "fixed", left: 12, right: 12, bottom: "calc(98px + env(safe-area-inset-bottom))", zIndex: 60, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 16, background: "#16110D", color: NEUTRAL.ivory, boxShadow: "0 14px 30px -14px rgba(0,0,0,.6)" }}>
      {/* The sound comes from here; the poster stands in for the picture. */}
      <video ref={ref} src={row.video} playsInline preload="auto" aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <button type="button" onClick={() => onOpen(row)} aria-label="Open this clip" style={{ flex: "none", width: 44, height: 44, padding: 0, border: 0, borderRadius: 10, overflow: "hidden", background: "#000", cursor: "pointer" }}>
        {row.photo ? <img src={row.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: clipFilterCss(row.filter) }} /> : null}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".18em", textTransform: "uppercase", color: GOLD }}>Listening to {city} · {index + 1} of {rows.length}</div>
        <div style={{ fontFamily: SERIF, fontSize: fs(15), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {row.caption || row.place || "A traveler’s clip"}<span style={{ fontFamily: MONO, fontSize: fs(9), letterSpacing: ".06em", color: "rgba(255,252,247,.6)" }}> · {clipLength(row.duration)}</span>
        </div>
      </div>
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} style={btn}>
        {playing ? <Pause size={18} strokeWidth={2.2} fill="currentColor" aria-hidden="true" focusable="false" /> : <Play size={18} strokeWidth={2.2} fill="currentColor" aria-hidden="true" focusable="false" />}
      </button>
      <button type="button" onClick={next} aria-label="Next clip" style={btn}><SkipForward size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" /></button>
      <button type="button" onClick={onClose} aria-label="Stop listening" style={btn}><X size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" /></button>
    </div>
  );
}
