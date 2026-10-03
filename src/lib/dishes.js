// Traveler dish posts ("Add your dish") — a proof-gated, reviewed photo of what a
// traveler ordered at a restaurant or café. Posts are anonymous; the worker
// counts one per traveler per dish per place ("ordered by N travelers").
import { callWorker } from "@/lib/callWorker";

export async function listDishes(placeId) {
  const { data, error } = await callWorker("places/dishes", { place_id: placeId });
  return { dishes: data?.dishes || [], mine: data?.mine || [], error: error || null };
}

// exif: { lat, lng, taken_at } read from the ORIGINAL file (src/lib/photoExif.js).
// gps: { lat, lng, acc } from getCurrentPositionSmart, or null.
export async function addDish({ place, kind, dish, image, gps, exif }) {
  const { data, error } = await callWorker("places/dishes/add", {
    place_id: place.id, place_name: place.name, place_lat: place.lat, place_lng: place.lng,
    kind, dish, image,
    lat: gps?.lat, lng: gps?.lng, acc: gps?.acc,
    exif: exif || undefined,
  });
  if (data?.error === "proof_needed") return { data, error: data.message || "Share it while you're here.", proofNeeded: true };
  return { data, error: error || data?.error || null, proofNeeded: false };
}

export async function deleteDish(id) {
  const { data, error } = await callWorker("places/dishes/delete", { id });
  return { ok: !!data?.ok, error: error || data?.error || null };
}
