// Luggage — "My luggage": the trunk that carries the traveler's earned labels
// (founder, 2026-09-29: passport = proof, trunk = play; realism bar = the
// passport cover). The SKIN auto-upgrades exactly like stamp art: the app asks
// R2 for the photo-real trunk render (docs/TRUNK_RENDER_PROMPT.md is the
// generation kit), so uploading a new front.webp switches every phone with no
// release. Labels are DERIVED from stamps (src/lib/labels.js), composited on top
// in normalized slots that avoid the straps and lock, so they survive skin swaps
// and html2canvas shares. Tap a label for its story; Share renders the trunk
// into the same branded story canvas the passport pages use.
//
// Two looks:
//   (legacy)  the dark bezel with its header, as the Passport page has shown it.
//   'card'    the new look (Profile.dc.html L39-60, Profile-Visit L39-57): a white
//             hairline card that rests on the cover band, the render cropped to a
//             280x176 window (object-position 50% 39%), stickers remapped onto
//             that crop by cardSpot(), the render's studio backdrop rounded like a
//             print. The shared story image keeps the dark
//             bezel: it is drawn off-screen only while Share renders.
//
//   <Luggage stamps readOnly variant cloth luggage onLuggageChanged ownerFlags
//            ownerFirst className style />
//   stamps            passport rows; null while they load (no counts, no notes).
//   readOnly          someone else's trunk: no Open, no Share, no earn toast, and
//                     never the viewer's flags. Without a luggage prop it renders
//                     nothing (it would otherwise read the VIEWER's placements).
//   luggage           { active, placements } from /luggage/get, loaded once by the
//                     page; null while it loads; leave it out and the owner's trunk
//                     reads its own.
//   onLuggageChanged  called when the walk-around trunk closes (read it again).
//   ownerFlags        whose home flags ride the trunk ({ home_country,
//                     home_city_country }); the owner's profile by default.
//   ownerFirst        a visit's kicker: 'KENJI’S LUGGAGE · 3 OF 3 PLACED'.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { deriveLabels, unseenLabels, markLabelsSeen } from "@/lib/labels";
import { composeShare } from "@/lib/shareCanvas";
import { getShareLink, luggageGet } from "@/lib/passport";
import { showToast } from "@/components/Toast";
import { logEvent } from "@/lib/analytics";
import LuggageLabel from "@/components/passport/LuggageLabel";
import VirtualLuggage, { buildStickers, indexStickers, LUGGAGE_TYPES } from "@/components/passport/VirtualLuggage";
import { useAuth } from "@/lib/AuthContext";
import { NEUTRAL, fs, rgba } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = NEUTRAL.ink, INK2 = NEUTRAL.ink2, INK3 = NEUTRAL.ink3, RULE = "rgba(22,17,13,.12)";

const ART_BASE = "https://globeskimmers-api.maizasimeon.workers.dev/stamp-art/luggage";

// Founder, 2026-10-30: "remove my luggage from all of users and … from future users." The trunk is
// off every page (Profile, a traveler's page, the share). The code, the art on R2, the worker's
// /luggage routes and each member's luggage_state row stay, so it can come back with one flag.
// Its story is recorded in docs/PLANS.md (Virtual Luggage).
export const SHOW_LUGGAGE = false;

// The card's window onto the render (Profile L44-45).
const CARD_W = 280, CARD_H = 176, CROP_X = 0.5, CROP_Y = 0.39;
const CAPTURE_W = 360; // the off-screen bezel the story image is drawn from

const clampAspect = (a) => Math.min(1.35, Math.max(0.45, a));

/**
 * Where a placement on the full render lands in the card's cropped window, as fractions
 * of that window: { x, y } is the sticker's centre, w its width. The render is drawn with
 * object-fit: cover and object-position 50% 39%, so with matching widths
 * y' = (y·W·a − (W·a − H)·0.39) / H, where a is the render's height over its width.
 * @param {{ x: number, y: number, scale?: number }} pl
 * @param {number} aspect
 * @param {number} [stickerW]  the sticker's width on the editor's 340 grid
 */
export function cardSpot(pl, aspect, stickerW = 92) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const k = (a * CARD_W) / CARD_H; // the render's height over the window's, widths matched
  const w = ((stickerW || 92) * (pl.scale || 1)) / 340;
  if (k >= 1) return { x: pl.x, y: pl.y * k - (k - 1) * CROP_Y, w };
  const kx = 1 / k; // a render wider than the window: heights match, the sides crop
  return { x: pl.x * kx - (kx - 1) * CROP_X, y: pl.y, w: w * kx };
}

