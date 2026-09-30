// Luggage — "My luggage": the trunk that carries the traveler's earned labels
// (founder, 2026-09-29: passport = proof, trunk = play; realism bar = the
// passport cover). The SKIN auto-upgrades exactly like stamp art: the app asks
// R2 for the photo-real trunk render (docs/TRUNK_RENDER_PROMPT.md is the
// generation kit) and, until that lands, draws its own studio-lit interim —
// uploading trunk-steamer-front-v1.jpg switches every phone with no release.
// Labels are DERIVED from stamps (src/lib/labels.js), composited on top in
// fixed slots that avoid the straps and lock, so they survive skin swaps and
// html2canvas shares. Tap a label for its story; Share renders the trunk into
// the same branded story canvas the passport pages use.
import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { deriveLabels, unseenLabels, markLabelsSeen } from "@/lib/labels";
import { composeShare } from "@/lib/shareCanvas";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";
import LuggageLabel from "@/components/passport/LuggageLabel";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export const TRUNK_SKIN_URL = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/trunk-steamer-front-v1.jpg";

// Label slots on the trunk's front face (fractions of the 680×480 skin box),
// tuned to sit between the straps and clear of the lock plate. Order matters:
// the first labels earned take the best real estate.
const SLOTS = [
  { x: 0.44, y: 0.40, w: 0.29, rot: -6 },   // centre-left, the hero spot
  { x: 0.59, y: 0.66, w: 0.20, rot: 5 },    // lower centre-right
  { x: 0.78, y: 0.33, w: 0.22, rot: -8 },   // upper right panel
  { x: 0.37, y: 0.78, w: 0.145, rot: 7 },   // lower left panel
  { x: 0.155, y: 0.255, w: 0.115, rot: 8 }, // upper left panel
  { x: 0.155, y: 0.62, w: 0.13, rot: -7 },  // mid left
  { x: 0.82, y: 0.80, w: 0.15, rot: 6 },    // lower right corner
  { x: 0.50, y: 0.17, w: 0.17, rot: -4 },   // above the lock, small
];

// The interim skin: the studio-lit trunk from the design spec, drawn inline so
// the feature works before the photo-real render is uploaded.
function InterimTrunk() {
  return (
    <svg viewBox="0 0 680 480" width="100%" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id="lgbody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4A63" /><stop offset=".18" stopColor="#31405A" /><stop offset=".6" stopColor="#26324A" /><stop offset="1" stopColor="#1B2436" />
        </linearGradient>
        <linearGradient id="lgsheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".22" stopColor="#fff" stopOpacity=".10" /><stop offset=".38" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lgwood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A5A38" /><stop offset=".5" stopColor="#6A4C2E" /><stop offset="1" stopColor="#553C22" />
        </linearGradient>
        <linearGradient id="lgstrap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5E4426" /><stop offset=".5" stopColor="#7A5A34" /><stop offset="1" stopColor="#4E3820" />
        </linearGradient>
        <linearGradient id="lgbrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8CE8B" /><stop offset=".45" stopColor="#B9985C" /><stop offset="1" stopColor="#8A6C38" />
        </linearGradient>
        <filter id="lggrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0" /><feComposite operator="over" in2="SourceGraphic" /></filter>
        <filter id="lgwoodg"><feTurbulence type="turbulence" baseFrequency="0.012 0.11" numOctaves="2" seed="9" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.22 0" /><feComposite operator="over" in2="SourceGraphic" /></filter>
      </defs>
      <ellipse cx="340" cy="452" rx="270" ry="20" fill="#000" opacity=".35" />
      <path d="M300,42 q40,-30 80,0" fill="none" stroke="#3E2C16" strokeWidth="15" strokeLinecap="round" />
      <path d="M300,42 q40,-30 80,0" fill="none" stroke="#6E5230" strokeWidth="8" strokeLinecap="round" />
      <g filter="url(#lggrain)"><rect x="70" y="48" width="540" height="392" rx="16" fill="url(#lgbody)" /></g>
      <rect x="70" y="48" width="540" height="392" rx="16" fill="url(#lgsheen)" />
      <rect x="70" y="48" width="540" height="392" rx="16" fill="none" stroke="#101722" strokeWidth="3" />
      <g filter="url(#lgwoodg)">
        <rect x="70" y="122" width="540" height="26" fill="url(#lgwood)" />
        <rect x="70" y="336" width="540" height="26" fill="url(#lgwood)" />
      </g>
      <rect x="70" y="122" width="540" height="3" fill="#9A7A4E" /><rect x="70" y="145" width="540" height="3" fill="#3E2C16" />
      <rect x="70" y="336" width="540" height="3" fill="#9A7A4E" /><rect x="70" y="359" width="540" height="3" fill="#3E2C16" />
      <rect x="168" y="48" width="36" height="392" fill="url(#lgstrap)" />
      <rect x="476" y="48" width="36" height="392" fill="url(#lgstrap)" />
      <g stroke="#D8C49A" strokeWidth="1" strokeDasharray="4 4" opacity=".5"><path d="M175,52 v384 M197,52 v384 M483,52 v384 M505,52 v384" /></g>
      <rect x="164" y="224" width="44" height="34" rx="4" fill="url(#lgbrass)" stroke="#5E4A22" strokeWidth="1.6" />
      <rect x="472" y="224" width="44" height="34" rx="4" fill="url(#lgbrass)" stroke="#5E4A22" strokeWidth="1.6" />
      <path d="M316,48 h48 v34 a24,24 0 0 1 -48,0 z" fill="url(#lgbrass)" stroke="#5E4A22" strokeWidth="1.8" />
      <circle cx="340" cy="70" r="5.5" fill="#3E2E12" /><rect x="337.5" y="73" width="5" height="9" rx="2" fill="#3E2E12" />
      <g stroke="#5E4A22" strokeWidth="1.4">
        <path d="M70,110 v-46 a16,16 0 0 1 16,-16 h46 v20 a42,42 0 0 0 -42,42 z" fill="url(#lgbrass)" />
        <path d="M610,110 v-46 a16,16 0 0 0 -16,-16 h-46 v20 a42,42 0 0 1 42,42 z" fill="url(#lgbrass)" />
        <path d="M70,378 v46 a16,16 0 0 0 16,16 h46 v-20 a42,42 0 0 1 -42,-42 z" fill="url(#lgbrass)" />
        <path d="M610,378 v46 a16,16 0 0 1 -16,16 h-46 v-20 a42,42 0 0 0 42,-42 z" fill="url(#lgbrass)" />
      </g>
    </svg>
  );
}

