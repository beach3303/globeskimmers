// vibeBundles.js — Discover "vibe bundles": small, recognizable mood combos the
// user can pick, filled with real nearby places. LABELS ARE MOOD, NEVER DEMOGRAPHIC
// (founder rule): the menu is identical for everyone; age/party-mix stays an
// internal signal. Each slot routes to the best destination on tap:
//   - dest.page  → an in-app finder (real, already-cached cards appear there) = no new spend
//   - dest.maps  → a Google Maps search for local-life types we have no finder for
//                  (spa/gym/salon/cinema) — free deep-link, on demand only.
// Persona (party composition) gives a light re-order so the most relevant vibe
// leads; the set never changes. Selections are logged for the demand loop.

// dest: { page: 'PlacesToEat' } routes in-app; { maps: 'spa' } opens Maps search.
export const VIBE_BUNDLES = [
  {
    id: "selfcare", emoji: "💆", title: "Self-care day", sub: "Slow down & recharge",
    slots: [
      { emoji: "💆", label: "Spa / massage", dest: { maps: "spa massage" } },
      { emoji: "💅", label: "Nail salon", dest: { maps: "nail salon" } },
      { emoji: "🥗", label: "Healthy lunch", dest: { page: "PlacesToEat", query: "healthy" } },
      { emoji: "☕", label: "Quiet café", dest: { page: "CoffeeFinder" } },
    ],
  },
  {
    id: "nightout", emoji: "🍻", title: "Night out", sub: "Dinner, drinks & music",
    slots: [
      { emoji: "🍽️", label: "Dinner", dest: { page: "PlacesToEat", query: "dinner" } },
      { emoji: "🍸", label: "Bars", dest: { maps: "bars" } },
      { emoji: "🎶", label: "Live music", dest: { maps: "live music" } },
      { emoji: "🎫", label: "What's on", dest: { page: "ThingsToDo", query: "events" } },
    ],
  },
  {
    id: "family", emoji: "👨‍👩‍👧", title: "Family day", sub: "Fun for all ages",
    slots: [
      { emoji: "🎡", label: "Family spots", dest: { page: "ThingsToDo", query: "family" } },
      { emoji: "🍦", label: "Casual eats", dest: { page: "PlacesToEat", query: "family friendly" } },
      { emoji: "🎬", label: "Cinema", dest: { maps: "movie theater" } },
      { emoji: "🌳", label: "Parks", dest: { maps: "park playground" } },
    ],
  },
  {
    id: "active", emoji: "🧘", title: "Active & reset", sub: "Move, then unwind",
    slots: [
      { emoji: "🥾", label: "Outdoors", dest: { page: "ThingsToDo", query: "outdoor hike" } },
      { emoji: "💪", label: "Gym / yoga", dest: { maps: "gym yoga studio" } },
      { emoji: "🥤", label: "Smoothie", dest: { page: "PlacesToEat", query: "smoothie healthy" } },
      { emoji: "🧖", label: "Sauna / spa", dest: { maps: "sauna spa" } },
    ],
  },
  {
    id: "relaxed", emoji: "🛍️", title: "Relaxed & easy", sub: "Stroll, shop, savor",
    slots: [
      { emoji: "🛍️", label: "Shopping", dest: { page: "Shopping" } },
      { emoji: "☕", label: "Café", dest: { page: "CoffeeFinder" } },
      { emoji: "🍽️", label: "Scenic lunch", dest: { page: "PlacesToEat", query: "scenic view" } },
      { emoji: "💆", label: "Spa", dest: { maps: "day spa" } },
    ],
  },
  {
    id: "classics", emoji: "📸", title: "The classics", sub: "The must-sees",
    slots: [
      { emoji: "⭐", label: "Top sights", dest: { page: "ThingsToDo" } },
      { emoji: "📷", label: "Photo spots", dest: { page: "ThingsToDo", query: "photo viewpoint" } },
      { emoji: "🍽️", label: "Iconic eats", dest: { page: "PlacesToEat", query: "famous local" } },
      { emoji: "🛍️", label: "Souvenirs", dest: { page: "Shopping", query: "souvenirs" } },
    ],
  },
];

// Light persona re-order (party composition) — leads with the most fitting vibe,
// never removes any. Mood set stays identical for everyone.
const PERSONA_LEAD = {
  family: ["family", "classics", "active", "relaxed", "selfcare", "nightout"],
  couple: ["nightout", "relaxed", "classics", "selfcare", "active", "family"],
  friends: ["nightout", "active", "classics", "relaxed", "family", "selfcare"],
  solo: ["active", "selfcare", "classics", "relaxed", "nightout", "family"],
};

export function orderedBundles(persona) {
  const order = PERSONA_LEAD[persona];
  if (!order) return VIBE_BUNDLES;
  const byId = Object.fromEntries(VIBE_BUNDLES.map((b) => [b.id, b]));
  const led = order.map((id) => byId[id]).filter(Boolean);
  // append any not in the order list (future-proof)
  VIBE_BUNDLES.forEach((b) => { if (!order.includes(b.id)) led.push(b); });
  return led;
}

// Build a free Google Maps search deep-link near the given place (no billed API).
export function mapsSearchUrl(query, city) {
  const q = [query, city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
