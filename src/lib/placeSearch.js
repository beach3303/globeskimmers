// Free place/city search (OpenStreetMap via the Worker's cached /place-search).
// Used by "Stamp a place" — no Google Places cost. Returns
// [{ name, display, city, country, cc, lat, lng, type }]. On-demand (search
// button), not per-keystroke, to respect OSM's usage policy.
const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";

export async function placeSearch(q, near) {
  if (!q || String(q).trim().length < 2) return [];
  try {
    const u = new URL(WORKER + "/place-search");
    u.searchParams.set("q", String(q).trim());
    if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) u.searchParams.set("near", `${near.lat},${near.lng}`);
    const r = await fetch(u.toString());
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.results) ? d.results : [];
  } catch { return []; }
}
