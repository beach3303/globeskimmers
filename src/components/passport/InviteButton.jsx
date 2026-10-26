// InviteButton (founder, 2026-09-30): anyone with a @username invites people by text — the
// native share sheet opens straight into Messages / WhatsApp / email with a warm note and
// their /p/<slug> link. The landing page already logs the view and carries the App Store /
// Play buttons with attribution, so every invite is a measured rung of the growth funnel.
//
// The new look (bible.word.lines): 'Invite someone to your circle', a 44px outline with a
// lucide Send, in airmail blue on Mailbox (Mailbox.dc.html L52-55), in the owner's cloth on
// the profile and the Circle screen (Profile.dc.html L228-234, Circle.dc.html L358-362). The
// profile's empty circle uses 'Invite someone by text'.
//
//   <InviteButton label color size variant compact className style />
//   label     the words; 'Invite someone to your circle' by default.
//   color     airmail blue by default; any token colour, or a cloth key or CLOTH row.
//   size      'md' (14/600, Send 16, a 1px line: Mailbox, Circle) or 'lg' (15/600, Send 18, a
//             1.5px line: the profile).
//   variant   'outline' (default) or 'solid' (the colour with white words).
//   compact   the old Mailbox prop: the same button with 12px above it.
//
// The flow is today's: getHandle and getShareLink, then the share sheet, navigator.share or
// the clipboard, and invite_sent logged. While tagging is switched off (TAGGING_ENABLED),
// the note no longer promises tagging.
import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Loader2, Send } from "lucide-react";
import { showToast } from "@/components/Toast";
import { getHandle, getShareLink } from "@/lib/passport";
import { logEvent } from "@/lib/analytics";
import { TAGGING_ENABLED } from "@/lib/flags";
import { CLOTH, NEUTRAL, fs } from "@/components/redesign/constants";
import { clothRow } from "@/components/profile/CoverBand";

/** @typedef {import('react').CSSProperties} CSS */

const isCloth = (v) => (typeof v === "string" && Object.prototype.hasOwnProperty.call(CLOTH, v.trim().toLowerCase()))
  || (!!v && typeof v === "object" && typeof v.key === "string" && Object.prototype.hasOwnProperty.call(CLOTH, v.key));

/**
 * The outbound note, with or without the tagging promise. It keeps the founder's emoji: it is
 * the message the traveler sends in their own name, in Messages or WhatsApp, not a surface of
 * the app (principle 6 covers what the app draws).
 * @param {string|null} handle
 * @param {string} url
 */
export function inviteText(handle, url) {
  const me = handle ? ` (I'm @${handle})` : "";
  const what = TAGGING_ENABLED
    ? "collect stamps from everywhere you go, save memories & tag the people you share them with"
    : "collect stamps from everywhere you go & save memories";
  return `Join me on Globeskimmers 🌎✈️${me} Claim your username, ${what}. Let's fill our virtual passports together! 💛 ${url}`;
}

/**
 * @param {{
 *   label?: string, color?: any, size?: 'md'|'lg', variant?: 'outline'|'solid', compact?: boolean,
 *   className?: string, style?: CSS,
 * }} props
 */
export default function InviteButton({
  label = "Invite a friend",
  color = undefined,
  size = "md",
  variant = "outline",
  compact = false,
  className = undefined,
  style = undefined,
}) {
  const [busy, setBusy] = useState(false);
  const ink = isCloth(color) ? clothRow(color).cloth : typeof color === "string" && color.trim() ? color : NEUTRAL.airmailBlue;
  const lg = size === "lg";
  const solid = variant === "solid";

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ handle }, { data: sl }] = await Promise.all([getHandle(), getShareLink()]);
      const url = sl?.url || "https://globeskimmers.io";
      const text = inviteText(handle, url);
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

  const Icon = busy ? Loader2 : Send;
  return (
    <button
      type="button"
      onClick={invite}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        minHeight: 44,
        boxSizing: "border-box",
        margin: compact ? "12px 0 0" : 0,
        padding: "6px 16px",
        borderRadius: 14,
        background: solid ? ink : "transparent",
        border: `${lg ? 1.5 : 1}px solid ${ink}`,
        fontFamily: "inherit",
        fontSize: fs(lg ? 15 : 14),
        fontWeight: 600,
        lineHeight: 1.25,
        textAlign: "center",
        color: solid ? NEUTRAL.white : ink,
        cursor: busy ? "progress" : "pointer",
        ...style,
      }}
    >
      <Icon
        size={lg ? 18 : 16}
        strokeWidth={2}
        aria-hidden="true"
        focusable="false"
        className={busy ? "animate-spin motion-reduce:animate-none" : undefined}
        style={{ display: "block", flexShrink: 0 }}
      />
      <span>{label}</span>
    </button>
  );
}
