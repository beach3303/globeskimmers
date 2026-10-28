// The collectible stamp (founder, 2026-10-28): a member who shares at least 10 photos with City
// Boards, from at least 3 different cities, earns ONE, picked at random from these six designs;
// it's theirs for good (deleting photos never takes it back) and can't be exchanged for another.
// They place it on their passport's first page at Only me, Friends, Friends & followers or
// Everyone, or later. The art ships with the app (every design is printed "1/80"); the worker
// (CB_TITLES) knows the same six design numbers and titles.
import { callWorker } from "@/lib/callWorker";
import cb1 from "@/assets/collectibles/cb-1.webp";
import cb2 from "@/assets/collectibles/cb-2.webp";
import cb3 from "@/assets/collectibles/cb-3.webp";
import cb4 from "@/assets/collectibles/cb-4.webp";
import cb5 from "@/assets/collectibles/cb-5.webp";
import cb6 from "@/assets/collectibles/cb-6.webp";

export const REWARD_PHOTOS = 10;
export const REWARD_CITIES = 3;
export const TITLES = ["Official Traveler", "Certified Explorer", "Adventure Pro"];
export const COLLECTIBLES = {
  1: { no: 1, title: "Official Traveler", art: cb1 },
  2: { no: 2, title: "Official Traveler", art: cb2 },
  3: { no: 3, title: "Certified Explorer", art: cb3 },
  4: { no: 4, title: "Certified Explorer", art: cb4 },
  5: { no: 5, title: "Adventure Pro", art: cb5 },
  6: { no: 6, title: "Adventure Pro", art: cb6 },
};
export const collectibleOf = (badge) => COLLECTIBLES[Number(badge)] || null;
// "an Official Traveler", "a Certified Explorer", "an Adventure Pro"
export const withArticle = (title) => `${/^[aeiou]/i.test(title || "") ? "an" : "a"} ${title}`;

// How far along they are: photos posted and cities they came from (deleted photos still count).
export const progressOf = (p) => ({
  posted: Number(p?.posted) || 0, cities: Number(p?.cities) || 0,
  needPhotos: Number(p?.need_photos) || REWARD_PHOTOS, needCities: Number(p?.need_cities) || REWARD_CITIES, earned: !!p?.earned,
});

// The member's stamp (none, or their one) and their progress toward it.
export async function listCollectibles() {
  const { data, error } = await callWorker("collectibles", {});
  return { items: data?.items || [], progress: progressOf(data?.progress), error: error || data?.error || null, unavailable: !!data?.unavailable };
}

// Onto the passport's first page at a level (or a new level once there).
export async function placeCollectible(id, visibility) {
  const { data, error } = await callWorker("collectibles/place", { id, visibility });
  return { ok: !!data?.ok, item: data?.item || null, error: error || data?.error || null };
}

// Off the passport again; it stays earned, and stays the same design.
export async function removeCollectible(id) {
  const { data, error } = await callWorker("collectibles/place", { id, remove: true });
  return { ok: !!data?.ok, item: data?.item || null, error: error || data?.error || null };
}
