// PhotoPackets — the envelopes of prints, one per destination (founder,
// 2026-09-29: "for your people: the photo packet"). A horizontal shelf of
// kraft envelopes — the first photo peeks out of the flap, the label reads
// ATLANTA · 34 PRINTS · SEP 25–28 — and tapping one opens the shared
// PhotoLightbox to flip through. Derived entirely from the stamps the parent
// already holds (src/lib/packets.js), so the friend view is automatically
// moderation-safe and the owner view is instant.
import React, { useMemo, useState } from "react";
import { derivePackets } from "@/lib/packets";
import PhotoLightbox from "@/components/finder/PhotoLightbox";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK3 = "#736657";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

function Envelope({ packet, onOpen }) {
  const peek = packet.photos[0]?.src;
  return (
    <button type="button" onClick={onOpen} aria-label={`Open the ${packet.city} photo packet — ${packet.photos.length} prints`}
      className="flex-none active:scale-95 transition-transform" style={{ width: 176 }}>
      <div style={{ position: "relative", height: 128 }}>
        {/* prints peeking out -->*/}
        {peek && (
          <div aria-hidden style={{ position: "absolute", left: 14, right: 14, top: 0, height: 78, borderRadius: 6, background: `#8FB2C8 url("${String(peek).replace(/"/g, "%22")}") center/cover no-repeat`, transform: "rotate(-3deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }} />
        )}
        {packet.photos[1] && (
          <div aria-hidden style={{ position: "absolute", left: 26, right: 6, top: 6, height: 70, borderRadius: 6, background: `#D9C9A8 url("${String(packet.photos[1].src).replace(/"/g, "%22")}") center/cover no-repeat`, transform: "rotate(4deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.15)", zIndex: 0 }} />
        )}
        {/* the envelope */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 82, borderRadius: 10, background: "linear-gradient(180deg,#EBDDB6,#E2D1A4)", border: "1.5px solid #C9B583", boxShadow: "0 4px 10px -6px rgba(0,0,0,.3)", zIndex: 2 }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 0, borderLeft: "88px solid transparent", borderRight: "88px solid transparent", borderTop: "26px solid rgba(201,181,131,.55)" }} />
          <div className="absolute inset-x-0 bottom-2 text-center px-2">
            <div className="truncate" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs(15), color: "#6B4F1E", letterSpacing: ".04em" }}>{packet.city.toUpperCase()}</div>
            <div style={{ fontFamily: MONO, fontSize: fs(8.5), color: "#8A6E33", letterSpacing: ".14em" }}>
              {packet.photos.length} PRINT{packet.photos.length === 1 ? "" : "S"}{packet.range ? ` · ${packet.range.toUpperCase()}` : ""}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PhotoPackets({ stamps, title = "Photo packets" }) {
  const packets = useMemo(() => derivePackets(stamps), [stamps]);
  const [open, setOpen] = useState(null); // { photos, index, city }
  if (!packets.length) return null;
  return (
    <div className="max-w-md mx-auto px-4 mt-8">
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>{title}</div>
      <div style={{ fontFamily: SERIF, fontSize: fs(22), color: "#16110D", lineHeight: 1.1 }}>Prints from every place</div>
      <div className="flex gap-3 overflow-x-auto pt-3 pb-2" style={{ scrollbarWidth: "none" }}>
        {packets.map((p) => (
          <Envelope key={p.key} packet={p} onOpen={() => setOpen({ photos: p.photos, index: 0, city: p.city, range: p.range })} />
        ))}
      </div>
      <p style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, letterSpacing: ".03em" }}>Every destination gathers your memory photos on its own.</p>
      {open && (
        <PhotoLightbox
          photos={open.photos}
          index={open.index}
          onClose={() => setOpen(null)}
          onIndexChange={(i) => setOpen((o) => (o ? { ...o, index: i } : o))}
          title={open.city}
          credit={open.range || undefined}
        />
      )}
    </div>
  );
}
