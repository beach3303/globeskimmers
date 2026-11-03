// The same-spot strip's data (founder, 2026-11-03): the uploads on a board shot within fifty metres
// of one, oldest first — { rows: [{ id, kind, photo, video?, duration?, filter, marks, when, current }],
// travelers }. The worker keeps the spots; the app only ever sees items.
import { callWorker } from "@/lib/callWorker";

export async function sameSpot(id) {
  const { data, error } = await callWorker("board/same-spot", { id: String(id || "") });
  return { rows: Array.isArray(data?.rows) ? data.rows : [], travelers: Number(data?.travelers) || 0, error: error || data?.error || null };
}