// Every image under root has loaded or failed (8s at most).
const imagesReady = (root) => Promise.all([...(root?.querySelectorAll("img") || [])].map((im) => (
  im.complete ? null : new Promise((res) => {
    im.addEventListener("load", res, { once: true });
    im.addEventListener("error", res, { once: true });
    setTimeout(res, 8000);
  })
)));
const nextFrame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
// The sheets render on <body>: the card sits in its own layer above the cover, and a
// sheet inside it would sit under the folders that follow.
const onBody = (node) => (typeof document !== "undefined" ? createPortal(node, document.body) : node);

// A cloth darkened toward black, for the visit card's tinted shadow (Profile-Visit L39).
function shadeOf(hex, f = 0.4) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "rgba(12,24,36,.5)";
  const n = parseInt(m[1], 16);
  return `rgba(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)},.5)`;
}

// The cream note lying across an empty trunk.
function TrunkNote({ lines, size = 15 }) {
  return (
    <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%) rotate(-4deg)", width: "60%", opacity: .92, pointerEvents: "none" }}>
      <div style={{ background: "#F2E9D2", border: "1px solid #DCCFAE", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fs(size), lineHeight: 1.2, color: "#7A6A45" }}>{lines[0]}</div>
        <div style={{ fontFamily: SERIF, fontSize: fs(size - 2), lineHeight: 1.2, color: "#7A6A45", marginTop: 2 }}>{lines[1]}</div>
      </div>
    </div>
  );
}

