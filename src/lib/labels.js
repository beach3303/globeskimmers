// Luggage labels — the suitcase's collectibles, DERIVED from the passport's
// stamps (founder concept, 2026-09-29: the passport keeps proof, the trunk
// keeps play; labels are 1920s hotel luggage labels, engraved and dignified,
// never cartoons). v1 stores nothing: every label is computed here from the
// stamps the passport already loads, so the whole feature ships by OTA and a
// label can never disagree with the stamps that earned it. Placement, the
// keepsake tray and partner drops come later with their own table.
//
// Each label: { key, shape, ink, top, big, sub, story, earnedOn, place }
//   shape: oval | roundel | lozenge | diamond | plane | film  (LuggageLabel.jsx)
//   ink:   one of the muted label inks below — never candy colors.

const INKS = { steel: "#3E5F74", oxblood: "#8A3B2F", navy: "#20283A", gold: "#C9A85C", red: "#A5432E", slate: "#2F4858" };

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const roman = (n) => ROMAN[n] || String(n);
const yearRoman = (iso) => {
  const y = Number(String(iso || "").slice(0, 4));
  if (!y) return "";
  // Compact roman year, the label way: MMXXVI
  const M = "M".repeat(Math.floor(y / 1000));
  const c = [null, "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"][Math.floor((y % 1000) / 100)] || "";
  const x = [null, "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"][Math.floor((y % 100) / 10)] || "";
  const i = [null, "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][y % 10] || "";
  return M + c + x + i;
};

const when = (s) => s.visited_on || (s.created_at || "").slice(0, 10) || "";
const byWhen = (a, b) => String(when(a)).localeCompare(String(when(b)));

// The one due-diligence list v1 hand-keys: places whose creature we can name.
const CREATURES = [
  { match: /georgia aquarium/i, big: "WHALE SHARK", story: "The only aquarium outside Asia where whale sharks swim — and you stood in front of one." },
];

export function deriveLabels(stamps) {
  const list = (stamps || []).filter(Boolean).slice().sort(byWhen);
  if (!list.length) return [];
  const labels = [];
  const add = (l) => { if (!labels.some((x) => x.key === l.key)) labels.push(l); };

  // 1 · Maiden Voyage — the first stamp ever.
  const first = list[0];
  add({
    key: "maiden", shape: "lozenge", ink: INKS.oxblood,
    top: "MAIDEN VOYAGE", big: null, sub: yearRoman(when(first)),
    story: `Every trunk starts somewhere. Yours started at ${first.name}${first.city ? `, ${first.city}` : ""}.`,
    earnedOn: when(first), place: first.name,
  });

  // 2 · First Flight — the first airport stamp.
  const flight = list.find((s) => s.kind === "airport");
  if (flight) add({
    key: "first-flight", shape: "plane", ink: INKS.slate,
    top: String(flight.entity_id || "").toUpperCase().slice(0, 4) || "AIR", big: null, sub: null,
    story: `First wings on the trunk: ${flight.entity_id || flight.name}${flight.city ? `, ${flight.city}` : ""}.`,
    earnedOn: when(flight), place: flight.name,
  });

  // 3 · The creature — an aquarium or zoo visit earns a naturalist's engraving.
  const aqua = list.find((s) => /aquarium|zoo\b/i.test(String(s.name || "")));
  if (aqua) {
    const c = CREATURES.find((x) => x.match.test(String(aqua.name || "")));
    add({
      key: "creature", shape: "oval", ink: INKS.steel,
      top: String(aqua.name || "").toUpperCase().slice(0, 24),
      big: c ? c.big : null,
      sub: `${String(aqua.city || "").toUpperCase()}${aqua.city ? " · " : ""}${yearRoman(when(aqua))}`,
      story: c ? c.story : `A naturalist's mark from ${aqua.name}.`,
      earnedOn: when(aqua), place: aqua.name,
    });
  }

  // 4 · Filmed Here — the first scene stamp.
  const film = list.find((s) => s.meta && s.meta.film && s.meta.film.title);
  if (film) add({
    key: "filmed", shape: "film", ink: INKS.navy,
    top: "FILMED HERE", big: null, sub: String(film.meta.film.title || "").toUpperCase().slice(0, 22),
    story: `You stood where the camera stood: ${film.name}, from ${film.meta.film.title}${film.meta.film.year ? ` (${film.meta.film.year})` : ""}.`,
    earnedOn: when(film), place: film.name,
  });

  // 5 · The city collector — your deepest city, from three stamps up.
  const cities = new Map();
  for (const s of list) { const c = (s.city || "").trim(); if (c) cities.set(c, (cities.get(c) || 0) + 1); }
  let topCity = null, topN = 0;
  for (const [c, n] of cities) if (n > topN) { topCity = c; topN = n; }
  if (topCity && topN >= 3) {
    const lastInCity = list.filter((s) => (s.city || "").trim() === topCity).pop();
    add({
      key: "city-collector", shape: "roundel", ink: INKS.oxblood,
      top: topCity.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) || "CTY", big: null,
      sub: `${roman(Math.min(topN, 12))} STAMPS`,
      story: `${topCity} keeps calling you back — ${topN} stamps and counting.`,
      earnedOn: when(lastInCity), place: topCity,
    });
  }

  // 6 · Wayfarer — five countries, then ten.
  const countries = new Set(list.map((s) => (s.country || "").trim()).filter(Boolean));
  if (countries.size >= 5) {
    const n = countries.size >= 10 ? 10 : 5;
    add({
      key: `wayfarer-${n}`, shape: "diamond", ink: INKS.gold,
      top: "WAYFARER", big: roman(n), sub: "COUNTRIES",
      story: `${n === 10 ? "Ten" : "Five"} countries on one trunk.`,
      earnedOn: when(list[list.length - 1]), place: null,
    });
  }

  // 7 · I was here! — the first verified stamp (gps / photo location / photo).
  const proved = list.find((s) => s.verified === "gps" || s.verified === "photo_loc" || s.verified === "photo_ai");
  if (proved) add({
    key: "proved", shape: "lozenge", ink: INKS.red,
    top: null, big: "I was here!", sub: null,
    story: `Proof, not just memory: ${proved.name}, verified.`,
    earnedOn: when(proved), place: proved.name,
  });

  return labels;
}

// Which labels are new since the traveler last looked (for the earn toast).
const SEEN_KEY = "pp_labels_seen_v1";
export function unseenLabels(labels) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { /* first look */ }
  return labels.filter((l) => !seen.includes(l.key));
}
export function markLabelsSeen(labels) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(labels.map((l) => l.key))); } catch { /* fine */ }
}
