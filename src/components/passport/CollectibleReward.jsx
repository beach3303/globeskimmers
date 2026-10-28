// CollectibleReward — the moment the collectible stamp is earned (founder, 2026-10-28: "make it
// sound exciting … show user what stamp looks like … they can dismiss the pop up, place the stamp
// in the passport … say thank you for contributing to City Boards … allow user to make the stamp
// private or public"). 10 photos shared with City Boards, from 3 different cities, earn ONE of six
// designs at random, three titles: Official Traveler, Certified Explorer, Adventure Pro
// (src/lib/collectibles.js). It's theirs for good and can't be exchanged for another.
//
// The stamp swings in with a little confetti (none with Reduce Motion), the title, a thank-you,
// who it shows to (the four words, greyed above the passport's own setting), "Place it in my
// passport" (its first page) and "Not now" — an unplaced stamp waits in Contribute to City Boards.
// Opened again (fresh = false), it places it, changes who sees it, or takes it off the page.
// CollectibleNudge (below) is the "so close" card for 10 photos from fewer than 3 cities.
//
//   <CollectibleReward item fresh onClose onSaved />
//   item     the worker's row: { id, badge, title, milestone, placed, visibility, cities? }
//   onSaved(item) after it is placed, moved or taken off
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { showToast } from "@/components/Toast";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { AirmailChevron } from "@/components/redesign/ornaments";
import { useDismissable } from "@/lib/dismissStack";
import { logEvent } from "@/lib/analytics";
import { AUDIENCES, aboveCeiling, capTo, usePassportAudience } from "@/lib/audience";
import { PRIVACY_TONE } from "@/components/privacy/PrivacyChip";
import { COLLECTIBLES, collectibleOf, withArticle, placeCollectible, removeCollectible } from "@/lib/collectibles";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const NAVY = "#0C2B50", GOLD = "#C9A227", RED = "#B0472F", BLUE = "#1F4E8C";
const CONFETTI = [GOLD, "#E8CC86", BLUE, RED, "#2E6B4E", "#FFFFFF"];

