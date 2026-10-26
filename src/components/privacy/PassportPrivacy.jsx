// The passport's own privacy, right where you are (founder, 2026-10-26: "allow user to change
// passport privacy right there and then with easy toggles").
//
//   <PassportPrivacyChip onOpen />        "Who can see it  🤝 Friends  Change ›" — the passport page
//   <PassportAudienceSheet onClose />     the four choices; opening asks once (with how many stamps
//                                         it opens), closing works at once
import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { NEUTRAL, fs } from "@/components/redesign/constants";
import { showToast } from "@/components/Toast";
import { getPrivacy } from "@/lib/passport";
import { AUD, RANK, audWord, savePassportAudience, usePassportAudience } from "@/lib/audience";
import AudienceSheet from "@/components/privacy/AudienceSheet";

const BLUE = NEUTRAL.airmailBlue;

// How many stamps a passport set to `aud` shows to the people it opens to: those set to `aud`
// or wider (counts: { me, inner, followers, public } from /social/profile { privacy }).
const shownAt = (counts, aud) => Object.entries(counts || {}).filter(([t]) => (RANK[t] ?? 0) >= RANK[aud]).reduce((n, [, c]) => n + (c || 0), 0);
const s = (n) => (n === 1 ? "stamp" : "stamps");

export function confirmOpening(aud, counts) {
  if (!counts) return null;
  const n = shownAt(counts, aud);
  if (aud === "public") return n
    ? `Anyone with the app will see your ${n} ${s(n)} set to 🌍 Everyone, and their photos can hang on City Boards. Your other stamps stay as they are.`
    : "Anyone with the app can open your passport — but no stamps are set to 🌍 Everyone yet, so they’ll see none until you set some.";
  if (aud === "followers") return n
    ? `Your followers will see your ${n} ${s(n)} set to 👥 Followers or 🌍 Everyone. Friends-only and Only-me stamps stay as they are.`
    : "Your followers can open your passport — but no stamps are set to 👥 Followers or wider yet.";
  if (aud === "inner") return n
    ? `Your friends will see your ${n} ${s(n)} set to 🤝 Friends or wider.`
    : "Your friends can open your passport — but every stamp is 🔒 Only me right now.";
  return null;
}

export function PassportAudienceSheet({ onClose, onSaved = undefined }) {
  const [aud] = usePassportAudience();
  const [counts, setCounts] = useState(null);
  useEffect(() => { let gone = false; getPrivacy().then(({ privacy }) => { if (!gone && privacy?.counts) setCounts(privacy.counts); }); return () => { gone = true; }; }, []);
  const pick = async (v) => {
    const { audience, error } = await savePassportAudience(v);
    if (error === "age_required") { showToast("One thing first — add your birthday in Settings", "error"); return false; }
    if (error === "finish_passport") return false;
    if (error) { showToast(error, "error"); return false; }
    showToast(`Your passport: ${audWord(audience)}`, "success");
    if (typeof onSaved === "function") onSaved(audience);
    return true;
  };
  return (
    <AudienceSheet title="Who can see your passport" value={aud || "inner"} onPick={pick} onClose={onClose}
      confirmWider={(v) => confirmOpening(v, counts)}
      note="The most anyone can see. Each stamp and album can be the same or more private — never more public." />
  );
}

export function PassportPrivacyChip({ onOpen, style = undefined }) {
  const [aud] = usePassportAudience();
  const a = AUD[aud];
  return (
    <button type="button" onClick={onOpen} aria-label={`Who can see your passport: ${a ? a.label : "loading"}. Change`}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, padding: "0 6px 0 14px", borderRadius: 999,
        border: `1px solid ${NEUTRAL.airmailLine}`, background: NEUTRAL.white, font: "inherit", cursor: "pointer", ...style }}>
      <span style={{ fontSize: fs(12), color: NEUTRAL.ink3 }}>Who can see it</span>
      <span style={{ fontSize: fs(13.5), fontWeight: 650, color: NEUTRAL.ink }}>{a ? `${a.icon} ${a.label}` : "…"}</span>
      <span style={{ display: "inline-flex", alignItems: "center", fontSize: fs(12.5), fontWeight: 650, color: BLUE }}>Change<ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" /></span>
    </button>
  );
}
