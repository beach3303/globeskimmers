// InviteButton (founder, 2026-09-30): anyone with a @username invites friends
// & family by text — the native share sheet opens straight into Messages /
// WhatsApp / email with a warm note and their /p/<slug> link. The landing
// page already logs the view and carries the App Store / Play buttons with
// attribution, so every invite is a measured rung of the growth funnel.
import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { showToast } from "@/components/Toast";
import { getHandle, getShareLink } from "@/lib/passport";
import { logEvent } from "@/lib/analytics";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

export default function InviteButton({ compact = false }) {
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ handle }, { data: sl }] = await Promise.all([getHandle(), getShareLink()]);
      const url = sl?.url || "https://globeskimmers.io";
      const who = handle ? `I'm @${handle} on Globeskimmers` : "I'm on Globeskimmers";
      const text = `${who} 🛂 — a virtual passport that stamps every place you go. Come collect with me: ${url}`;
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: "Join me on Globeskimmers", text });
      } else if (navigator.share) {
        await navigator.share({ title: "Join me on Globeskimmers", text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast("Invite copied — paste it anywhere", "success");
      }
      logEvent("invite_sent", { has_handle: !!handle }, "Profile");
    } catch (e) {
      if (e?.name !== "AbortError") showToast(e?.message || "Couldn't open sharing", "error");
    }
    setBusy(false);
  };

  return (
    <button type="button" onClick={invite} disabled={busy}
      className={`w-full rounded-[16px] flex items-center justify-between ${compact ? "p-3 mt-3" : "p-4 mt-4"}`}
      style={{ background: "#FFF6EC", border: "1px solid rgba(176,71,47,.35)", opacity: busy ? 0.6 : 1 }}>
      <span style={{ fontFamily: SERIF, color: "#7A3A28", fontSize: fs(compact ? 15 : 17) }}>
        Invite friends &amp; family by text
      </span>
      <span aria-hidden style={{ fontSize: fs(18) }}>💌</span>
    </button>
  );
}
