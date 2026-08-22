// logDiscover — one canonical analytics call for Discover/behavior events.
//
// Wraps trackEvent and ALWAYS attaches the geo + intent context so every event
// answers the same questions by a simple GROUP BY (which viral food, which hotel
// area, which city per day/week/month, planning-vs-present). NO personal data —
// we study selections/destinations/clicks in aggregate to monetize; user
// attribution (if any) is added server-side. City/country/intent are derived
// from the persisted active location (gs_last_location_v1), so callers just pass
// the specifics: logDiscover('escape_card_tap', { name }).
import { trackEvent } from "@/Layout";

function readActive() {
  try { const r = localStorage.getItem("gs_last_location_v1"); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

// Read the persona directly from storage (NOT via persona.js) — persona.js imports
// logDiscover, so importing it back here would be a circular dependency. Keep the
// key in sync with persona.js (gs_persona_v1).
function readPersona() {
  try { return localStorage.getItem("gs_persona_v1") || null; }
  catch { return null; }
}

export function logDiscover(eventType, payload = {}) {
  const loc = readActive();
  const a = (loc && loc.address) || {};
  const ctx = {
    city: a.city || loc?.city || loc?.placeName || "",
    country: a.country || loc?.country || "",
    intent: loc?.placeType === "current_location" ? "present" : "planning",
    persona: readPersona(), // party-composition segment (coarse, not identity) — powers Q6
  };
  // Explicit payload values win over the derived context.
  trackEvent(eventType, { ...ctx, ...payload });
}
