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
import { getShareLink } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";
import LuggageLabel from "@/components/passport/LuggageLabel";
import VirtualLuggage, { buildStickers, LUGGAGE_TYPES } from "@/components/passport/VirtualLuggage";
import { luggageGet } from "@/lib/passport";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const ART_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/luggage";

export default function Luggage({ stamps, readOnly }) {
  const labels = useMemo(() => deriveLabels(stamps), [stamps]);
  const stickers = useMemo(() => buildStickers(stamps), [stamps]);
  const bySid = useMemo(() => Object.fromEntries(stickers.map((x) => [x.sid, x])), [stickers]);
  const [lug, setLug] = useState(null);         // { active, placements } — the real trunk
  const [skinAspect, setSkinAspect] = useState(1);
  useEffect(() => { let gone = false; (async () => { const d = await luggageGet(); if (!gone) setLug(d); })(); return () => { gone = true; }; }, []);
  const activeType = lug?.active || "classic";
  const trunkName = (LUGGAGE_TYPES.find((t) => t.key === activeType) || LUGGAGE_TYPES[0]).name;
  const frontPlaced = lug?.placements?.[activeType]?.front || [];
  const placedTotal = Object.values(lug?.placements?.[activeType] || {}).reduce((n, f) => n + f.length, 0);
  const [story, setStory] = useState(null);     // the tapped label
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);     // { url, dataUrl, blob } two-tap preview
  const [openLug, setOpenLug] = useState(false); // the full walk-around luggage
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
    let shareUrl = null;
    try { const { data: sl } = await getShareLink(); shareUrl = sl?.url || null; } catch { /* fine */ }
    const text = shareUrl ? `My luggage on Globeskimmers 🧳 ${shareUrl}` : "My luggage on Globeskimmers 🧳";
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
            {trunkName}{stickers.length ? ` · ${placedTotal} of ${stickers.length} stickers placed` : ""}
          </h3>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <button type="button" onClick={() => setOpenLug(true)}
              className="rounded-full px-4 py-2 font-semibold"
              style={{ background: "#FFFCF7", color: "#3A3128", border: "1px solid rgba(22,17,13,.14)", fontSize: fs(12.5), fontFamily: "inherit" }}>
              Open 🧳
            </button>
          )}
          {labels.length > 0 && (
            <button type="button" onClick={renderShare} disabled={busy}
              className="rounded-full px-4 py-2 font-semibold disabled:opacity-60"
              style={{ background: "#0E7C86", color: "#fff", fontSize: fs(12.5), fontFamily: "inherit" }}>
              {busy ? "Rendering…" : "Share"}
            </button>
          )}
        </div>
      </div>

      <div ref={trunkRef} style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "radial-gradient(120% 100% at 50% 0%, #3A342A 0%, #241F17 62%, #191510 100%)", padding: "14px 10px 10px" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: `1 / ${skinAspect}` }}>
          <img src={`${ART_BASE}/${activeType}/front.webp`} alt={`${trunkName} — your travel trunk`} crossOrigin="anonymous"
            onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth > 0) setSkinAspect(Math.min(1.35, Math.max(0.45, im.naturalHeight / im.naturalWidth))); }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          {frontPlaced.map((pl) => {
            const st = bySid[pl.sid];
            if (!st) return null;
            return (
              <button key={pl.sid} type="button" onClick={() => st.label?.story && setStory(st.label)} aria-label={`Sticker: ${st.label.top || st.label.big}`}
                style={{ position: "absolute", left: `${pl.x * 100}%`, top: `${pl.y * 100}%`, width: `${((st.w || 92) * pl.scale / 340) * 100}%`, transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`, filter: "drop-shadow(0 3px 2.5px rgba(0,0,0,.5))", background: "none", border: 0, padding: 0, cursor: "pointer", zIndex: 10 + (pl.z || 0) }}>
                <LuggageLabel label={st.label} uid={`bn-${pl.sid.replace(/[^a-z0-9]/gi, "")}`} />
              </button>
            );
          })}
          {!frontPlaced.length && stickers.length > 0 && (
            <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%) rotate(-4deg)", width: "60%", opacity: .92 }}>
              <div style={{ background: "#F2E9D2", border: "1px solid #DCCFAE", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: "#7A6A45" }}>{stickers.length} sticker{stickers.length === 1 ? "" : "s"} earned —</div>
                <div style={{ fontFamily: SERIF, fontSize: fs(13), color: "#7A6A45" }}>open the trunk to place them.</div>
              </div>
            </div>
          )}
          {!stickers.length && (
            <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%) rotate(-4deg)", width: "60%", opacity: .92 }}>
              <div style={{ background: "#F2E9D2", border: "1px solid #DCCFAE", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(15), color: "#7A6A45" }}>Stickers arrive as you travel —</div>
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

      {/* The walk-around trunk: six styles, five faces, hand-placed stickers */}
      {openLug && <VirtualLuggage stamps={stamps} onClose={() => setOpenLug(false)} />}
    </div>
  );
}
