// A stamp or attraction tapped anywhere opens that attraction's Things to Do
// card — pinned on top and opened (founder, 2026-10-03: the Things to Do card
// is THE page for an attraction; the separate stamp pages are gone).
import { createPageUrl } from "@/utils";

export function attractionUrl(id) {
  return `${createPageUrl("ThingsToDo")}?focus=${encodeURIComponent(String(id))}`;
}

export function openAttraction(navigate, item) {
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
      },
    },
  });
  return true;
}
