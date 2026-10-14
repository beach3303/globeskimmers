// A stamp or attraction tapped anywhere opens that attraction's Things to Do
// card — pinned on top and opened (founder, 2026-10-03: the Things to Do card
// is THE page for an attraction; the separate stamp pages are gone).
import { createPageUrl } from "@/utils";

export function attractionUrl(id) {
  // A Local favorite (lf:<id>, founder 2026-10-12) is a suggested place the
  // founder approved: it has its own page (who recommends it, and why), not
  // a Things to Do card.
  const lf = /^lf:(\d{1,12})$/.exec(String(id));
  if (lf) return `${createPageUrl("LocalFavorite")}?id=${lf[1]}`;
  return `${createPageUrl("ThingsToDo")}?focus=${encodeURIComponent(String(id))}`;
}

// from: a short label for where the tap came from ("Stamps near you"…), shown on the card.
export function openAttraction(navigate, item, from = null) {
  const id = item?.id != null ? String(item.id) : "";
  if (!id) return false;
  navigate(attractionUrl(id), {
    state: {
      focus: {
        id,
        name: item.name || null,
        lat: item.lat ?? item.latitude ?? null,
        lng: item.lng ?? item.longitude ?? null,
        photo: item.photoUrl || (Array.isArray(item.photos) ? item.photos[0] : null) || null,
        from,
      },
    },
  });
  return true;
}
