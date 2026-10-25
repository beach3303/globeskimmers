// New arrivals (founder's decision sheet, 2026-10-25): members who joined in the last 14 days — only
// their @username, where they joined from, and how long ago — for Home's Arrivals page.
//   newArrivals() → { rows: [{ user_id, handle, from, days }], off, held, error }
import { callWorker } from "@/lib/callWorker";

export async function newArrivals() {
  const { data, error } = await callWorker("social/new-arrivals", {});
  if (data && data.path === "/social/new-arrivals") return { rows: [], off: true, held: false, error: null };
  return { rows: Array.isArray(data?.rows) ? data.rows : [], off: data?.off === true, held: data?.held === true, error: error || data?.error || null };
}