export default function Luggage({ stamps, readOnly }) {
  const labels = useMemo(() => deriveLabels(stamps), [stamps]);
  const [skinOk, setSkinOk] = useState(true);   // optimistic; onError falls back
  const [story, setStory] = useState(null);     // the tapped label
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);     // { url, dataUrl, blob } two-tap preview
  const trunkRef = useRef(null);

  // The earn toast — once per new label, only on the owner's own passport.
  useEffect(() => {
    if (readOnly || !labels.length) return;
    const fresh = unseenLabels(labels);
    if (fresh.length) {
      showToast(fresh.length === 1 ? `New luggage label: ${fresh[0].big || fresh[0].top} 🧳` : `${fresh.length} new luggage labels 🧳`, "success");
      fresh.forEach((l) => logEvent("passport_label_earned", { label: l.key }, "Passport"));
    }
    markLabelsSeen(labels);
  }, [labels, readOnly]);

  const placed = labels.slice(0, SLOTS.length).map((l, i) => ({ l, s: SLOTS[i] }));

  const renderShare = async () => {
    if (busy || !trunkRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(trunkRef.current, { useCORS: true, backgroundColor: "#241F17", scale: 2, logging: false, imageTimeout: 8000 });
      const img = await composeShare(canvas, "story_meta");
      setShare(img);
      logEvent("passport_share_open", { format: "story", preset: "story_meta", mix: "luggage", target: "unknown" }, "Passport");
    } catch (e) {
      showToast(e?.message || "The trunk could not be rendered", "error");
    }
    setBusy(false);
  };

  const shareNow = async () => {
    if (!share) return;
    const text = "My luggage on Globeskimmers 🧳";
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const w = await Filesystem.writeFile({ path: "globeskimmers-luggage.png", data: String(share.dataUrl).split(",")[1], directory: Directory.Cache });
        const res = await Share.share({ title: "My luggage", text, files: [w.uri] });
        logEvent("passport_share", { format: "story", preset: "story_meta", mix: "luggage", images: 1, via: "app", activity: res?.activityType || null }, "Passport");
        setShare(null); return;
      }
      const files = [new File([share.blob], "globeskimmers-luggage.png", { type: "image/png" })];
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "My luggage", text });
        logEvent("passport_share", { format: "story", preset: "story_meta", mix: "luggage", images: 1, via: "web" }, "Passport");
        setShare(null); return;
      }
      const a = document.createElement("a"); a.href = share.url; a.download = "globeskimmers-luggage.png";
      document.body.appendChild(a); a.click(); a.remove();
      logEvent("passport_share", { format: "story", preset: "story_meta", mix: "luggage", images: 1, via: "download" }, "Passport");
      showToast("Image saved", "success");
    } catch (e) {
      if (e?.name !== "AbortError") showToast(e?.message || "Sharing failed", "error");
      else logEvent("passport_share_cancel", { mix: "luggage" }, "Passport");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 mt-8">
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: "#8A5410" }}>My luggage</div>
          <h3 style={{ fontFamily: SERIF, fontSize: fs(22), color: INK, lineHeight: 1.1 }}>
            {labels.length ? `${labels.length} label${labels.length === 1 ? "" : "s"} on the trunk` : "The trunk travels with you"}
          </h3>
        </div>
        {labels.length > 0 && (
          <button type="button" onClick={renderShare} disabled={busy}
            className="rounded-full px-4 py-2 font-semibold disabled:opacity-60"
            style={{ background: "#0E7C86", color: "#fff", fontSize: fs(12.5), fontFamily: "inherit" }}>
            {busy ? "Rendering…" : "Share"}
          </button>
        )}
      </div>

      <div ref={trunkRef} style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "radial-gradient(120% 100% at 50% 0%, #3A342A 0%, #241F17 62%, #191510 100%)", padding: "14px 10px 8px" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "680 / 480" }}>
          {skinOk ? (
            <img src={TRUNK_SKIN_URL} alt="Your travel trunk" crossOrigin="anonymous" onError={() => setSkinOk(false)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0 }}><InterimTrunk /></div>
          )}
          {placed.map(({ l, s }) => (
            <button key={l.key} type="button" onClick={() => setStory(l)} aria-label={`Label: ${l.big || l.top}. Tap for its story.`}
              style={{ position: "absolute", left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, transform: `translate(-50%, -50%) rotate(${s.rot}deg)`, filter: "drop-shadow(0 3px 2.5px rgba(0,0,0,.5))", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
              <LuggageLabel label={l} uid={l.key} />
            </button>
          ))}
          {!labels.length && (
            <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%) rotate(-4deg)", width: "56%", opacity: .9 }}>
              <div style={{ background: "#F2E9D2", border: "1px solid #DCCFAE", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: "#7A6A45" }}>Labels arrive as you travel —</div>
                <div style={{ fontFamily: SERIF, fontSize: fs(13), color: "#7A6A45" }}>your first stamp brings the first one.</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, marginTop: 6, letterSpacing: ".03em" }}>
        Earned by traveling — never bought. Tap a label for its story.
      </p>

      {/* Label story sheet */}
      {story && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`About this label`}
          style={{ background: "rgba(22,17,13,.45)" }} onClick={() => setStory(null)}>
          <div className="w-full max-w-md rounded-t-[22px] p-5 pb-8" style={{ background: "#FFFCF7" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 120, margin: "0 auto 10px" }}><LuggageLabel label={story} uid={`story-${story.key}`} /></div>
            <div className="text-center">
              <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK }}>{story.big || story.top}</div>
              <p style={{ fontSize: fs(13.5), color: "#3A3128", lineHeight: 1.5, margin: "6px auto 0", maxWidth: "38ch" }}>{story.story}</p>
              {story.earnedOn && (
                <div style={{ fontFamily: MONO, fontSize: fs(10.5), color: INK3, marginTop: 8, letterSpacing: ".06em" }}>
                  EARNED {story.earnedOn}{story.place ? ` · ${String(story.place).toUpperCase()}` : ""}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setStory(null)} className="w-full rounded-[14px] py-2.5 font-semibold mt-4"
              style={{ background: "#fff", color: "#3A3128", border: `1px solid ${RULE}`, fontSize: fs(13.5), fontFamily: "inherit" }}>Close</button>
          </div>
        </div>
      )}

      {/* Two-tap share preview (share() must run inside a tap on WebKit) */}
      {share && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Share my luggage"
          style={{ background: "rgba(22,17,13,.6)" }} onClick={() => setShare(null)}>
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <img src={share.url} alt="Your luggage, ready to share" style={{ width: "100%", borderRadius: 14, boxShadow: "0 18px 40px -20px rgba(0,0,0,.7)" }} />
            <button type="button" onClick={shareNow} className="w-full rounded-[14px] py-3 font-semibold mt-3"
              style={{ background: "#0E7C86", color: "#fff", fontSize: fs(14.5), fontFamily: "inherit" }}>Share my luggage</button>
            <button type="button" onClick={() => setShare(null)} className="w-full rounded-[14px] py-2.5 font-semibold mt-2"
              style={{ background: "#FFFCF7", color: "#3A3128", fontSize: fs(13), fontFamily: "inherit" }}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
