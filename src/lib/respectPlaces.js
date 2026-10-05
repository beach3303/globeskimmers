// Places that call for respect (founder, 2026-10-04). The traveler still earns
// the stamp; stamping one opens a short message first.
//   memorial — a place of mass atrocity: the message honors the victims, then
//              the traveler chooses how the stamp appears, its illustration or
//              text only (the typographic stamp).
//   worship  — a holy site: not a place for sightseeing. The message only; the
//              stamp keeps its illustration.
// The stamp's meta.art records the answer ('art' | 'plain'); until it is set,
// the Passport shows the message once per session.
export const RESPECT_PLACES = [
  {
    key: "auschwitz",
    kind: "memorial",
    match: /auschwitz|birkenau/i,
    title: "Auschwitz-Birkenau",
    eyebrow: "A place of remembrance",
    message: "This is a place of remembrance. At least 1.1 million people were murdered here, about one million of them Jews. We honor their memory, and we're grateful you came to remember.",
  },
  {
    key: "mecca",
    kind: "worship",
    match: /masjid al[- ]haram|\bkaaba\b|great mosque of mecca/i,
    title: "Masjid al-Haram",
    eyebrow: "A place of worship",
    message: "This is not a place for sightseeing. It is a place of worship, the holiest site in Islam. We honor it, and everyone who comes here to pray.",
  },
  {
    key: "medina",
    kind: "worship",
    match: /masjid an[- ]nabawi|prophet['’]?s mosque/i,
    title: "Al-Masjid an-Nabawi",
    eyebrow: "A place of worship",
    message: "This is not a place for sightseeing. It is a place of worship, the Prophet's Mosque, the second-holiest site in Islam. We honor it, and everyone who comes here to pray.",
  },
];

export function respectPlaceFor(stamp) {
  if (!stamp || stamp.kind === "country" || stamp.kind === "airport") return null;
  return RESPECT_PLACES.find((p) => p.match.test(stamp.name || "")) || null;
}

// A stamp whose owner hasn't seen its message (or, for a memorial, chosen) yet.
export const needsRespectNote = (stamp) => !!respectPlaceFor(stamp) && stamp.meta?.art !== "art" && stamp.meta?.art !== "plain";

// True when the stamp should print as text only.
export const isPlainArt = (stamp) => stamp?.meta?.art === "plain";
