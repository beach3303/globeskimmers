// On-device persistence for the user's saved / favorite locations.
//
// Stored in localStorage (the user chose on-device-only on 2026-06-27), so it
// survives app launches and persists until the user deletes it. Tradeoff of the
// no-backend choice: NOT synced across devices and lost on reinstall.
//
// This replaces the old `base44.auth.updateMe({ saved_locations })` path, which
// silently failed once the app moved its auth to Supabase (no valid Base44
// session behind those calls) — that was why saving "didn't stick".

const KEY = "gs_saved_locations_v1";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// Two saved entries are "the same place" when their coordinates match (rounded
// to ~5 decimals ≈ 1m). Null-safe so a coordinate-less entry never throws.
function samePlace(a, b) {
  const ac = a?.coordinates;
  const bc = b?.coordinates;
  if (!ac || !bc) return false;
  const r = (n) => (typeof n === "number" ? Math.round(n * 1e5) : n);
  return r(ac.latitude) === r(bc.latitude) && r(ac.longitude) === r(bc.longitude);
}

// All saved locations (newest-saved last — the order they were added).
export function getSavedLocations() {
  return read();
}

// Save a location (or refresh it if the same place is already saved). Returns
// the stored entry. Adds a friendly default nickname + a savedAt timestamp.
export function saveSavedLocation(location, nickname = null) {
  if (!location) return null;
  const list = read();
  const entry = {
    ...location,
    nickname: nickname || location.nickname || location.placeName || "Saved location",
    savedAt: location.savedAt || new Date().toISOString(),
  };
  const idx = list.findIndex((l) => samePlace(l, location));
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  write(list);
  return entry;
}

// Modify a saved entry (e.g. rename its nickname). `match` identifies it by
// place; `changes` is shallow-merged. Returns true if an entry was updated.
export function updateSavedLocation(match, changes = {}) {
  const list = read();
  const idx = list.findIndex((l) => samePlace(l, match));
  if (idx < 0) return false;
  list[idx] = { ...list[idx], ...changes };
  write(list);
  return true;
}

// Remove a saved entry (matched by place). Returns true (idempotent).
export function deleteSavedLocation(match) {
  write(read().filter((l) => !samePlace(l, match)));
  return true;
}

// ── Primary "stay" / home-base anchor ───────────────────────────────────────
// Where the traveler is BASED this trip — a hotel, Airbnb, a room in one, a
// friend/family's place, their own home, or other. It's the hub that "what's
// nearby", day-trips/escapes, and "stamps near your stay" all radiate from
// (see plan). Stored as a normal saved location + an `isPrimaryStay` flag +
// `stayType`; exactly one entry is primary at a time.
export const STAY_TYPES = [
  { id: "hotel", label: "Hotel", emoji: "🏨" },
  { id: "airbnb", label: "Airbnb / rental", emoji: "🏠" },
  { id: "airbnb_room", label: "Room in an Airbnb", emoji: "🚪" },
  { id: "friends_family", label: "Friends & family", emoji: "👪" },
  { id: "own_place", label: "My place", emoji: "🏡" },
  { id: "other", label: "Other", emoji: "📍" },
];

// Set (or move) the primary stay. Clears the flag on any previous primary so
// there's always at most one. Returns the stored entry.
export function setPrimaryStay(location, stayType = "other") {
  if (!location) return null;
  const list = read();
  for (const l of list) { if (l.isPrimaryStay) delete l.isPrimaryStay; }
  const entry = {
    ...location,
    nickname: location.nickname || location.placeName || "My stay",
    stayType: stayType || "other",
    isPrimaryStay: true,
    savedAt: location.savedAt || new Date().toISOString(),
  };
  const idx = list.findIndex((l) => samePlace(l, location));
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  write(list);
  return entry;
}

// The current primary stay, or null.
export function getPrimaryStay() {
  return read().find((l) => l.isPrimaryStay) || null;
}

// Unset the primary stay (the entry stays saved, just no longer the base).
export function clearPrimaryStay() {
  const list = read();
  let changed = false;
  for (const l of list) { if (l.isPrimaryStay) { delete l.isPrimaryStay; changed = true; } }
  if (changed) write(list);
  return true;
}
