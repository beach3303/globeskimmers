// A member's own postcards on City Boards (founder, 2026-10-28): their home on the profile, next
// to Contribute to City Boards, and Delete, which takes a card off its board for good — the
// photo, the likes and the comments too. Nothing is kept.
import { callWorker } from "@/lib/callWorker";

// Newest first: [{ id, board: { kind, name, city, region, country }, photo, message, place, dish, anon, created_at }]
export async function listBoardPostcards() {
  const { data, error } = await callWorker("postcards/board-mine", {});
  return { items: Array.isArray(data?.items) ? data.items : [], error: error || data?.error || null };
}

export async function deleteBoardPostcard(id) {
  const { data, error } = await callWorker("postcards/board-delete", { postcard_id: id });
  return { ok: !!data?.ok, error: error || data?.error || null };
}

// "city board" · "state board" · "country board"
export const boardWord = (b) => (b?.kind === "state" ? "state board" : b?.kind === "country" ? "country board" : "city board");
