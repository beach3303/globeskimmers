// Private messages to a place's owner (founder, 2026-10-05). The worker screens
// them and keeps them until the owner claims the place; never posted.
import { callWorker } from "@/lib/callWorker";

// entityType: 'attraction' | 'restaurant' | 'coffee' | 'store'. includeName signs
// it with the traveler's first name (adults only; the worker decides).
// Resolves { data: { ok, held, signed } } or { error }.
export async function sendOwnerNote({ entityType, entityId, entityName, body, includeName = false }) {
  const { data, error } = await callWorker("places/owner-note", {
    entity_type: entityType, entity_id: String(entityId), entity_name: entityName, body, include_name: includeName === true,
  });
  if (data?.error === "age_required") return { data, error: data.message || "Add your birth year in Settings to send messages." };
  return { data, error: error || data?.error || null };
}
