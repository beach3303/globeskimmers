// One clip player for every place a clip plays (2026-11-03): the <video> wearing its look, its frame
// around it (ClipFrame), the verified stamp over its last two seconds (StampOutro), the flight path
// when it ends (FlightCard) and the marks line under it — "6,012 MI FROM HOME · GOLDEN HOUR · SHOT AT
// 7:42 PM". The board viewer, the postcard card and the Sent list all use it, so a clip reads the
// same wherever it hangs. Nothing here is re-encoded: every mark is a name drawn at playback.
//
//   <ClipPlayer src poster filter marks city region country date caption onPlay ariaLabel maxHeight />
import React, { useRef } from "react";
import { clipFilterCss } from "@/lib/clipFilters";
import { frameOf, outroOf, flightOf, homeMilesOf, marksLine } from "@/lib/clipMarks";
import ClipFrame from "@/components/passport/ClipFrame";
import StampOutro, { useOutro } from "@/components/passport/StampOutro";
import FlightCard, { useEnded } from "@/components/passport/FlightCard";

const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const RED = "#B0472F";

export default function ClipPlayer({ src, poster = null, filter = null, marks = null, city = null, region = null, country = null, date = null, caption = null, onPlay = undefined, ariaLabel = undefined, maxHeight = "54vh", radius = 6, keyId = undefined }) {
  const ref = useRef(null);
  const frame = frameOf(marks);
  const stampOn = useOutro(ref, outroOf(marks));
  const endedOn = useEnded(ref, flightOf(marks));
  const line = marksLine(marks);
  return (
    <ClipFrame frame={frame} city={city} region={region} country={country} date={date} caption={caption}>
      <div style={{ position: "relative" }}>
        <video ref={ref} key={keyId} src={src} poster={poster || undefined} controls playsInline preload="metadata" onPlay={onPlay} aria-label={ariaLabel}
          style={{ display: "block", width: "100%", maxHeight, borderRadius: frame ? 0 : radius, background: "#000", filter: clipFilterCss(filter) }} />
        {/* The stamp holds through the last two seconds; when the flight card takes the end, it steps aside. */}
        <StampOutro on={stampOn && !endedOn} city={city} region={region} country={country} date={date} />
        <FlightCard on={endedOn} miles={homeMilesOf(marks)} city={city} />
      </div>
      {line.length ? (
        <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: RED, lineHeight: 1.4 }}>{line.join(" · ")}</div>
      ) : null}
    </ClipFrame>
  );
}
