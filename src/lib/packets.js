// Photo packets — "prints back from the developer" (founder concept,
// 2026-09-29): every destination auto-gathers the traveler's memory photos
// into one envelope. Purely DERIVED from the stamps payload the caller
// already holds, so packets can never disagree with the passport, cost no
// network, and inherit the viewer's permissions automatically (a friend's
// payload only ever contains photos that passed moderation).
const monthDay = (iso) => {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  return isNaN(d) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function derivePackets(stamps) {
  const groups = new Map();
  for (const s of stamps || []) {
    const photos = (s.photos || []).filter((p) => p && p.photo_url);
    if (!photos.length) continue;
    const city = (s.city || "").trim() || s.name;
    const key = `${city}|${(s.country || "").trim()}`;
    if (!groups.has(key)) groups.set(key, { key, city, country: (s.country || "").trim(), photos: [], dates: [], stampId: null, stampWhen: "" });
    const g = groups.get(key);
    for (const p of photos) g.photos.push({ src: p.photo_url, caption: s.name });
    if (s.visited_on) g.dates.push(String(s.visited_on).slice(0, 10));
    // The packet's newest stamp receives prints added from the packet itself
    // (founder, 2026-10-05: upload from the profile, not only from the stamp).
    const when = String(s.visited_on || s.created_at || "");
    if (s.id && when >= g.stampWhen) { g.stampId = s.id; g.stampWhen = when; }
  }
  return [...groups.values()]
    .map((g) => {
      g.dates.sort();
      const from = monthDay(g.dates[0]), to = monthDay(g.dates[g.dates.length - 1]);
      g.range = from ? (to && to !== from ? `${from} – ${to}` : from) : null;
      return g;
    })
    .sort((a, b) => b.photos.length - a.photos.length);
}
