// City Cards (founder, 2026-10-28): a restaurant, café, shop or convenience store never stamps
// the Virtual Passport — it stamps the traveler's CARD. The tap is the proof, as "I was here":
// fresh GPS readings the worker measures against the place. The artwork ships with the app; the
// worker (CC_*) knows the same categories and designs.
//
// 2026-11-06 (founder, "yes to all" — docs/plans/cards-and-passport.md): a card per METRO AREA
// ("Greater Phoenix" takes Scottsdale, Mesa and Tempe; "Greater Los Angeles" her whole SoCal),
// TWENTY stamps, numbered and never expiring (No. 1, No. 2 …) instead of a card per city per year;
// Stay and Do join the categories. A stay reads "Accommodation · Scottsdale" to everyone but its
// owner unless the owner shows the hotel's name; a private note goes on any stamp.
import { callWorker } from "@/lib/callWorker";
import { requirePassport } from "@/lib/passportGate";
import restaurant1 from "@/assets/citycards/restaurant-1.webp";
import restaurant2 from "@/assets/citycards/restaurant-2.webp";
import coffee1 from "@/assets/citycards/coffee-1.webp";
import coffee2 from "@/assets/citycards/coffee-2.webp";
import shopping1 from "@/assets/citycards/shopping-1.webp";
import shopping2 from "@/assets/citycards/shopping-2.webp";
import convenience1 from "@/assets/citycards/convenience-1.webp";
import convenience2 from "@/assets/citycards/convenience-2.webp";
import market1 from "@/assets/citycards/market-1.webp";
import market2 from "@/assets/citycards/market-2.webp";

export const SLOTS = 20;
// The finders that stamp a card. ATMs, restrooms and Money Exchange stamp nothing; Things to do stamps
// the passport when the place is in the stampable catalog and a card (Do) when it is not.
export const FINDERS = { eat: "restaurant", coffee: "coffee", shopping: "shopping", convenience: "convenience", stay: "stay", do: "do" };
// The category artwork, two designs each, in the category's ink (the ink the name and date print in).
// Stay and Do wait for the founder's art: until then they press as a word stamp in their ink.
export const CATEGORY = {
  restaurant: { label: "Restaurant", ink: "#B0472F", art: [restaurant1, restaurant2] },
  coffee: { label: "Coffee shop", ink: "#6B4A2B", art: [coffee1, coffee2] },
  shopping: { label: "Shopping", ink: "#2E6B4E", art: [shopping1, shopping2] },
  convenience: { label: "Convenience store", ink: "#2B4A7E", art: [convenience1, convenience2] },
  market: { label: "Market", ink: "#6D3A6E", art: [market1, market2] },
  stay: { label: "Accommodation", ink: "#24316B", art: [], word: "STAY" },
  do: { label: "Things to do", ink: "#1E5556", art: [], word: "DO" },
};
export const artFor = (category, design = 1) => { const c = CATEGORY[category]; return c && c.art.length ? c.art[(Math.max(1, Number(design) || 1) - 1) % c.art.length] : null; };
export const inkFor = (category) => CATEGORY[category]?.ink || "#B0472F";
export const categoryLabel = (category) => CATEGORY[category]?.label || "Local find";
export const categoryWord = (category) => CATEGORY[category]?.word || null;
// "Greater Phoenix" (an old card that hasn't been folded yet still reads as its city)
export const cardTitle = (card) => String(card?.area_name || card?.city || "").trim();
// "OCT 24 2026"
export const stampDate = (iso) => {
  const d = new Date(`${String(iso || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(",", "").toUpperCase();
};
export const cardLeft = (card) => Math.max(0, (card?.slots || SLOTS) - (card?.count || 0));
// The name a stamp shows: a hidden stay reads "Accommodation" to others (the worker already says so);
// its owner sees the hotel.
export const stampName = (stamp) => (stamp?.category === "stay" && !stamp?.place_id && stamp?.name_hidden ? "Accommodation" : stamp?.name || "");

// One stamp on the card of the place's area. → { data: { ok, card, stamp, completed, already } | { code, error, distance_m }, error }
export async function stampCityCard(payload) {
  if (!(await requirePassport())) return { data: null, error: "finish_passport" };
  const { data, error } = await callWorker("city-cards/stamp", payload || {});
  return { data, error };
}

// My cards, newest first, each with its stamps.
export async function listCityCards() {
  const { data, error } = await callWorker("city-cards", {});
  return { cards: Array.isArray(data?.cards) ? data.cards : [], error: error || data?.error || null, unavailable: !!data?.unavailable };
}

// The key a place is stamped under (the worker's): places:<google id> or owned:<uuid>.
export const placeKey = (id) => {
  const v = String(id || "");
  if (/^(places|owned):/.test(v)) return v;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return `owned:${v}`;
  if (/^[A-Za-z0-9_-]{16,250}$/.test(v) && /[A-Z]/.test(v)) return `places:${v}`;
  return v;
};
// Which places I've stamped, read once and shared by every place card on screen (founder,
// 2026-10-28: the card remembers "stamped Oct 24" without a tap). The newest card wins when a
// business is on more than one. Cleared after a stamp, so the next read is fresh.
let mineCache = null, minePromise = null;
export function forgetMyCardStamps() { mineCache = null; minePromise = null; }
export function myCardStamps() {
  if (mineCache) return Promise.resolve(mineCache);
  if (!minePromise) {
    minePromise = listCityCards().then((r) => {
      const m = new Map();
      for (const c of [...r.cards].reverse()) for (const st of c.stamps || []) m.set(st.place_id, { card: c, stamp: st });
      if (!r.error) mineCache = m; else minePromise = null;
      return m;
    }).catch(() => { minePromise = null; return new Map(); });
  }
  return minePromise;
}

export async function setCityCardVisibility(id, visibility) {
  const { data, error } = await callWorker("city-cards/visibility", { id, visibility });
  return { ok: !!data?.ok, visibility: data?.visibility || null, error: error || data?.error || null, code: data?.code || null };
}

// A stay's privacy, stamp by stamp (2026-11-06): show or hide the hotel's name; the private note.
export async function setCardStampPrivacy(id, { name_hidden, note } = {}) {
  const { data, error } = await callWorker("city-cards/stamp/privacy", { id, ...(name_hidden !== undefined ? { name_hidden: !!name_hidden } : {}), ...(note !== undefined ? { note: note || null } : {}) });
  if (!error && data?.ok) forgetMyCardStamps();
  return { ok: !!data?.ok, stamp: data?.stamp || null, error: error || data?.error || null };
}
// The Settings default for a new stay (founder's kind of traveler never minds): off = hidden.
export const showHotelNamesByDefault = () => { try { return localStorage.getItem("pp_show_hotel_names") === "1"; } catch { return false; } };
