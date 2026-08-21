// wishlist.js — the traveler's Wishlist ("I want to go / do / see this").
//
// TWO jobs:
//   1. USER FEATURE — a personal list they can revisit + book from. Stored in
//      localStorage (on-device, instant, works signed-out — same choice as
//      savedLocations.js; cross-device sync to Supabase is a later phase).
//   2. DEMAND SIGNAL (the monetization asset) — every add/remove is logged via
//      logDiscover, so aggregate demand ("where people dream to go, what shows
//      they want") flows into the events pipeline with ZERO personal data. This
//      is the highest-signal input to the Demand Radar + affiliate targeting.
//
// Any card can capture intent by rendering <WishlistButton item={...} />. Item:
//   { kind, id, title, city, country, image?, url?, meta? }
//   kind ∈ 'attraction' | 'event' | 'city' | 'food' | 'hotel' | 'tour' | 'other'
import { logDiscover } from "@/lib/logDiscover";

const KEY = "gs_wishlist_v1";
const MAX = 300;
export const CHANGE_EVENT = "gs:wishlist-changed";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* quota / private mode — the write is lost; the sync below keeps UI honest */ }
  // ALWAYS notify: on success everyone re-reads the new list; on FAILURE everyone
  // re-reads the unchanged list, so an optimistic heart reverts instead of lying.
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); } catch { /* SSR/no-window */ }
}

// Stable identity for an item so the same place can't be double-added and the
// button knows its state. Prefer a real id; fall back to a slug of the title.
export function wishlistKey(kind, idOrTitle) {
  // Unicode-safe: only lowercase + collapse whitespace + cap length. (An earlier
  // ASCII-only strip collapsed non-Latin titles like "浅草寺"/"北京" to an empty
  // slug, so different places shared one key → collisions + silent data loss.)
  const slug = String(idOrTitle || "").toLowerCase().trim().replace(/\s+/g, "-").slice(0, 90);
  return `${kind || "item"}:${slug}`;
}

function keyFor(item) {
  return item.key || wishlistKey(item.kind, item.id || item.title);
}

export function getWishlist() {
  return read().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function isWishlisted(item) {
  const k = typeof item === "string" ? item : keyFor(item);
  return read().some((it) => it.key === k);
}

export function addToWishlist(item) {
  const key = keyFor(item);
  const list = read();
  if (list.some((it) => it.key === key)) return true;
  const entry = {
    key,
    kind: item.kind || "other",
    id: item.id || null,
    title: item.title || "",
    city: item.city || "",
    country: item.country || "",
    image: item.image || null,
    url: item.url || null,
    meta: item.meta || null,
    ts: Date.now(), // ms
  };
  write([entry, ...list]);
  logDiscover("wishlist_add", { kind: entry.kind, id: entry.id, title: entry.title, city: entry.city, country: entry.country });
  return true;
}

export function removeFromWishlist(item) {
  const key = typeof item === "string" ? item : keyFor(item);
  const list = read();
  const found = list.find((it) => it.key === key);
  write(list.filter((it) => it.key !== key));
  if (found) logDiscover("wishlist_remove", { kind: found.kind, id: found.id, title: found.title, city: found.city, country: found.country });
  return false;
}

// Returns the NEW state (true = now wishlisted).
export function toggleWishlist(item) {
  return isWishlisted(item) ? removeFromWishlist(item) : addToWishlist(item);
}
