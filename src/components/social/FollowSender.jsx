// FollowSender — "+ Follow" on mail from someone you don't follow yet (founder's decision sheet,
// 2026-10-25: "A Follow button on mail from someone new"; postcards and telegrams are the best moment
// to grow a circle). One quiet strip on the card: "Joy isn't in your circle yet. + Follow", then
// "Following" or "Requested" once it went through.
//
//   <FollowSender name onFollow style />
//   onFollow  async () → { ok, status: 'accepted' | 'pending' }; the caller follows and toasts
import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";

export default function FollowSender({ name, onFollow, style = undefined }) {
  const [state, setState] = useState(null);   // null | 'busy' | 'Following' | 'Requested'
  const go = async () => {
    if (state) return;
    setState("busy");
    const r = await onFollow();
    setState(r && r.ok ? (r.status === "pending" ? "Requested" : "Following") : null);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 12px", borderRadius: 12, background: NEUTRAL.airmail, border: `1px solid ${NEUTRAL.airmailHair}`, ...style }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink2 }}>
        {state === "Following" || state === "Requested" ? (state === "Following" ? `You follow ${name} now.` : `You asked to follow ${name}.`) : `${name} isn’t in your circle yet.`}
      </span>
      {state === "Following" || state === "Requested" ? (
        <span style={{ flex: "none", minHeight: 34, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 999, border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, color: NEUTRAL.ink2, fontSize: fs(12.5), fontWeight: 600 }}>{state}</span>
      ) : (
        <button type="button" onClick={go} aria-busy={state === "busy" || undefined} aria-label={`Follow ${name}`}
          style={{ flex: "none", minHeight: 34, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 999, border: 0, background: NEUTRAL.airmailBlue, color: NEUTRAL.white, font: "inherit", fontSize: fs(12.5), fontWeight: 650, cursor: "pointer" }}>
          <UserPlus size={14} strokeWidth={2.2} aria-hidden="true" focusable="false" /> {state === "busy" ? "…" : "Follow"}
        </button>
      )}
    </div>
  );
}
