// One clip player for every place a clip plays (2026-11-03): the <video> wearing its look, its frame
// around it (ClipFrame), the verified stamp over its last two seconds (StampOutro), the flight path
// when it ends (FlightCard) and the marks line under it — "6,012 MI FROM HOME · GOLDEN HOUR · SHOT AT
// 7:42 PM". The board viewer, the postcard card and the Sent list all use it, so a clip reads the
// same wherever it hangs. Nothing here is re-encoded: every mark is a name drawn at playback.
//
// A portrait clip makes a portrait card (founder, 2026-11-03: "if vertical video from iphone, can we
// create a vertical postcard? … vertical frames would be nice too"): it stands as tall as the player
// may be and only as wide as itself, centred, and the frame hugs it; a landscape clip fills the width.
//
//   <ClipPlayer src poster filter marks city region country date caption onPlay ariaLabel maxHeight />
import React, { useEffect, useRef, useState } from "react";
import { clipFilterCss } from "@/lib/clipFilters";
import { frameOf, outroOf, flightOf, homeMilesOf, marksLine } from "@/lib/clipMarks";
import ClipFrame from "@/components/passport/ClipFrame";
import StampOutro, { useOutro } from "@/components/passport/StampOutro";
import FlightCard, { useEnded } from "@/components/passport/FlightCard";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const RED = "#B0472F";

// The clip's own shape, { w, h } or null while unknown: read from the poster the moment it loads and
// from the video's metadata — nothing new is stored, so every clip already sent gets it.
function useClipShape(videoRef, src, poster) {
  const [shape, setShape] = useState(null);
  useEffect(() => {
    let live = true;
    setShape(null);
    if (poster) {
      const im = new Image();
      im.onload = () => { if (live && im.naturalWidth > 0 && im.naturalHeight > 0) setShape((s) => s || { w: im.naturalWidth, h: im.naturalHeight }); };
      im.src = poster;
    }
    const el = videoRef.current;
    const meta = () => { if (live && el && el.videoWidth > 0 && el.videoHeight > 0) setShape({ w: el.videoWidth, h: el.videoHeight }); };
    if (el) { meta(); el.addEventListener("loadedmetadata", meta); }
    return () => { live = false; if (el) el.removeEventListener("loadedmetadata", meta); };
  }, [videoRef, src, poster]);
  return shape;
}
// Taller than wide, with a little room so a square stays landscape-laid.
const tallShape = (shape) => !!shape && shape.h > shape.w * 1.05;

export default function ClipPlayer({ src, poster = null, filter = null, marks = null, city = null, region = null, country = null, date = null, caption = null, onPlay = undefined, ariaLabel = undefined, maxHeight = "54vh", radius = 6, keyId = undefined }) {
  const ref = useRef(null);
  const frame = frameOf(marks);
  const stampOn = useOutro(ref, outroOf(marks));
  const endedOn = useEnded(ref, flightOf(marks));
  const shape = useClipShape(ref, src, poster);
  const portrait = tallShape(shape);
  const line = marksLine(marks);
  const box = portrait
    ? { height: maxHeight, width: "auto", maxWidth: "100%", aspectRatio: `${shape.w} / ${shape.h}` }
    : { width: "100%", maxHeight };
  return (
    <ClipFrame frame={frame} fit={portrait} city={city} region={region} country={country} date={date} caption={caption}>
      <div style={{ position: "relative", ...(portrait ? { width: "fit-content", maxWidth: "100%", marginLeft: "auto", marginRight: "auto" } : {}) }}>
        <video ref={ref} key={keyId} src={src} poster={poster || undefined} controls playsInline preload="metadata" onPlay={onPlay} aria-label={ariaLabel}
          style={{ display: "block", ...box, borderRadius: frame ? 0 : radius, background: "#000", filter: clipFilterCss(filter) }} />
        {/* The stamp holds through the last two seconds; when the flight card takes the end, it steps aside. */}
        <StampOutro on={stampOn && !endedOn} city={city} region={region} country={country} date={date} width={portrait ? 160 : 200} />
        <FlightCard on={endedOn} miles={homeMilesOf(marks)} city={city} />
      </div>
      {line.length ? (
        <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: RED, lineHeight: 1.4, ...(portrait ? { width: 0, minWidth: "100%", textAlign: "center" } : {}) }}>{line.join(" · ")}</div>
      ) : null}
    </ClipFrame>
  );
}