// The dark bezel with the whole front face: the legacy look, and the story image.
// live: stickers are buttons (the legacy trunk); off-screen they are plain marks.
function TrunkStage({ stageRef = null, src, alt, aspect, onAspect, placed, bySid, onStory = null, live = false, note = null }) {
  return (
    <div ref={stageRef} style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "radial-gradient(120% 100% at 50% 0%, #3A342A 0%, #241F17 62%, #191510 100%)", padding: "14px 10px 10px" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: `1 / ${aspect}` }}>
        <img src={src} alt={alt} crossOrigin="anonymous"
          onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth > 0) onAspect(clampAspect(im.naturalHeight / im.naturalWidth)); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        {placed.map((pl) => {
          const st = bySid[pl.sid];
          if (!st) return null;
          const at = { position: "absolute", left: `${pl.x * 100}%`, top: `${pl.y * 100}%`, width: `${((st.w || 92) * pl.scale / 340) * 100}%`, transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`, filter: "drop-shadow(0 3px 2.5px rgba(0,0,0,.5))", zIndex: 10 + (pl.z || 0) };
          const art = <LuggageLabel label={st.label} uid={`${live ? "bn" : "cap"}-${pl.sid.replace(/[^a-z0-9]/gi, "")}`} />;
          return live ? (
            <button key={pl.sid} type="button" onClick={() => st.label?.story && onStory?.(st.label)} aria-label={`Sticker: ${st.label.top || st.label.big}`}
              style={{ ...at, background: "none", border: 0, padding: 0, cursor: "pointer" }}>
              {art}
            </button>
          ) : <div key={pl.sid} style={at}>{art}</div>;
        })}
        {note}
      </div>
    </div>
  );
}

export default function Luggage({
  stamps,
  readOnly = false,
  variant = undefined,
  cloth = undefined,
  luggage = undefined,
  onLuggageChanged = undefined,
  ownerFlags = undefined,
  ownerFirst = null,
  className = undefined,
  style = undefined,
}) {
  const { profile } = useAuth();
  const card = variant === "card";
  const given = luggage !== undefined;
  const c = clothRow(cloth);
  // A visitor's flags never land on someone else's trunk.
  const owner = readOnly ? (ownerFlags || null) : (ownerFlags || profile);
  const stampsReady = Array.isArray(stamps);
  const labels = useMemo(() => deriveLabels(stampsReady ? stamps : []), [stamps, stampsReady]);
  const stickers = useMemo(() => buildStickers(stampsReady ? stamps : [], owner), [stamps, stampsReady, owner]);
  const bySid = useMemo(() => indexStickers(stickers, stampsReady ? stamps : []), [stickers, stamps, stampsReady]);

  // The owner's trunk reads itself when the page doesn't hand it one.
  const [ownLug, setOwnLug] = useState(null);
  const [readTick, setReadTick] = useState(0);
  useEffect(() => {
    if (given || readOnly) return undefined;
    let gone = false;
    (async () => { const d = await luggageGet(); if (!gone) setOwnLug(d); })();
    return () => { gone = true; };
  }, [given, readOnly, readTick]);
  const lug = given ? luggage : ownLug;

  const [skinAspect, setSkinAspect] = useState(1);
  const [story, setStory] = useState(null);     // the tapped label
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);     // { url, dataUrl, blob } two-tap preview
  const [openLug, setOpenLug] = useState(false); // the full walk-around luggage
  const [capturing, setCapturing] = useState(false);
  const trunkRef = useRef(null);
  const captureRef = useRef(null);

  // The earn toast: once per new label, only on the owner's own trunk.
  useEffect(() => {
    if (readOnly || !labels.length) return;
    const fresh = unseenLabels(labels);
    if (fresh.length) {
      showToast(fresh.length === 1 ? `New luggage label: ${fresh[0].big || fresh[0].top}` : `${fresh.length} new luggage labels`, "success");
      fresh.forEach((l) => logEvent("passport_label_earned", { label: l.key }, "Passport"));
    }
    markLabelsSeen(labels);
  }, [labels, readOnly]);

  const snap = async (node) => {
    try {
      const canvas = await html2canvas(node, { useCORS: true, backgroundColor: "#241F17", scale: 2, logging: false, imageTimeout: 8000 });
      // Founder (2026-10-05): a luggage share says "My Virtual Luggage", never "passport".
      const img = await composeShare(canvas, "story_meta", "My Virtual Luggage");
      setShare(img);
      logEvent("passport_share_open", { format: "story", preset: "story_meta", mix: "luggage", target: "unknown" }, "Passport");
    } catch (e) {
      showToast(e?.message || "The trunk could not be rendered", "error");
    }
  };

  const renderShare = async () => {
    if (busy) return;
    setBusy(true);
    // The card shows a crop; the story image is the whole trunk on its dark bezel,
    // drawn off-screen for the capture below.
    if (card) { setCapturing(true); return; }
    if (trunkRef.current) await snap(trunkRef.current);
    setBusy(false);
  };

  useEffect(() => {
    if (!capturing) return undefined;
    let gone = false;
    (async () => {
      await imagesReady(captureRef.current);
      await nextFrame();
      if (gone) return;
      if (captureRef.current) await snap(captureRef.current);
      if (!gone) { setCapturing(false); setBusy(false); }
    })();
    return () => { gone = true; };
  }, [capturing]);

  const shareNow = async () => {
    if (!share) return;
    let shareUrl = null;
    try { const { data: sl } = await getShareLink(); shareUrl = sl?.url || null; } catch { /* fine */ }
    const text = shareUrl ? `My virtual luggage on Globeskimmers 🧳 ${shareUrl}` : "My virtual luggage on Globeskimmers 🧳";
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const w = await Filesystem.writeFile({ path: "globeskimmers-luggage.png", data: String(share.dataUrl).split(",")[1], directory: Directory.Cache });
        const res = await Share.share({ title: "My virtual luggage", text, files: [w.uri] });
        logEvent("passport_share", { format: "story", preset: "story_meta", mix: "luggage", images: 1, via: "app", activity: res?.activityType || null }, "Passport");
        setShare(null); return;
      }
      const files = [new File([share.blob], "globeskimmers-luggage.png", { type: "image/png" })];
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "My virtual luggage", text });
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

  const closeTrunk = () => {
    setOpenLug(false);
    if (typeof onLuggageChanged === "function") onLuggageChanged();
    else if (!given) setReadTick((n) => n + 1);
  };

  // Someone else's trunk needs their luggage; without it this would read the viewer's.
  if (readOnly && !given) return null;

  const activeType = lug?.active || "classic";
  const trunkName = (LUGGAGE_TYPES.find((t) => t.key === activeType) || LUGGAGE_TYPES[0]).name;
  const faces = lug?.placements?.[activeType] || {};
  const frontPlaced = (Array.isArray(faces.front) ? faces.front : []).filter((pl) => bySid[pl.sid]);
  // Placed on this trunk, counted once per real sticker (a retired plane id resolves to its flag).
  const placedTotal = new Set(Object.values(faces).flatMap((f) => (Array.isArray(f) ? f : []))
    .map((pl) => bySid[pl.sid]?.sid).filter(Boolean)).size;
  const loaded = stampsReady && !!lug;
  const src = `${ART_BASE}/${activeType}/front.webp`;
  const alt = readOnly
    ? `${trunkName}${ownerFirst ? `, ${ownerFirst}’s travel trunk` : ", a travel trunk"}`
    : `${trunkName}, your travel trunk`;

  const dialogs = (
    <>
      {/* Label story sheet */}
      {story && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="About this label"
          style={{ background: "rgba(22,17,13,.45)" }} onClick={() => setStory(null)}>
          <div className="w-full max-w-md rounded-t-[22px] p-5 pb-8" style={{ background: NEUTRAL.ivory }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 120, margin: "0 auto 10px" }}><LuggageLabel label={story} uid={`story-${story.key}`} /></div>
            <div className="text-center">
              <div style={{ fontFamily: SERIF, fontSize: fs(21), color: INK }}>{story.big || story.top}</div>
              <p style={{ fontSize: fs(13.5), color: INK2, lineHeight: 1.5, margin: "6px auto 0", maxWidth: "38ch" }}>{story.story}</p>
              {story.earnedOn && (
                <div style={{ fontFamily: MONO, fontSize: fs(10.5), color: INK3, marginTop: 8, letterSpacing: ".06em" }}>
                  EARNED {story.earnedOn}{story.place ? ` · ${String(story.place).toUpperCase()}` : ""}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setStory(null)} className="w-full rounded-[14px] font-semibold mt-4"
              style={{ minHeight: 44, background: NEUTRAL.white, color: INK2, border: `1px solid ${RULE}`, fontSize: fs(13.5), fontFamily: "inherit" }}>Close</button>
          </div>
        </div>
      )}

      {/* Two-tap share preview (share() must run inside a tap on WebKit) */}
      {share && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Share my virtual luggage"
          style={{ background: "rgba(22,17,13,.6)" }} onClick={() => setShare(null)}>
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <img src={share.url} alt="Your luggage, ready to share" style={{ width: "100%", borderRadius: 14, boxShadow: "0 18px 40px -20px rgba(0,0,0,.7)" }} />
            <button type="button" onClick={shareNow} className="w-full rounded-[14px] font-semibold mt-3"
              style={{ minHeight: 48, background: card ? c.cloth : NEUTRAL.brandTeal, color: NEUTRAL.white, fontSize: fs(14.5), fontFamily: "inherit" }}>Share my virtual luggage</button>
            <button type="button" onClick={() => setShare(null)} className="w-full rounded-[14px] font-semibold mt-2"
              style={{ minHeight: 44, background: NEUTRAL.ivory, color: INK2, fontSize: fs(13), fontFamily: "inherit" }}>Not now</button>
          </div>
        </div>
      )}

      {/* The walk-around trunk: six styles, five faces, hand-placed stickers */}
      {openLug && <VirtualLuggage stamps={stampsReady ? stamps : []} profile={owner} onClose={closeTrunk} />}
    </>
  );

  if (card) {
    const first = String(ownerFirst ?? "").trim();
    const whose = first ? `${first.toUpperCase()}’S LUGGAGE` : readOnly ? "THEIR LUGGAGE" : "MY LUGGAGE";
    const n = stickers.length;
    const tail = !loaded || !n ? ""
      : placedTotal > 0 ? ` · ${Math.min(placedTotal, n)} OF ${n} PLACED`
      : readOnly ? "" : ` · ${n} STICKER${n === 1 ? "" : "S"} TO PLACE`;
    const m = /^(The\s+)(.+)$/.exec(trunkName);
    const pill = { display: "flex", alignItems: "center", height: 40, padding: "0 12px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${rgba(c.cloth, 0.35)}`, fontSize: fs(13), fontWeight: 600, color: c.cloth, whiteSpace: "nowrap" };
    const hit = { display: "flex", alignItems: "center", minHeight: 44, padding: 0, background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit" };
    return (
      <section aria-label={first ? `${first}’s luggage` : readOnly ? "Their luggage" : "My luggage"} className={className}
        style={{ position: "relative", zIndex: 1, padding: "12px 16px", background: NEUTRAL.white, border: `1px solid ${NEUTRAL.creamRule}`, borderRadius: 18, boxShadow: `0 14px 28px -20px ${readOnly ? shadeOf(c.cloth) : rgba(NEUTRAL.trunkShadow, 0.5)}`, "--gs-focus": c.cloth, ...style }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8, minHeight: 44 }}>
          <div style={{ minWidth: 0, flex: "1 1 150px" }}>
            <div style={{ fontFamily: MONO, fontSize: fs(10), lineHeight: 1.4, fontWeight: 500, letterSpacing: ".12em", color: INK3, overflowWrap: "anywhere" }}>{whose}{tail}</div>
            <h2 style={{ margin: "4px 0 0", fontFamily: SERIF, fontSize: fs(22), lineHeight: 26 / 22, fontWeight: 400, color: INK }}>
              {m ? <>{m[1]}<em style={{ fontStyle: "italic", color: c.cloth }}>{m[2]}</em></> : <em style={{ fontStyle: "italic", color: c.cloth }}>{trunkName}</em>}
            </h2>
          </div>
          {!readOnly && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button type="button" onClick={() => setOpenLug(true)} aria-label="Open my luggage" style={hit}><span style={pill}>Open</span></button>
              {loaded && placedTotal > 0 && (
                <button type="button" onClick={renderShare} aria-disabled={busy || undefined} aria-busy={busy || undefined} aria-label="Share my luggage" style={{ ...hit, cursor: busy ? "progress" : "pointer" }}>
                  <span style={pill}>{busy ? "Rendering…" : "Share"}</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="w-[280px] max-w-full md:w-[400px]" style={{ position: "relative", aspectRatio: `${CARD_W} / ${CARD_H}`, margin: "8px auto 0" }}>
          <img src={src} alt={alt} crossOrigin="anonymous"
            onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth > 0) setSkinAspect(clampAspect(im.naturalHeight / im.naturalWidth)); }}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: `${CROP_X * 100}% ${CROP_Y * 100}%`, borderRadius: 12 }} />
          {frontPlaced.map((pl) => {
            const st = bySid[pl.sid];
            const at = cardSpot(pl, skinAspect, st.w);
            return (
              <button key={pl.sid} type="button" onClick={() => st.label?.story && setStory(st.label)} aria-label={`Sticker: ${st.label.top || st.label.big}`}
                style={{ position: "absolute", left: `${at.x * 100}%`, top: `${at.y * 100}%`, width: `${at.w * 100}%`, transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`, filter: "drop-shadow(0 3px 2.5px rgba(0,0,0,.45))", background: "none", border: 0, padding: 0, cursor: "pointer", zIndex: 10 + (pl.z || 0) }}>
                {/* a 44px reach around a small sticker */}
                <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: 44, height: 44, transform: "translate(-50%, -50%)" }} />
                <LuggageLabel label={st.label} uid={`cd-${pl.sid.replace(/[^a-z0-9]/gi, "")}`} />
              </button>
            );
          })}
          {loaded && !readOnly && placedTotal === 0 && stickers.length > 0 && (
            <TrunkNote size={14} lines={[`${stickers.length} sticker${stickers.length === 1 ? "" : "s"} earned.`, "Open the trunk to place them."]} />
          )}
          {loaded && !readOnly && !stickers.length && (
            <TrunkNote size={14} lines={["Stickers arrive as you travel.", "Your first stamp brings the first one."]} />
          )}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: fs(12), lineHeight: 16 / 12, color: INK3 }}>
          Earned by traveling, never bought. Tap a label for its story.
        </p>
        {capturing && (
          <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, width: CAPTURE_W, pointerEvents: "none" }}>
            <TrunkStage stageRef={captureRef} src={src} alt="" aspect={skinAspect} onAspect={setSkinAspect} placed={frontPlaced} bySid={bySid} />
          </div>
        )}
        {onBody(dialogs)}
      </section>
    );
  }

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
              style={{ background: NEUTRAL.ivory, color: INK2, border: "1px solid rgba(22,17,13,.14)", fontSize: fs(12.5), fontFamily: "inherit" }}>
              Open
            </button>
          )}
          {labels.length > 0 && (
            <button type="button" onClick={renderShare} disabled={busy}
              className="rounded-full px-4 py-2 font-semibold disabled:opacity-60"
              style={{ background: NEUTRAL.brandTeal, color: NEUTRAL.white, fontSize: fs(12.5), fontFamily: "inherit" }}>
              {busy ? "Rendering…" : "Share"}
            </button>
          )}
        </div>
      </div>

      <TrunkStage stageRef={trunkRef} src={src} alt={alt} aspect={skinAspect} onAspect={setSkinAspect}
        placed={frontPlaced} bySid={bySid} onStory={setStory} live
        note={!frontPlaced.length && stickers.length > 0
          ? <TrunkNote lines={[`${stickers.length} sticker${stickers.length === 1 ? "" : "s"} earned.`, "Open the trunk to place them."]} />
          : !stickers.length && stampsReady
            ? <TrunkNote lines={["Stickers arrive as you travel.", "Your first stamp brings the first one."]} />
            : null} />
      <p style={{ fontFamily: MONO, fontSize: fs(10), color: INK3, marginTop: 6, letterSpacing: ".03em" }}>
        Earned by traveling, never bought. Tap a label for its story.
      </p>
      {onBody(dialogs)}
    </div>
  );
}
