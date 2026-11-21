// stampFromPhotos — stamp a place from its photos with no form (Upload photos → "Stamp all",
// founder 2026-11-20: "ask if they want stamps on all those places or only one"). The same path
// StampPlaceModal.submit takes for a photo-backed visit: addStamp (kind city, entity visit:…,
// await_proof), then every photo with its own location tag and time as proof, then the stamp is
// removed again if no photo proved it. The first-choice place from the photo's lookup is the
// place; the first photo's day is the date.
//
//   const { data, proof, error } = await stampFromPhotos({ option, files, at, day, look, onProgress });
//   option      photoOptions(data)[0] — { kind: 'place'|'city', name, city, country, cc, region, local }
//   files       File[] (a clip rides as file.gsClip, its poster as the file, like the modal)
//   at          { lat, lng } where the photos were taken (the group's spot)
//   day         'YYYY-MM-DD' of the first photo, when the sorter knows it
//   look        a photoLook, or null for the plain photo
//   onProgress  (message) => void, the same words the modal shows
import { addStamp, uploadStampPhoto, deleteStamp, STAMP_EARLIEST } from "@/lib/passport";
import { uploadStampClip } from "@/lib/clips";
import { readPhotoExif } from "@/lib/photoExif";
import { resizePhoto } from "@/lib/resizePhoto";
import { renderLook, isPlain } from "@/lib/photoLook";
import { localISODate } from "@/lib/localDate";

const sl = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));

export async function stampFromPhotos({ option, files, at = null, day = null, look = null, onProgress = null }) {
  const say = (m) => { try { onProgress?.(m); } catch { /* fine */ } };
  const cityName = String(option?.city || (option?.kind === "city" ? option?.name : "") || "").trim();
  if (!cityName) return { error: "We couldn't name the city for this place" };
  if (!Array.isArray(files) || !files.length) return { error: "No photos for this place" };
  const venue = option?.kind === "place" ? String(option.name || "").trim() : "";
  // Each photo's own location tag and time, read before resizing strips them.
  const exifs = await Promise.all(files.map((f) => (f.gsExif ? Promise.resolve(f.gsExif) : readPhotoExif(f).catch(() => null))));
  const days = exifs.map((x) => String(x?.taken_at || "").slice(0, 10)).filter(isDay).sort();
  const dateVal = isDay(day) ? day : (days[0] || localISODate());
  if (dateVal < STAMP_EARLIEST) return { error: "Those photos are from before 2021. Stamps go back to January 1, 2021." };
  if (dateVal > localISODate()) return { error: "That date hasn’t happened yet" };
  const entity_id = `visit:${sl(cityName)}:${sl(venue)}:${dateVal}`;
  const lat = Number.isFinite(at?.lat) ? at.lat : null;
  const lng = Number.isFinite(at?.lng) ? at.lng : null;
  say("Placing your stamp…");
  const { data, error } = await addStamp({
    kind: "city", entity_type: "visit", entity_id,
    name: venue || cityName, city: cityName, region: option?.region || null,
    country: option?.country || null, cc: option?.cc || undefined,
    lat, lng,
    visited_on: dateVal, local_hour: new Date().getHours(), verified: "self",
    local_name: option?.local || undefined,
    await_proof: true,   // the photos are the proof; the worker holds the stamp until one lands
  });
  if (error || !data?.id) return { error: error || "Could not add stamp" };
  let proof = null;
  for (let i = 0; i < files.length; i++) {
    say(files.length > 1 ? `Sending photo ${i + 1} of ${files.length}…` : "Sending your photo — checking it proves the visit…");
    try {
      let up;
      if (files[i].gsClip) {
        up = await uploadStampClip({ stamp_id: data.id, file: files[i].gsClip.file, exif: exifs[i], filter: files[i].gsClip.filter, marks: files[i].gsClip.marks, visited_on: dateVal });
      } else {
        const plain = await resizePhoto(files[i]);
        const image = look && !isPlain(look) ? await renderLook(plain, look) : plain;
        up = await uploadStampPhoto({ stamp_id: data.id, image, visited_on: dateVal, exif: exifs[i] });
      }
      if (up?.data?.proof && !proof) proof = up.data.proof;
    } catch { /* skip a bad photo */ }
  }
  // Nothing proved it → nothing is kept (unless an existing stamp was being re-stamped).
  if (data.verified !== "gps" && !proof && data.created) {
    await deleteStamp(data.id).catch(() => {});
    return { error: `We couldn't confirm ${venue || cityName} from those photos` };
  }
  return { data: { ...data, name: data.name || venue || cityName, city: cityName, country: option?.country || null }, proof };
}
