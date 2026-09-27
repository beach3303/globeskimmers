// hotelPhotos — the supplier gallery for one Nuitée hotel (worker
// /hotels/nuitee/photos → { photos, rooms }), fetched once per hotel per
// session and shared by the results-card lightbox (FindAHotel) and the room
// picker (HotelBookSheet). Founder ask 2026-09-26: enlarge hotel photos from
// the results, swipe through them, see room pictures when choosing a room.
//
// Shapes handed out (PhotoLightbox's contract):
//   photos  — [{ src, hd }]                    the hotel's own gallery
//   rooms   — [{ id, name, photos: [{ src, hd }] }]  only rooms with a picture
// A failed or empty fetch resolves null and is NOT cached, so the next tap
// retries; a real answer (even one with zero photos) is kept for the session.
import { callWorker } from "@/lib/callWorker";

const cache = new Map(); // hotelId → Promise<{ photos, rooms } | null>

const toPhotos = (list) => (Array.isArray(list) ? list : [])
  .filter((x) => x && typeof x.url === "string" && x.url)
  .map((x) => ({ src: x.url, hd: typeof x.hd === "string" && x.hd ? x.hd : x.url }));

export function fetchHotelPhotos(hotelId) {
  const id = String(hotelId || "").trim();
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    const p = callWorker("hotels/nuitee/photos", { hotelId: id })
      .then(({ data }) => {
        if (!data?.ok) return null;
        const rooms = (Array.isArray(data.rooms) ? data.rooms : [])
          .map((r) => ({ id: r?.id ?? null, name: r?.name || null, photos: toPhotos(r?.photos) }))
          .filter((r) => r.photos.length);
        return { photos: toPhotos(data.photos), rooms };
      })
      .catch(() => null);
    cache.set(id, p);
    p.then((v) => { if (!v) cache.delete(id); });
  }
  return cache.get(id);
}

// The photos for one rate: the supplier's own link first (the rate's
// mappedRoomId equals a room id), else a room whose name equals the rate's
// room name once both are normalised — never a looser guess. Empty when
// neither matches, and the picker then shows no picture for that room.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export function roomPhotosFor(gallery, mappedRoomId, roomName) {
  const rooms = Array.isArray(gallery?.rooms) ? gallery.rooms : [];
  if (mappedRoomId != null) {
    const r = rooms.find((x) => x.id != null && String(x.id) === String(mappedRoomId));
    if (r) return r.photos;
  }
  const n = norm(roomName);
  if (n) {
    const r = rooms.find((x) => norm(x.name) === n);
    if (r) return r.photos;
  }
  return [];
}
