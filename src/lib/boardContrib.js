// Contribute to City Boards (founder, 2026-10-27): an album on the profile that sends a member's
// photos to the boards of the cities they were taken in. Public by design, and any photo can be
// deleted any time. A photo needs its own location (the city is read from it); the worker checks
// each one and never takes a photo where a child is clearly recognizable. Open until June 30, 2027.
import { callWorker } from "@/lib/callWorker";

export const CONTRIBUTE_PICK = 20;   // photos per pick: they upload one at a time, in about a minute
const CLOSES_AT = Date.parse("2027-07-01T07:00:00Z"); // the end of June 30, 2027, Pacific
export const contributeOpen = (now = Date.now()) => now < CLOSES_AT;

// One photo → { ok, board, posted, reward } · { code: 'no_location' | 'no_city' | 'child' | 'not_allowed' | 'caption' | 'slow_down' | …, error }
// posted: photos ever posted (deleted ones too); reward: a collectible stamp earned by this one (src/lib/collectibles.js).
export async function contributePhoto({ image, exif, caption = "" }) {
  const { data, error } = await callWorker("board/contribute", { image, exif: exif || {}, caption }, { timeoutMs: 45000 });
  if (!error && data?.ok) return { ok: true, id: data.id, url: data.url, board: data.board || null, posted: Number.isFinite(data.posted) ? data.posted : null, reward: data.reward || null };
  return { ok: false, code: data?.code || null, error: error || data?.error || "Upload failed" };
}

// The member's own contributions, newest first.
export async function listContributions() {
  const { data, error } = await callWorker("board/contributions", {});
  return { photos: data?.photos || [], open: data?.open !== false && contributeOpen(), error: error || null, unavailable: !!data?.unavailable };
}

export async function deleteContribution(id) {
  const { data, error } = await callWorker("board/contributions/delete", { id });
  return { ok: !!data?.ok, error: error || data?.error || null };
}

export async function captionContribution(id, caption) {
  const { data, error } = await callWorker("board/contributions/caption", { id, caption });
  return { ok: !!data?.ok, caption: data?.caption ?? null, error: error || data?.error || null };
}
