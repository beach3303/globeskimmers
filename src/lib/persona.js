// persona.js — "who's traveling" (party composition). A small, user-set signal that:
//   1. RE-RANKS what we surface using the attraction `props` we already compute
//      server-side (isFamilyFriendly / isGoodForCouples / isGoodForGroups / …) —
//      zero new data, purely a client re-sort.
//   2. is a first-party SEGMENT for the demand/monetization loop (logged, no PII).
//
// USER-FACING = party composition ONLY (solo / couple / family / friends). We
// deliberately NEVER show age or life-stage labels ("retiree", etc.) — those stay
// internal analytics only (founder rule 2026-08-19). Stored on-device.
import { useState, useEffect } from "react";
import { logDiscover } from "@/lib/logDiscover";

const KEY = "gs_persona_v1";
export const CHANGE_EVENT = "gs:persona-changed";

export const PERSONAS = [
  { id: "solo", emoji: "🧍", label: "Solo" },
  { id: "couple", emoji: "💑", label: "Couple" },
  { id: "family", emoji: "👨‍👩‍👧", label: "Family" },
  { id: "friends", emoji: "👥", label: "Friends" },
];

// Which attraction `props` each persona favors (keys match the worker's props block).
const PERSONA_PROPS = {
  solo: ["isHiddenGem", "isAdventure", "isCultural", "isBudgetFriendly", "isPhotoWorthy"],
  couple: ["isGoodForCouples", "isPhotoWorthy", "isHiddenGem", "isCultural"],
  family: ["isFamilyFriendly", "isOutdoor", "isBudgetFriendly"],
  friends: ["isGoodForGroups", "isAdventure", "isPhotoWorthy"],
};

export function getPersona() {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function setPersona(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* private mode — non-fatal */ }
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); } catch { /* SSR */ }
  if (id) logDiscover("persona_set", { persona: id });
  return id || null;
}

// Additive boost: how many of the persona's favored props this activity has.
export function personaBoost(activity, persona) {
  if (!persona) return 0;
  const want = PERSONA_PROPS[persona] || [];
  const props = (activity && activity.props) || {};
  let hits = 0;
  for (const w of want) if (props[w] === true) hits++;
  return hits;
}

// Stable re-rank: nudge persona-matching items up WITHOUT destroying the base
// quality order (ties keep their original position). No-op when no persona set.
export function personaRank(items, persona) {
  if (!persona || !Array.isArray(items) || items.length < 2) return items;
  return items
    .map((a, i) => ({ a, i, b: personaBoost(a, persona) }))
    .sort((x, y) => (y.b - x.b) || (x.i - y.i))
    .map((o) => o.a);
}

// Hook: current persona, re-rendering on change (for live re-rank).
export function usePersona() {
  const [p, setP] = useState(() => getPersona());
  useEffect(() => {
    const sync = () => setP(getPersona());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  return p;
}
