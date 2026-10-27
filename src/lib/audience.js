// The four words of privacy (founder, 2026-10-26: "Friends and Followers", "Yes, the passport is
// the ceiling", "Four: Only me · Friends · Followers · Everyone") — the same words in Settings,
// on the passport, on each stamp, on each album and right after stamping.
//   'me' ⊂ 'inner' ⊂ 'followers' ⊂ 'public'
// The passport's own setting is the most anyone can see: a stamp or an album can be the same or
// more private, never more public. The worker enforces it (ppAud / ppUnder); the app greys out
// what the passport doesn't allow and says why.
//
//   usePassportAudience()      → [audience | null, set]  (null while it loads)
//   savePassportAudience(aud)  → { audience, error }      (tells every open screen)
import { useEffect, useState } from "react";
import { callWorker } from "@/lib/callWorker";
import { requirePassport } from "@/lib/passportGate";

// The founder's words (2026-10-26): "only me, friends, friends & followers, everyone".
export const AUDIENCES = [
  { key: "me", icon: "🔒", label: "Only me", line: "Nobody else, ever." },
  { key: "inner", icon: "🤝", label: "Friends", line: "People you follow who follow you back." },
  { key: "followers", icon: "👥", label: "Friends & followers", line: "Everyone who follows you, friends included." },
  { key: "public", icon: "🌍", label: "Everyone", line: "Anyone with the app, and City Boards." },
];
export const AUD = Object.fromEntries(AUDIENCES.map((a) => [a.key, a]));
export const RANK = { me: 0, inner: 1, followers: 2, public: 3 };
export const audWord = (k) => (AUD[k] ? `${AUD[k].icon} ${AUD[k].label}` : "");
// A stamp's own setting; rows from before the tiers read as Friends (or Only me when hidden).
export const stampTier = (st) => st?.visibility || (st?.hidden ? "me" : "inner");
// Is this setting wider than the passport allows?
export const aboveCeiling = (tier, ceiling) => !!ceiling && (RANK[tier] ?? 1) > (RANK[ceiling] ?? 3);
// What a stamp really shows at under its passport.
export const capTo = (tier, ceiling) => (aboveCeiling(tier, ceiling) ? ceiling : tier);

// An album (a place's photos) takes the same four words (founder, 2026-10-27: no "Same as stamp").
// Its photos never reach more than their stamp or the passport: wider choices are greyed out.
export const ALBUM_OPTS = [
  { key: "me", icon: "🔒", label: "Only me", line: "Hidden from everyone. Off City Boards." },
  { key: "inner", icon: "🤝", label: "Friends", line: "People you follow who follow you back. Off City Boards." },
  { key: "followers", icon: "👥", label: "Friends & followers", line: "Everyone who follows you. Off City Boards." },
  { key: "public", icon: "🌍", label: "Everyone", line: "Anyone with the app, and the city’s board." },
];
export const albumWord = audWord;
// The narrower of two levels.
export const narrower = (a, b) => ((RANK[a] ?? 1) <= (RANK[b] ?? 1) ? a : b);
// What a stamp's photos really show at: its album setting (unset = as far as the stamp goes),
// never more than the stamp, and never more than the passport when it is known.
export const albumLevel = (stamp, ceiling = null) => {
  const own = stampTier(stamp);
  const album = stamp?.photos_tier && RANK[stamp.photos_tier] !== undefined ? narrower(stamp.photos_tier, own) : own;
  return ceiling ? capTo(album, ceiling) : album;
};

// One event so every open screen (Home's passport, Settings, a stamp sheet) shows the change.
const EVENT = "gs:passport-audience";
let known = null;
export async function loadPassportAudience() {
  const { data } = await callWorker("passport/share", {});
  if (data?.audience) known = data.audience;
  else if (data && typeof data.is_public === "boolean") known = data.is_public ? "public" : "inner";
  return known;
}
export async function savePassportAudience(audience) {
  if (audience === "public" || audience === "followers") {
    if (!(await requirePassport())) return { audience: known, error: "finish_passport" };
  }
  const { data, error } = await callWorker("passport/share", { audience });
  const err = error || data?.error || null;
  if (err || !data) return { audience: known, error: err || "Couldn’t save that — try again" };
  known = data.audience || audience;
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: known })); } catch { /* no window */ }
  return { audience: known, data, error: null };
}
export function usePassportAudience(enabled = true) {
  const [aud, setAud] = useState(known);
  useEffect(() => {
    if (!enabled) return undefined;
    let gone = false;
    loadPassportAudience().then((a) => { if (!gone && a) setAud(a); });
    const on = (e) => setAud(e.detail);
    window.addEventListener(EVENT, on);
    return () => { gone = true; window.removeEventListener(EVENT, on); };
  }, [enabled]);
  return [aud, setAud];
}
