// "My virtual items" + travel buddies (founder, 2026-10-05) — client calls.
import { callWorker } from "@/lib/callWorker";

export async function gearGet() {
  const { data } = await callWorker("gear/get", {});
  return data && !data.error ? data : { gear: {}, buddies: [], layout: {} };
}
export async function gearSet(patch) {
  const { data, error } = await callWorker("gear/set", patch);
  return { data, error: error || data?.error || null };
}