export default function CollectibleReward({ item, fresh = true, onClose, onSaved = undefined }) {
  const reduce = useReducedMotion();
  const art = collectibleOf(item?.badge);
  const [ceiling] = usePassportAudience(true);
  const [level, setLevel] = useState(item?.visibility || null);
  const [busy, setBusy] = useState(null);   // 'place' | 'remove' while saving
  const close = () => { if (!busy) onClose(); };
  useDismissable(true, close);
  // Until the member picks, it starts as far as their passport goes (the ceiling).
  useEffect(() => { if (!level && ceiling) setLevel(ceiling); }, [ceiling, level]);
  useEffect(() => { if (fresh && item) logEvent("collectible_reward_shown", { badge: item.badge, milestone: item.milestone }, "Profile"); }, [fresh, item]);
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    x: (i * 37) % 100, d: 0.15 + ((i * 13) % 10) / 22, r: ((i * 53) % 360) - 180, c: CONFETTI[i % CONFETTI.length], w: 6 + (i % 3) * 2, drift: ((i * 29) % 40) - 20,
  })), []);
  if (!item || !art) return null;

  const placed = !!item.placed;
  const shown = level ? capTo(level, ceiling) : null;
  const save = async () => {
    if (busy || !shown) return;
    setBusy("place");
    const r = await placeCollectible(item.id, shown);
    setBusy(null);
    if (!r.ok) { showToast(r.error || "Couldn’t place it — try again", "error"); return; }
    logEvent("collectible_placed", { badge: item.badge, visibility: shown, fresh }, "Profile");
    showToast(placed ? "Saved" : `${item.title} is on your passport’s first page 🎉`, "success");
    onSaved?.(r.item);
    onClose();
  };
  const remove = async () => {
    if (busy) return;
    setBusy("remove");
    const r = await removeCollectible(item.id);
    setBusy(null);
    if (!r.ok) { showToast(r.error || "Couldn’t take it out — try again", "error"); return; }
    showToast("Taken off your passport. It’s still yours.", "success");
    onSaved?.(r.item);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10030, background: "rgba(7,27,51,.72)", padding: 16 }} onClick={(e) => { e.stopPropagation(); close(); }}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="cb-reward-h" onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduce ? 0.15 : 0.35, ease: "easeOut" }}
        className="w-full overflow-y-auto" style={{ position: "relative", maxWidth: 400, maxHeight: "94vh", background: NEUTRAL.ivory, borderRadius: 24, boxShadow: "0 24px 60px -20px rgba(0,0,0,.55)" }}>
        <AirmailChevron height={5} />
        <button type="button" onClick={close} aria-label="Close"
          style={{ position: "absolute", top: 8, right: 6, width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", border: 0, color: NEUTRAL.ink2, zIndex: 2 }}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <div style={{ padding: "16px 20px calc(20px + env(safe-area-inset-bottom))", textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: RED, padding: "0 28px", textWrap: "balance" }}>
            {fresh ? "Thank you for contributing to City Boards!" : "Collectible stamp"}
          </div>
          <h2 id="cb-reward-h" style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: fs(fresh ? 31 : 27), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>
            {fresh ? <>You’re {withArticle(item.title).split(" ")[0]} <em style={{ color: BLUE }}>{item.title}</em>!</> : item.title}
          </h2>
          {fresh ? (
            <p style={{ margin: "8px auto 0", maxWidth: 320, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
              {item.milestone} photos{item.cities ? ` from ${item.cities} cities` : ""}, shared with travelers everywhere. This collectible stamp is yours to keep, even if you delete the photos.
            </p>
          ) : null}

          {/* The stamp: swings in, with a gold glow and one sweep of light across it. */}
          <div style={{ position: "relative", width: "min(250px, 66vw)", margin: "14px auto 4px", aspectRatio: "1 / 1.08", display: "grid", placeItems: "center" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: "4%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,204,134,.75) 0%, rgba(232,204,134,.25) 45%, rgba(232,204,134,0) 70%)" }} />
            <motion.div initial={fresh && !reduce ? { scale: 0.3, rotate: -18, opacity: 0 } : false} animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 13, delay: 0.15 }}
              style={{ position: "relative", width: "100%", height: "100%" }}>
              <img src={art.art} alt={`${item.title} collectible stamp`} draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 10px 14px rgba(7,27,51,.35))" }} />
              {fresh && !reduce ? (
                <motion.div aria-hidden="true" initial={{ x: "-120%" }} animate={{ x: "120%" }} transition={{ duration: 1.1, delay: 0.9, ease: "easeInOut" }}
                  style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 65%)",
                    WebkitMaskImage: `url(${art.art})`, maskImage: `url(${art.art})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
              ) : null}
            </motion.div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".16em", textTransform: "uppercase", color: NEUTRAL.ink3 }}>
            Collectible stamp · {item.title}
          </div>

          {/* Who sees it in the passport: the four words, the passport's ceiling greyed. */}
          <fieldset style={{ margin: "16px 0 0", padding: 0, border: 0, textAlign: "left" }}>
            <legend style={{ fontSize: fs(13), fontWeight: 650, color: NEUTRAL.ink, marginBottom: 6 }}>Who sees it in your passport</legend>
            <div role="radiogroup" aria-label="Who sees it in your passport" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {AUDIENCES.map((a) => {
                const off = aboveCeiling(a.key, ceiling);
                const on = shown === a.key;
                const t = PRIVACY_TONE[a.key];
                return (
                  <button key={a.key} type="button" role="radio" aria-checked={on} aria-disabled={off || undefined} disabled={off || !!busy}
                    onClick={() => setLevel(a.key)}
                    style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "6px 10px", borderRadius: 12, textAlign: "left",
                      background: on ? t.bg : "#fff", border: `1.5px solid ${on ? t.ink : "rgba(22,17,13,.12)"}`, color: on ? t.ink : NEUTRAL.ink2,
                      opacity: off ? 0.4 : 1, fontSize: fs(13), fontWeight: on ? 700 : 550, lineHeight: 1.2, cursor: off ? "not-allowed" : "pointer" }}>
                    <span aria-hidden="true">{a.icon}</span>{a.label}
                  </button>
                );
              })}
            </div>
            {ceiling && ceiling !== "public" ? (
              <p style={{ margin: "6px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Your passport is set to {AUDIENCES.find((a) => a.key === ceiling)?.label}, so it can’t reach wider than that.</p>
            ) : null}
          </fieldset>

          <button type="button" onClick={save} disabled={!!busy || !shown}
            className="w-full flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ marginTop: 14, minHeight: 52, borderRadius: 14, border: 0, background: NAVY, color: "#fff", fontSize: fs(15.5), fontWeight: 650, boxShadow: `inset 0 0 0 1.5px ${GOLD}` }}>
            {busy === "place" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <span aria-hidden="true">🛂</span>}
            {placed ? "Save" : "Place it in my passport"}
          </button>
          {!placed ? <p style={{ margin: "6px 0 0", fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>It goes on the first page of your passport.</p> : null}
          {placed ? (
            <button type="button" onClick={remove} disabled={!!busy}
              style={{ width: "100%", minHeight: 44, marginTop: 4, background: "transparent", border: 0, color: RED, fontSize: fs(13.5), fontWeight: 600 }}>
              {busy === "remove" ? "Taking it off…" : "Take it off my passport"}
            </button>
          ) : (
            <>
              <button type="button" onClick={close} disabled={!!busy}
                style={{ width: "100%", minHeight: 44, marginTop: 4, background: "transparent", border: 0, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
                Not now
              </button>
              <p style={{ margin: 0, fontSize: fs(11.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>It waits for you in Contribute to City Boards.</p>
            </>
          )}
        </div>
      </motion.div>
      {/* Confetti over everything (it never takes a tap), only for a stamp just earned. */}
      {fresh && !reduce ? (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 3 }}>
          {pieces.map((p, i) => (
            <motion.span key={i} initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }} animate={{ y: "105vh", x: p.drift * 3, rotate: p.r * 3, opacity: [1, 1, 0.9, 0] }}
              transition={{ duration: 2.6 + p.d * 2, delay: p.d, ease: "easeIn" }}
              style={{ position: "absolute", top: 0, left: `${p.x}%`, width: p.w, height: p.w * 0.55, borderRadius: 2, background: p.c, boxShadow: p.c === "#FFFFFF" ? "0 0 0 1px rgba(201,162,39,.4)" : "none" }} />
          ))}
        </div>
      ) : null}

    </div>,
    document.body,
  );
}

// CollectibleNudge — "so close" (founder, 2026-10-28: "if people [upload] 10 photos in the same
// location … encourage them to have at least three different locations to receive a reward
// stamp"). Shown after a pick when they have the photos but not yet the cities: a thank-you, the
// six designs one of which could be theirs, how far along they are, and Upload more photos.
//
//   <CollectibleNudge progress onClose onUpload />
//   progress   progressOf(…) from src/lib/collectibles.js: { posted, cities, needPhotos, needCities }
export function CollectibleNudge({ progress, onClose, onUpload = undefined }) {
  useDismissable(true, onClose);
  if (!progress) return null;
  const more = Math.max(0, progress.needCities - progress.cities);
  const bar = (label, have, need) => (
    <div style={{ marginTop: 8 }}>
      <div className="flex justify-between" style={{ fontSize: fs(12.5), color: NEUTRAL.ink2 }}>
        <span>{label}</span><b style={{ color: have >= need ? "#1D6B43" : NEUTRAL.ink }}>{Math.min(have, need)} / {need}{have >= need ? " ✓" : ""}</b>
      </div>
      <div aria-hidden="true" style={{ marginTop: 4, height: 7, borderRadius: 999, background: "rgba(12,43,80,.1)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, Math.round((have / need) * 100))}%`, height: "100%", borderRadius: 999, background: have >= need ? "#2E8B57" : `linear-gradient(90deg, ${GOLD}, #F2D878)` }} />
      </div>
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10030, background: "rgba(7,27,51,.62)", padding: 16 }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cb-nudge-h" onClick={(e) => e.stopPropagation()}
        className="w-full overflow-y-auto" style={{ position: "relative", maxWidth: 400, maxHeight: "94vh", background: NEUTRAL.ivory, borderRadius: 24, boxShadow: "0 24px 60px -20px rgba(0,0,0,.55)" }}>
        <AirmailChevron height={5} />
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ position: "absolute", top: 8, right: 6, width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", border: 0, color: NEUTRAL.ink2 }}>
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <div style={{ padding: "16px 20px calc(18px + env(safe-area-inset-bottom))", textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: fs(9.5), fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: RED, padding: "0 28px", textWrap: "balance" }}>
            Thank you for contributing to City Boards!
          </div>
          <h2 id="cb-nudge-h" style={{ margin: "6px 0 0", fontFamily: SERIF, fontSize: fs(29), fontWeight: 400, lineHeight: 1.05, color: NEUTRAL.ink }}>
            You’re so close to a <em style={{ color: BLUE }}>collectible stamp!</em>
          </h2>
          <p style={{ margin: "8px auto 0", maxWidth: 330, fontSize: fs(14), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
            You’ve shared {progress.posted} photos, from {progress.cities === 1 ? "1 city" : `${progress.cities} cities`}. Share photos from {more === 1 ? "1 more city" : `${more} more cities`} and one of these six is yours.
          </p>
          {/* The six designs, small: one of them could be theirs. */}
          <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, margin: "14px auto 0", maxWidth: 300 }}>
            {Object.values(COLLECTIBLES).map((c) => (
              <img key={c.no} src={c.art} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "contain", filter: "drop-shadow(0 3px 5px rgba(7,27,51,.25))" }} />
            ))}
          </div>
          <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: fs(9), letterSpacing: ".14em", textTransform: "uppercase", color: NEUTRAL.ink3, textWrap: "balance" }}>
            Official Traveler · Certified Explorer · Adventure Pro
          </p>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, background: "#fff", border: "1px solid rgba(22,17,13,.10)", textAlign: "left" }}>
            {bar("📷 Photos shared", progress.posted, progress.needPhotos)}
            {bar("🏙️ Different cities", progress.cities, progress.needCities)}
          </div>
          {onUpload ? (
            <button type="button" onClick={onUpload}
              className="w-full flex items-center justify-center gap-2"
              style={{ marginTop: 14, minHeight: 52, borderRadius: 14, border: 0, background: BLUE, color: "#fff", fontSize: fs(15.5), fontWeight: 650 }}>
              Upload photos from another city
            </button>
          ) : null}
          <button type="button" onClick={onClose}
            style={{ width: "100%", minHeight: 44, marginTop: 4, background: "transparent", border: 0, color: NEUTRAL.ink2, fontSize: fs(14), fontWeight: 600 }}>
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
