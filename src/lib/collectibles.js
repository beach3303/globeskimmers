// Collectible stamps (founder, 2026-10-28): every 10 photos a member contributes to City Boards
// earn one, picked at random from these six; deleting photos never takes one back. The member
// places it in their passport at Only me, Friends, Friends & followers or Everyone, or later.
// The art ships with the app; the worker (CB_TITLES) knows the same six numbers and titles.
import { callWorker } from "@/lib/callWorker";
import cb1 from "@/assets/collectibles/cb-1.webp";
import cb2 from "@/assets/collectibles/cb-2.webp";
import cb3 from "@/assets/collectibles/cb-3.webp";
import cb4 from "@/assets/collectibles/cb-4.webp";
import cb5 from "@/assets/collectibles/cb-5.webp";
import cb6 from "@/assets/collectibles/cb-6.webp";

export const REWARD_EVERY = 10;
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

// The member's stamps, newest first, and how many photos they've posted (deleted ones included).
export async function listCollectibles() {
  const { data, error } = await callWorker("collectibles", {});
  return { items: data?.items || [], posted: Number(data?.posted) || 0, every: Number(data?.every) || REWARD_EVERY, error: error || data?.error || null, unavailable: !!data?.unavailable };
}

// Into the passport at a level (or a new level for one already there).
export async function placeCollectible(id, visibility) {
  const { data, error } = await callWorker("collectibles/place", { id, visibility });
  return { ok: !!data?.ok, item: data?.item || null, error: error || data?.error || null };
}

// Out of the passport again; it stays earned.
export async function removeCollectible(id) {
  const { data, error } = await callWorker("collectibles/place", { id, remove: true });
  return { ok: !!data?.ok, item: data?.item || null, error: error || data?.error || null };
}
