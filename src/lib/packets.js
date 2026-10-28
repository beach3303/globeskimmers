// Photo packets — "prints back from the developer" (founder concept,
// 2026-09-29): every destination auto-gathers the traveler's memory photos
// into one envelope. Purely DERIVED from the stamps payload the caller
// already holds, so packets can never disagree with the passport, cost no
// network, and inherit the viewer's permissions automatically (a friend's
// payload only ever contains photos that passed moderation).
// The four levels, narrowest first (src/lib/audience.js).
const RANK = { me: 0, inner: 1, followers: 2, public: 3 };
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
    // One envelope per destination PER YEAR (founder, 2026-10-14 night: lifetimes of
    // 300–1000+ prints read as years, not one endless shelf).
    const year = String(s.visited_on || s.created_at || "").slice(0, 4) || "Undated";
    const key = `${city}|${(s.country || "").trim()}|${year}`;
    if (!groups.has(key)) groups.set(key, { key, year, city, country: (s.country || "").trim(), photos: [], dates: [], tiers: [], stampId: null, stampWhen: "", stampIds: [], albumTiers: [], stampTiers: [], widest: null });
    const g = groups.get(key);
    // The stamp's audience rides on each print (the tiers, 2026-10-15), narrowed by the album's own
    // setting (photos_tier: any of the four words since 2026-10-27, never wider than its stamp;
    // unset = as far as the stamp goes); a 🌍 print also hangs on the city board unless taken down.
    const own = s.visibility || (s.hidden ? "me" : "inner");
    const tier = s.photos_tier && RANK[s.photos_tier] !== undefined && RANK[s.photos_tier] < (RANK[own] ?? 1) ? s.photos_tier : own;
    if (!g.tiers.includes(tier)) g.tiers.push(tier);
    if (s.id) g.stampIds.push(s.id);
    // The album's level is what its photos really reach; the widest stamp is the most it can be set to.
    if (!g.albumTiers.includes(tier)) g.albumTiers.push(tier);
    if (!g.widest || (RANK[own] ?? 1) > (RANK[g.widest] ?? 1)) g.widest = own;
    // The stamps' own settings, shown quietly on the envelope (founder, 2026-10-28).
    if (!g.stampTiers.includes(own)) g.stampTiers.push(own);
    for (const p of photos) g.photos.push({ src: p.photo_url, photo_url: p.photo_url, id: p.id, caption: p.caption || null, place: s.name, food: Number(p.food_subject) === 1, tier, board_hidden: p.board_hidden === true });
    if (s.visited_on) g.dates.push(String(s.visited_on).slice(0, 10));
    // The packet's newest stamp receives prints added from the packet itself
    // (founder, 2026-10-05: upload from the profile, not only from the stamp).
    const when = String(s.visited_on || s.created_at || "");
    if (s.id && when >= g.stampWhen) { g.stampId = s.id; g.stampWhen = when; }
  }
  return [...groups.values()]
    .map((g) => {
      g.dates.sort();
      const first = g.dates[0], last = g.dates[g.dates.length - 1];
      const from = monthDay(first), to = monthDay(last);
      // One month reads "May 18–19": "May 18 – May 19" wrapped on the envelope's label.
      const oneMonth = !!first && !!last && first.slice(0, 7) === last.slice(0, 7);
      g.range = from ? (to && to !== from ? (oneMonth ? `${from}–${Number(last.slice(8, 10))}` : `${from} – ${to}`) : from) : null;
      return g;
    })
    .sort((a, b) => b.year.localeCompare(a.year)
      || String(b.dates[b.dates.length - 1] || "").localeCompare(String(a.dates[a.dates.length - 1] || ""))
      || b.photos.length - a.photos.length);
}

// The year sections, newest first: [{ year, prints, packets }].
export function packetsByYear(packets) {
  const by = new Map();
  for (const p of packets || []) {
    if (!by.has(p.year)) by.set(p.year, { year: p.year, prints: 0, packets: [] });
    const g = by.get(p.year);
    g.prints += p.photos.length;
    g.packets.push(p);
  }
  return [...by.values()];
}
