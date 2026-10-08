#!/usr/bin/env node
// Photo coverage audit for every finder (founder, 2026-10-08: coffee cards
// showing a cup placeholder instead of a photo). For each city × finder it
// loads the first page the way the app does, runs the same batch photo lookup
// the app runs for our own (owned) rows, and reports how many cards end up
// with a photo, and why the rest don't:
//   google-has-none  — matched a Google listing that has no photos
//   no-match         — no Google listing matched (or a remembered "no match")
//   ok               — at least one photo
//   node scripts/photo-audit.mjs
const API = "https://globeskimmers-api.maizasimeon.workers.dev";
const post = async (path, body) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(`${API}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); } catch { await new Promise((r) => setTimeout(r, 1500)); } } return {}; };
const CITIES = [
  ["Santa Clarita (Copper Hill)", 34.4703, -118.5463],
  ["Arcadia, CA", 34.1397, -118.0353],
  ["Midtown Manhattan", 40.7575, -73.9787],
  ["Paris", 48.8606, 2.3376],
  ["Tokyo (Ginza)", 35.6717, 139.765],
  ["Manila (Makati)", 14.5547, 121.0244],
];
const R = 25 * 1609;
const FINDERS = {
  eat: (lat, lng) => post("restaurants-full", { latitude: lat, longitude: lng, radius: R, maxResults: 40 }).then((d) => d.places || []),
  coffee: (lat, lng) => post("coffee-owned", { latitude: lat, longitude: lng, radius: R, maxResults: 30 }).then((d) => d.places || d.shops || []),
  things: (lat, lng) => post("activities", { latitude: lat, longitude: lng, radius: R, maxResults: 60, category: "all" }).then((d) => d.activities || []),
  shopping: (lat, lng) => post("shopping", { latitude: lat, longitude: lng, radius: R, maxResults: 30, category: "all" }).then((d) => d.places || d.results || []),
  atm: (lat, lng) => post("atm-locations", { latitude: lat, longitude: lng, radius: R, maxResults: 30 }).then((d) => d.places || d.atms || d.results || []),
  convenience: (lat, lng) => post("convenience-stores", { latitude: lat, longitude: lng, radius: R, maxResults: 30 }).then((d) => d.places || d.stores || d.all_stores || []),
  restroom: (lat, lng) => post("restroom-owned", { latitude: lat, longitude: lng, radius: R, maxResults: 30, venueType: "all" }).then((d) => d.places || d.restrooms || []),
};
const hasPhoto = (x) => (x.photos || []).filter(Boolean).length > 0 || !!x.photoUrl;
const isOwned = (x) => x.source === "owned" || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(x.id || x.placeId || ""));
const nameOf = (x) => x.displayName?.text || x.name || "";
const total = {};
for (const [city, lat, lng] of CITIES) {
  for (const [finder, load] of Object.entries(FINDERS)) {
    const list = (await load(lat, lng)).slice(0, 20);
    const owned = list.filter((x) => isOwned(x) && !hasPhoto(x));
    const enriched = owned.length ? (await post("places/enrich-owned", { places: owned.map((x) => ({ id: x.id || x.placeId, name: nameOf(x), lat: x.latitude ?? x.lat ?? x.location?.latitude, lng: x.longitude ?? x.lng ?? x.location?.longitude })), maxPhotos: 3 })).results || {} : {};
    const tally = { ok: 0, "google-has-none": 0, "no-match": 0 };
    const misses = [];
    for (const x of list) {
      let why = "ok";
      if (!hasPhoto(x)) {
        const e = enriched[String(x.id || x.placeId)];
        if (isOwned(x) && e?.matched && (e.photos || []).length) why = "ok";
        else if (isOwned(x) && e?.matched) why = "google-has-none";
        else if (isOwned(x)) why = "no-match";
        else why = "google-has-none";
      }
      tally[why]++;
      if (why !== "ok") misses.push(`${nameOf(x).slice(0, 28)} (${why}${isOwned(x) ? "" : ", google row"})`);
    }
    const n = list.length;
    for (const k of Object.keys(tally)) total[finder] = { ...(total[finder] || {}), [k]: ((total[finder] || {})[k] || 0) + tally[k] };
    console.log(`${city.padEnd(28)} ${finder.padEnd(11)} ${String(n).padStart(2)} cards · photo ${tally.ok}/${n} · no-match ${tally["no-match"]} · google-has-none ${tally["google-has-none"]}${misses.length ? "\n      " + misses.slice(0, 6).join("; ") : ""}`);
  }
}
console.log("\nTOTAL (first 20 cards per city):");
for (const [f, t] of Object.entries(total)) { const n = t.ok + t["no-match"] + t["google-has-none"]; console.log(`  ${f.padEnd(11)} photo ${t.ok}/${n} (${Math.round(100 * t.ok / Math.max(1, n))}%) · no-match ${t["no-match"]} · google-has-none ${t["google-has-none"]}`); }
