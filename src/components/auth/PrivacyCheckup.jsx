// PrivacyCheckup — the one-time privacy check-up (founder, 2026-10-18: "ok i agree"). The
// 2026-10-15 tiers move set every stamp of a public passport to 🌍 Everyone, so a member who
// thought of their stamps as their circle's could find their photos on a City Board. Asked
// once, kindly, never a silent change: keep it public, or switch to the inner circle (every
// stamp → Inner circle, new stamps start there, the passport turns private — which also takes
// its photos off City Boards). Shown only to an adult whose passport is public with at least
// one 🌍 Everyone stamp, and only until they answer; "Decide later" waits for the next open.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/Toast";
import { getPrivacy, setSocialProfile, setAllStampsVisibility, getShareLink } from "@/lib/passport";
import { NEUTRAL, fs } from "@/components/redesign/constants";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const IVORY = "#FFFCF7", STAMP = "#B0472F";
const LATER = "gs_privacy_checkup_later";

export default function PrivacyCheckup({ enabled }) {
  const [ask, setAsk] = useState(null);     // { publicCount, total, boards } while the question is open
  const [busy, setBusy] = useState(null);   // 'keep' | 'inner' while saving
  const head = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    try { if (sessionStorage.getItem(LATER)) return; } catch { /* storage blocked: ask anyway */ }
    let gone = false;
    getPrivacy().then(({ profile, privacy }) => {
      if (gone || !profile || !privacy || profile.privacy_checked) return;
      if (profile.tier === "teen" || profile.tier === "blocked") return;
      const c = privacy.counts || {};
      if (!privacy.is_public || !(c.public > 0)) return;
      const total = (c.me || 0) + (c.inner || 0) + (c.followers || 0) + (c.public || 0);
      setAsk({ publicCount: c.public, total, boards: profile.albums_audience === "passport" });
    });
    return () => { gone = true; };
  }, [enabled]);
  useEffect(() => { if (ask) head.current?.focus(); }, [ask]);

  if (!ask) return null;

  const keep = async () => {
    if (busy) return;
    setBusy("keep");
    const { error } = await setSocialProfile({ privacy_checked: true });
    setBusy(null);
    if (error) { showToast("Couldn’t save — try again", "error"); return; }
    setAsk(null);
    showToast("Kept public — change it anytime in Settings → Privacy", "success");
  };
  // Private first: the moment the passport turns private, strangers and City Boards lose it,
  // even if a later step needs a retry.
  const toInner = async () => {
    if (busy) return;
    setBusy("inner");
    const sh = await getShareLink(false);
    const all = sh.error ? null : await setAllStampsVisibility("inner");
    const pr = all?.ok ? await setSocialProfile({ default_stamp_tier: "inner", privacy_checked: true }) : null;
    setBusy(null);
    if (sh.error || !all?.ok || pr?.error) { showToast("Couldn’t finish — try again", "error"); return; }
    setAsk(null);
    showToast("Done — your stamps and photos are your inner circle’s 🤝", "success");
  };
  const later = () => {
    try { sessionStorage.setItem(LATER, "1"); } catch { /* fine: it just asks again */ }
    setAsk(null);
  };

  const all = ask.publicCount >= ask.total;
  const lead = all ? "Your stamps" : `${ask.publicCount} of your ${ask.total} stamps`;
  const btn = "w-full rounded-xl font-semibold flex flex-col items-center justify-center disabled:opacity-50";

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(22,17,13,.5)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="gs-privacy-h" aria-describedby="gs-privacy-d" aria-busy={!!busy}
        className="relative w-full max-w-md rounded-[18px] px-5 py-6" style={{ background: IVORY, border: `1px solid ${RULE}` }}>
        <div className="uppercase" style={{ fontSize: fs(10), letterSpacing: ".2em", color: STAMP, fontWeight: 700 }}>A quick privacy check-up</div>
        <h2 id="gs-privacy-h" ref={head} tabIndex={-1} className="outline-none" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), lineHeight: 1.1, color: INK, marginTop: 6 }}>
          Who sees your stamps?
        </h2>
        <p id="gs-privacy-d" style={{ fontSize: fs(14.5), lineHeight: 1.5, color: INK2, marginTop: 10 }}>
          {ask.boards
            ? `${lead} and their photos are visible to everyone, and photos hang on City Boards. Keep it public, or switch to Inner circle?`
            : `${lead} are visible to everyone. Keep it public, or switch to Inner circle?`}
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={keep} disabled={!!busy} className={btn}
            style={{ minHeight: 56, padding: "8px 12px", background: "#fff", color: INK, border: `1.5px solid ${RULE}` }}>
            <span style={{ fontSize: fs(15) }}>{busy === "keep" ? "Saving…" : "🌍 Keep it public"}</span>
            <span style={{ fontSize: fs(11.5), fontWeight: 500, color: INK3, marginTop: 2 }}>Nothing changes</span>
          </button>
          <button type="button" onClick={toInner} disabled={!!busy} className={btn}
            style={{ minHeight: 56, padding: "8px 12px", background: "#fff", color: INK, border: `1.5px solid ${RULE}` }}>
            <span style={{ fontSize: fs(15) }}>{busy === "inner" ? "Switching…" : "🤝 Switch to Inner circle"}</span>
            <span style={{ fontSize: fs(11.5), fontWeight: 500, color: INK3, marginTop: 2, lineHeight: 1.35 }}>
              Only people you follow who follow you back · off City Boards
            </span>
          </button>
        </div>
        <p style={{ fontSize: fs(12.5), lineHeight: 1.45, color: INK3, marginTop: 12 }}>
          You can change any stamp, or all of them at once, anytime in Settings → Privacy.
        </p>
        <button type="button" onClick={later} disabled={!!busy} className="mt-1 w-full flex items-center justify-center"
          style={{ minHeight: 44, fontSize: fs(13), color: NEUTRAL.brandTeal, background: "transparent", border: 0 }}>
          Decide later
        </button>
      </div>
    </div>,
    document.body,
  );
}
