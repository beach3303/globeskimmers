// The verified stamp outro (founder, 2026-11-03: "the marks only we can put on a clip — build both"): in
// a clip's last two seconds the city's stamp slams onto the frame, in ink red, with the date — the
// city and the day come from where and when the clip was shot, so it can't be faked the way a
// location sticker can. Drawn at playback over the <video>, never re-encoded; it stays while the
// clip ends and goes when it plays again from earlier.
//
//   const on = useOutro(videoRef, enabled, endAt?);   <StampOutro on city region country date />
import React, { useEffect, useState } from "react";
import TypographicStamp from "@/components/passport/TypographicStamp";

export const OUTRO_SECONDS = 2;
const RED = "#B0472F";

// True while the clip is in its last two seconds (or ended); `endAt` is the window's end when the
// editor previews a longer clip, else the clip's own length.
export function useOutro(videoRef, enabled = true, endAt = null) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = videoRef && videoRef.current;
    if (!el || !enabled) { setOn(false); return undefined; }
    const tick = () => {
      const end = Number.isFinite(endAt) && endAt > 0 ? endAt : el.duration;
      if (!Number.isFinite(end) || end <= 0) { setOn(false); return; }
      setOn(el.ended || el.currentTime >= end - OUTRO_SECONDS - 0.05);
    };
    tick();
    for (const ev of ["timeupdate", "seeked", "ended", "play", "loadedmetadata"]) el.addEventListener(ev, tick);
    return () => { for (const ev of ["timeupdate", "seeked", "ended", "play", "loadedmetadata"]) el.removeEventListener(ev, tick); };
  }, [videoRef, enabled, endAt]);
  return on;
}

export default function StampOutro({ on = false, city = null, region = null, country = null, date = null }) {
  if (!on || !city) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", overflow: "hidden" }}>
      <style>{"@keyframes gs-stamp-slam { 0% { opacity: 0; transform: scale(1.8) rotate(-14deg); } 55% { opacity: 1; transform: scale(.94) rotate(-8deg); } 75% { transform: scale(1.03) rotate(-8deg); } 100% { opacity: 1; transform: scale(1) rotate(-8deg); } }"}</style>
      <div style={{ animation: "gs-stamp-slam 320ms cubic-bezier(.2,.9,.3,1.15) both", color: RED, filter: "drop-shadow(0 6px 10px rgba(0,0,0,.4))", width: 200 }}>
        <TypographicStamp name={city} city={region || ""} country={country || ""} date={date} width={200} strength={2} ink={RED} />
      </div>
    </div>
  );
}
